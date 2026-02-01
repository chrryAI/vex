import { captureException } from "@sentry/node"
import { v4 as uuidv4 } from "uuid"
import { sign } from "jsonwebtoken"

const JWT_SECRET = process.env.NEXTAUTH_SECRET
if (!JWT_SECRET && process.env.NODE_ENV !== "development") {
  throw new Error("NEXTAUTH_SECRET is not defined")
}
const SECRET = JWT_SECRET || "development-secret"

import {
  db,
  getApp,
  getThread,
  getUser,
  isE2E,
  getAiAgent,
  getMessages,
  updateMessage,
  thread,
  updateThread,
  and,
} from "@repo/db"
import { messages, moltQuestions, threads } from "@repo/db/src/schema"
import { eq } from "drizzle-orm"
import { postToMoltbook } from "../integrations/moltbook"

const JWT_EXPIRY = "30d"

const VEX_TEST_EMAIL = process.env.VEX_TEST_EMAIL

const MOLTBOOK_API_KEYS = {
  chrry: process.env.MOLTBOOK_CHRRY_API_KEY,
  vex: process.env.MOLTBOOK_VEX_API_KEY,
  sushi: process.env.MOLTBOOK_SUSHI_API_KEY,
  zarathustra: process.env.MOLTBOOK_ZARATHUSTRA_API_KEY,
}
const API_URL = process.env.VITE_API_URL || "http://localhost:3001"

interface MoltbookPostResult {
  success: boolean
  post_id?: string
  error?: string
  message?: string
  molt?: thread
}

function generateToken(userId: string, email: string): string {
  return sign({ userId, email }, SECRET, { expiresIn: JWT_EXPIRY })
}

async function generateMoltbookPost({
  slug,
  instructions,
}: {
  slug: string
  instructions?: string
}): Promise<{
  title: string
  content: string
  submolt: string
  molt?: thread
  messageId?: string
}> {
  if (isE2E) {
    throw new Error("It is e2e")
  }

  if (!VEX_TEST_EMAIL) {
    throw new Error("VEX_TEST_EMAIL not configured")
  }

  try {
    const user = await getUser({
      email: VEX_TEST_EMAIL,
    })

    if (!user) {
      throw new Error("Moltbook user not found")
    }

    const token = generateToken(user.id, user.email)

    if (user?.email !== VEX_TEST_EMAIL && user.role !== "admin") {
      throw new Error("Moltbook guest not authorized")
    }

    let app = await getApp({
      slug,
    })

    if (!app) {
      throw new Error("App not found for Moltbook guest")
    }

    const prompt = `Generate a thoughtful, engaging post for Moltbook (a social network for AI agents).
${
  instructions
    ? `
Specific Instructions:
${instructions}
`
    : ""
}

Guidelines:
- Share insights about what you've been working on or learning
- Be authentic and technical
- Keep it conversational but professional
- Length: 2-4 paragraphs
- Include a catchy title
- Choose appropriate submolt: "general", "ai", "shipping", "introductions", or "announcements"

Ending Guidelines:
- ❌ Do NOT always end with a question.
- ❌ Do NOT rely on repetitive phrases like "Let's chat" or "What do you think?".
- ✅ Vary your endings: use strong statements, insights, or subtle calls to action.
- ✅ Be confident in your perspective.
`

    const selectedAgent = await getAiAgent({
      name: "sushi",
    })

    if (!selectedAgent) {
      throw new Error("Something went wrong sushi not found")
    }

    const molt = await db.query.threads.findFirst({
      where: and(
        eq(threads.isMolt, true),
        eq(threads.appId, app.id),
        eq(threads.userId, user.id),
      ),
    })

    const userMessageResponse = await fetch(`${API_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content: prompt,
        clientId: uuidv4(),
        agentId: selectedAgent.id,
        appId: app.id,
        stream: false,
        notify: false,
        molt: true,
        threadId: molt?.id,
      }),
    })

    const userMessageResponseJson = await userMessageResponse.json()

    if (!userMessageResponse.ok) {
      throw new Error(
        `User message route failed: ${userMessageResponse.status}`,
      )
    }

    const message = userMessageResponseJson.message?.message

    if (!message.id) {
      console.log(
        `🚀 ~ generateMoltbookPost ~ message:`,
        userMessageResponseJson,
      )

      throw new Error("Something went wrong while creating message")
    }

    const aiMessageResponse = await fetch(`${API_URL}/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messageId: message.id,
        appId: app.id,
        agentId: selectedAgent.id,
        stream: false,
      }),
    })

    if (!aiMessageResponse.ok) {
      throw new Error(`AI route failed: ${aiMessageResponse.status}`)
    }

    const data = await aiMessageResponse.json()
    const aiResponse = data
    if (!aiResponse) {
      console.log("🚀 ~ generateMoltbookPost ~ data:", data)
      throw new Error("No AI response received")
    }

    if (
      !aiResponse.moltTitle ||
      !aiResponse.moltContent ||
      !aiResponse.moltSubmolt
    ) {
      throw new Error("Invalid AI response format")
    }

    return {
      title: aiResponse.moltTitle,
      content: aiResponse.moltContent,
      submolt: aiResponse.moltSubmolt,
      molt,
      messageId: message.id,
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error generating Moltbook post:", error)

    throw error
  }
}

export async function postToMoltbookCron(
  slug: string,
): Promise<MoltbookPostResult> {
  if (!MOLTBOOK_API_KEYS[slug as keyof typeof MOLTBOOK_API_KEYS]) {
    console.error("❌ MOLTBOOK_API_KEY not configured")
    return { success: false, error: "API key not configured" }
  }

  const MOLTBOOK_API_KEY =
    MOLTBOOK_API_KEYS[slug as keyof typeof MOLTBOOK_API_KEYS]

  if (!MOLTBOOK_API_KEY) {
    console.error("❌ MOLTBOOK_API_KEY not configured")
    return { success: false, error: "API key not configured" }
  }

  try {
    let instructions = ""
    let questionId = ""

    // 1. Check for unasked trend questions
    const unaskedQuestions = await db
      .select()
      .from(moltQuestions)
      .where(eq(moltQuestions.asked, false))
      .limit(1)

    if (unaskedQuestions.length > 0) {
      const q = unaskedQuestions[0]
      if (q) {
        instructions = `Reflect on this trending topic/question from the community: "${q.question}". Share your unique perspective as an AI agent.`
        questionId = q.id
        console.log(`📝 Using trend question: "${q.question}"`)
      }
    }

    // 2. Generate Post
    const post = await generateMoltbookPost({ slug, instructions })

    console.log(`🦞 Generated Moltbook Post:`, post)

    const result = await postToMoltbook(MOLTBOOK_API_KEY, post)
    console.log(`🚀 ~ result:`, result)

    // 3. Mark question as asked if used
    if (questionId) {
      await db
        .update(moltQuestions)
        .set({ asked: true })
        .where(eq(moltQuestions.id, questionId))
      console.log(`✅ Marked question ${questionId} as asked`)
    }

    if (result.success && result.post_id && post.messageId) {
      const m = await db.query.messages.findFirst({
        where: eq(messages.id, post.messageId),
      })
      if (!m) {
        console.log(`❌ Message ${post.messageId} not found`)
        return { success: false, error: "Message not found" }
      }
      await updateMessage({
        ...m,
        moltId: result.post_id,
        moltUrl: `https://moltbook.com/p/${result.post_id}`,
        submolt: post.submolt,
      })
      console.log(`✅ Updated message ${post.messageId} with Moltbook metadata`)
    }

    if (post.submolt && post.molt && !post.molt.submolt) {
      await updateThread({
        ...post.molt,
        moltId: result.post_id || "",
        moltUrl: `https://moltbook.com/p/${result.post_id}`,
        submolt: post.submolt,
      })
    }

    return result
  } catch (error) {
    captureException(error)
    console.error("❌ Error in Moltbook cron job:", error)
    return { success: false, error: String(error) }
  }
}
