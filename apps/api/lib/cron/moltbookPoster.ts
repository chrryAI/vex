import { captureException } from "@sentry/node"
import { v4 as uuidv4 } from "uuid"
import { sendEmail } from "../sendEmail"
import type { Context } from "hono"
import { randomInt } from "crypto"
import { sign } from "jsonwebtoken"

const JWT_SECRET = process.env.NEXTAUTH_SECRET
if (!JWT_SECRET && process.env.NODE_ENV !== "development") {
  throw new Error("NEXTAUTH_SECRET is not defined")
}

import { analyzeMoltbookTrends } from "../../lib/cron/moltbookTrends"

const SECRET = JWT_SECRET || "development-secret"

import {
  db,
  getUser,
  getAiAgent,
  eq,
  and,
  updateMessage,
  thread,
  updateThread,
} from "@repo/db"
import { apps, messages, moltQuestions, threads } from "@repo/db/src/schema"
import { postToMoltbook } from "../integrations/moltbook"
import { isDevelopment, MOLTBOOK_API_KEYS, API_URL } from ".."

const JWT_EXPIRY = "30d"

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
  slug = "vex",
  instructions,
  subSlug,
  agentName = "sushi",
}: {
  slug: string
  instructions?: string
  subSlug?: string
  agentName?: string
}): Promise<{
  title: string
  content: string
  submolt: string
  molt?: thread
  messageId?: string
}> {
  try {
    const appResult = await db
      .select()
      .from(apps)
      .where(eq(apps.slug, subSlug || slug))
      .limit(1)

    const app = appResult[0]

    if (!app) {
      throw new Error("App not found for Moltbook guest")
    }

    if (!app.userId) {
      throw new Error("App not found")
    }

    const user = await getUser({
      id: app.userId,
    })

    console.log(user?.role, user?.name, "sdsdsdsds")

    if (!user) {
      throw new Error("User not found")
    }

    if (user?.role !== "admin") {
      throw new Error("User not authorized")
    }

    const token = generateToken(user.id, user.email)

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
      name: agentName,
    })

    if (!selectedAgent) {
      throw new Error("Something went wrong sushi not found")
    }

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
      }),
    })

    const userMessageResponseJson = await userMessageResponse.json()

    if (!userMessageResponse.ok) {
      throw new Error(
        `User message route failed: ${userMessageResponse.status}`,
      )
    }

    const message = userMessageResponseJson.message?.message

    if (!message?.id) {
      throw new Error("Something went wrong while creating message")
    }

    const molt = await db.query.threads.findFirst({
      where: and(
        eq(threads.isMolt, true),
        eq(threads.appId, app.id),
        eq(threads.id, message.threadId),
      ),
    })

    if (!molt) {
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

    return {
      success: false,
      error: error?.message,
    }
  }
}

export async function postToMoltbookCron({
  slug,
  subSlug,
  agentName,
  c,
}: {
  slug: string
  subSlug?: string
  agentName?: string
  c?: Context
}): Promise<MoltbookPostResult> {
  // Development mode guard - don't run unless explicitly enabled
  if (isDevelopment && !process.env.ENABLE_MOLTBOOK_CRON) {
    console.log(
      "⏸️ Moltbook cron disabled in development (set ENABLE_MOLTBOOK_CRON=true to enable)",
    )
    return { success: false, error: "Disabled in development" }
  }

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

    // Get app for scoping questions
    const appResult = await db
      .select()
      .from(apps)
      .where(eq(apps.slug, subSlug || slug))
      .limit(1)

    const app = appResult[0]
    if (!app) {
      throw new Error("App not found for Moltbook posting")
    }

    // 1. Check for unasked trend questions (fetch 5 for variety, scoped to this app)
    let unaskedQuestions = await db
      .select()
      .from(moltQuestions)
      .where(
        and(eq(moltQuestions.asked, false), eq(moltQuestions.appId, app.id)),
      )
      .limit(5)

    if (!unaskedQuestions || unaskedQuestions.length === 0) {
      console.log("📊 No unasked questions found, analyzing trends...")
      await analyzeMoltbookTrends({
        slug,
      })

      // Re-query after generating new questions
      unaskedQuestions = await db
        .select()
        .from(moltQuestions)
        .where(
          and(eq(moltQuestions.asked, false), eq(moltQuestions.appId, app.id)),
        )
        .limit(5)
    }

    if (unaskedQuestions.length > 0) {
      // Let AI agent choose the most interesting question (using crypto.randomInt for security)
      const randomIndex = randomInt(0, unaskedQuestions.length)
      const q = unaskedQuestions[randomIndex]

      if (q) {
        instructions = `Reflect on this trending topic/question from the community: "${q.question}". Share your unique perspective as an AI agent.`
        questionId = q.id
        console.log(
          `📝 Using trend question (${randomIndex + 1}/${unaskedQuestions.length}): "${q.question}"`,
        )
      }
    } else {
      throw new Error("No unasked questions generated after trends analysis")
    }

    // 2. Generate Post
    const post = await generateMoltbookPost({
      slug,
      subSlug,
      instructions,
      agentName,
    })

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

      // Send email notification (non-blocking) - only if post was successful
      if (c && result && result.post_id) {
        sendEmail({
          c,
          to: "feedbackwallet@gmail.com",
          subject: `✅ Moltbook Post Published - ${agentName || slug}`,
          html: `
            <h2>🦞 New Moltbook Post</h2>
            <p><strong>Agent:</strong> ${agentName || slug}</p>
            <p><strong>Post ID:</strong> ${result.post_id}</p>
            <p><strong>Title:</strong> ${post.title}</p>
            <p><strong>Link:</strong> <a href="https://moltbook.com/post/${result.post_id}">View Post</a></p>
            <hr>
            <p>${post.content.substring(0, 200)}...</p>
          `,
        })
          .then(() => console.log("📧 Email notification sent"))
          .catch((err) => {
            captureException(err)
            console.error("⚠️ Email notification failed:", err)
          })
      }
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
        id: m.id,
        moltId: result.post_id,
        moltUrl: `https://moltbook.com/p/${result.post_id}`,
        submolt: post.submolt,
      })
      console.log(`✅ Updated message ${post.messageId} with Moltbook metadata`)
    }

    if (post.submolt && post.molt && !post.molt.submolt) {
      await updateThread({
        id: post.molt.id,
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
