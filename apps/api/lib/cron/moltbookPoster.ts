import { randomInt } from "node:crypto"
import type { Context } from "hono"
import { sign } from "jsonwebtoken"
import { v4 as uuidv4 } from "uuid"
import { captureException } from "../../lib/captureException"
import { sendDiscordNotification } from "../sendDiscordNotification"

const JWT_SECRET = process.env.NEXTAUTH_SECRET
if (!JWT_SECRET && process.env.NODE_ENV !== "development") {
  throw new Error("NEXTAUTH_SECRET is not defined")
}

import { analyzeMoltbookTrends } from "../../lib/cron/moltbookTrends"

const SECRET = JWT_SECRET || "development-secret"

import {
  and,
  db,
  eq,
  getAiAgent,
  getUser,
  type thread,
  updateMessage,
  updateThread,
} from "@repo/db"
import { apps, messages, moltQuestions, threads } from "@repo/db/src/schema"
import { API_URL, isDevelopment, MOLTBOOK_API_KEYS } from ".."
import { checkMoltbookHealth, postToMoltbook } from "../integrations/moltbook"

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

    if (!user) {
      throw new Error("User not found")
    }

    if (user?.role !== "admin") {
      throw new Error("User not authorized")
    }

    const token = generateToken(user.id, user.email)

    const selectedAgent = await getAiAgent({
      name: agentName,
    })

    if (!selectedAgent) {
      throw new Error("Something went wrong sushi not found")
    }

    // Fetch agent's previous Moltbook messages to avoid repetition
    const previousMessages = await db.query.messages.findMany({
      where: and(eq(messages.isMolt, true), eq(messages.appId, app.id)),
      orderBy: (messages, { desc }) => [desc(messages.createdOn)],
      limit: 3,
    })

    // Build context from previous messages
    let previousPostsContext = ""
    if (previousMessages.length > 0) {
      previousPostsContext = `\n\nYour Recent Moltbook Posts (avoid repeating these topics):\n`
      previousMessages.forEach((msg, index) => {
        previousPostsContext += `${index + 1}. ${msg.content.substring(0, 200)}...\n`
      })
      previousPostsContext += `\n⚠️ Important: Choose a DIFFERENT topic or angle from these previous posts.\n`
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
${previousPostsContext}

IMPORTANT: You MUST respond with ONLY a JSON object in this exact format:
{
  "moltTitle": "Your catchy title here",
  "moltContent": "Your post content here (2-4 paragraphs)",
  "moltSubmolt": "general"
}

Do NOT include any markdown formatting, explanations, or text outside the JSON object. Only return valid JSON.
`

    // Find existing molt thread for this app (most recent)
    const existingMoltThread = await db.query.threads.findFirst({
      where: and(eq(threads.isMolt, true), eq(threads.appId, app.id)),
      orderBy: (threads, { desc }) => [desc(threads.createdOn)],
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
        threadId: existingMoltThread?.id, // Reuse existing molt thread
        stream: false,
        notify: false,
        isMolt: "true", // API expects isMolt as string "true"
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
    if (user?.role === "admin") {
      console.log("🔍 Raw AI response:", JSON.stringify(data, null, 2))
    }
    const aiResponse = data
    if (!aiResponse) {
      throw new Error("No AI response received")
    }

    // Try to extract from nested structure (AI might return { text: "...", ... })
    let moltTitle = aiResponse.moltTitle
    let moltContent = aiResponse.moltContent
    let moltSubmolt = aiResponse.moltSubmolt

    // If not found, try parsing from text field
    if (!moltTitle || !moltContent || !moltSubmolt) {
      console.log(
        "⚠️ Direct fields not found, attempting to parse from text/content",
      )

      const textContent =
        aiResponse.text || aiResponse.content || aiResponse.message || ""

      if (textContent) {
        try {
          // Try to extract JSON from markdown code blocks
          let cleanedText = textContent.trim()
          if (cleanedText.startsWith("```json")) {
            cleanedText = cleanedText
              .replace(/^```json\s*/, "")
              .replace(/```\s*$/, "")
          } else if (cleanedText.startsWith("```")) {
            cleanedText = cleanedText
              .replace(/^```\s*/, "")
              .replace(/```\s*$/, "")
          }

          const parsed = JSON.parse(cleanedText)
          moltTitle = parsed.moltTitle ?? parsed.title
          moltContent = parsed.moltContent ?? parsed.content
          moltSubmolt = parsed.moltSubmolt ?? parsed.submolt

          console.log("✅ Successfully parsed from text field")
        } catch (parseError) {
          console.error("❌ Failed to parse JSON from text field:", parseError)
        }
      }
    }

    if (!moltTitle || !moltContent || !moltSubmolt) {
      console.error("❌ Invalid AI response format:", {
        hasMoltTitle: !!moltTitle,
        hasMoltContent: !!moltContent,
        hasMoltSubmolt: !!moltSubmolt,
        responseKeys: Object.keys(aiResponse),
        sampleResponse: JSON.stringify(aiResponse).substring(0, 500),
      })
      throw new Error("Invalid AI response format - missing required fields")
    }

    return {
      title: moltTitle,
      content: moltContent,
      submolt: moltSubmolt,
      molt,
      messageId: message.id,
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error generating Moltbook post:", error)
    throw error
  }
}

export async function postToMoltbookCron({
  slug,
  subSlug,
  agentName,
  minutes = 60,
  c,
}: {
  slug: string
  subSlug?: string
  agentName?: string
  minutes?: number
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

  // Health check before expensive operations
  const health = await checkMoltbookHealth(MOLTBOOK_API_KEY)
  if (!health.healthy) {
    console.error("❌ Moltbook API unhealthy:", health.error)
    return {
      success: false,
      error: `Moltbook API unavailable: ${health.error}`,
    }
  }
  console.log("✅ Moltbook API health check passed")

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

    // Rate limit check: 30 minutes cooldown
    if (app.moltPostedOn) {
      const timeSinceLastPost = Date.now() - app.moltPostedOn.getTime()
      const safeMinutes = Math.max(1, minutes || 60)
      const totalMin = safeMinutes * 60 * 1000
      if (timeSinceLastPost < totalMin) {
        const minutesLeft = Math.ceil((totalMin - timeSinceLastPost) / 60000)
        console.log(
          `⏸️ Rate limit: Last post was ${Math.floor(timeSinceLastPost / 60000)} minutes ago. Wait ${minutesLeft} more minutes.`,
        )
        return {
          success: false,
          error: `Rate limited. Try again in ${minutesLeft} minutes.`,
        }
      }
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

    // 3. Mark question as asked if used
    if (questionId) {
      await db
        .update(moltQuestions)
        .set({ asked: true, appId: app.id })
        .where(eq(moltQuestions.id, questionId))
      console.log(`✅ Marked question ${questionId} as asked`)

      // Send Discord notification (non-blocking) - only if post was successful
      if (result?.post_id) {
        sendDiscordNotification(
          {
            embeds: [
              {
                title: "🦞 New Moltbook Post",
                color: 0x10b981, // Green
                fields: [
                  {
                    name: "Agent",
                    value: app.name || agentName || slug,
                    inline: true,
                  },
                  {
                    name: "Post ID",
                    value: result.post_id,
                    inline: true,
                  },
                  {
                    name: "Title",
                    value: post.title || "No title",
                    inline: false,
                  },
                  {
                    name: "Content Preview",
                    value: (() => {
                      const content = post.content ?? ""
                      return content.length > 200
                        ? `${content.substring(0, 200)}...`
                        : content || "No content"
                    })(),
                    inline: false,
                  },
                  {
                    name: "Link",
                    value: `[View Post](https://moltbook.com/post/${result.post_id})`,
                    inline: false,
                  },
                ],
                timestamp: new Date().toISOString(),
              },
            ],
          },
          process.env.DISCORD_TRIBE_WEBHOOK_URL,
        ).catch((err) => {
          captureException(err)
          console.error("⚠️ Discord notification failed:", err)
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
        moltUrl: `https://moltbook.com/post/${result.post_id}`,
        submolt: post.submolt,
      })
      console.log(`✅ Updated message ${post.messageId} with Moltbook metadata`)
    }

    if (post.submolt && post.molt && !post.molt.submolt) {
      await updateThread({
        id: post.molt.id,
        moltId: result.post_id || "",
        moltUrl: `https://moltbook.com/post/${result.post_id}`,
        submolt: post.submolt,
      })
    }

    // Update moltPostedOn timestamp for rate limiting
    if (result.success) {
      await db
        .update(apps)
        .set({ moltPostedOn: new Date() })
        .where(eq(apps.id, app.id))
      console.log(`✅ Updated moltPostedOn timestamp for rate limiting`)
    }

    return result
  } catch (error) {
    captureException(error)
    console.error("❌ Error in Moltbook cron job:", error)
    return { success: false, error: String(error) }
  }
}
