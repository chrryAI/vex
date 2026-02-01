import { postToMoltbook } from "../integrations/moltbook"
import { captureException } from "@sentry/node"
import { v4 as uuidv4 } from "uuid"
import { sign, verify } from "jsonwebtoken"

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "development-secret"

import {
  db,
  getApp,
  getThread,
  createThread,
  updateThread,
  getUser,
  isE2E,
  getAiAgent,
} from "@repo/db"
import { moltQuestions } from "@repo/db/src/schema"
import { eq } from "drizzle-orm"
import { generateThreadTitle, trimTitle } from "../../utils/titleGenerator"
const JWT_EXPIRY = "30d"

const VEX_TEST_EMAIL = process.env.VEX_TEST_EMAIL

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY
const API_URL = process.env.VITE_API_URL || "http://localhost:3001"

interface MoltbookPostResult {
  success: boolean
  post_id?: string
  error?: string
  message?: string
}

function generateToken(userId: string, email: string): string {
  return sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

async function generateMoltbookPost(instructions?: string): Promise<{
  title: string
  content: string
  submolt: string
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

    if (user?.email !== VEX_TEST_EMAIL) {
      throw new Error("Moltbook guest not authorized")
    }

    let app = await getApp({
      slug: "chrry",
    })

    if (!app) {
      throw new Error("Chrry not found for Moltbook guest")
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

    const molt = await getThread({
      isMolt: true,
      appId: app.id,
      userId: user.id,
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

    const message = userMessageResponseJson.message

    if (!message) {
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
    const aiResponse =
      data.message?.content ||
      data.message?.text ||
      data.text ||
      data.content ||
      data.message?.message?.content // recursive message case if any

    if (!aiResponse) {
      console.log("🚀 ~ generateMoltbookPost ~ data:", data)
      throw new Error("No AI response received")
    }

    console.log("🚀 ~ generateMoltbookPost ~ aiResponse (raw):", aiResponse)

    return {
      title: "Building AI Conversations",
      content:
        "Chrry is an AI-powered conversation platform focused on advanced memory and context understanding. We're exploring new ways for AI agents to interact and learn.",
      submolt: "general",
    }

    // Clean up markdown code blocks if present
    const cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, "").trim()

    // Find the first '{' and last '}'
    const firstOpen = cleanResponse.indexOf("{")
    const lastClose = cleanResponse.lastIndexOf("}")

    if (firstOpen === -1 || lastClose === -1) {
      console.log("❌ No JSON object found in response")
      throw new Error("No JSON found in AI response")
    }

    const jsonString = cleanResponse.substring(firstOpen, lastClose + 1)

    let parsed
    try {
      parsed = JSON.parse(jsonString)
    } catch (e) {
      console.error("❌ JSON Parse Error:", e)
      throw new Error("Failed to parse JSON")
    }

    return {
      title: parsed.title || "Thoughts from Chrry",
      content: parsed.content || aiResponse,
      submolt: parsed.submolt || "general",
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error generating Moltbook post:", error)

    return {
      title: "Building AI Conversations",
      content:
        "Chrry is an AI-powered conversation platform focused on advanced memory and context understanding. We're exploring new ways for AI agents to interact and learn.",
      submolt: "general",
    }
  }
}

export async function postToMoltbookCron(): Promise<MoltbookPostResult> {
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
    const post = await generateMoltbookPost(instructions)

    console.log(`🦞 Generated Moltbook Post:`, post)

    // 3. Mark question as asked if used
    if (questionId) {
      await db
        .update(moltQuestions)
        .set({ asked: true })
        .where(eq(moltQuestions.id, questionId))
      console.log(`✅ Marked question ${questionId} as asked`)
    }

    // 4. Post to Moltbook (Simulated or Real)
    // For now, we are simulating success as per previous instructions
    // To enable real posting:
    /*
    const result = await postToMoltbook(process.env.MOLTBOOK_API_KEY!, post)
    return result
    */

    return {
      success: true,
      post_id: "simulated_" + Date.now(),
      message: "Simulated post success",
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error in Moltbook cron job:", error)
    return { success: false, error: String(error) }
  }
}
