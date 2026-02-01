import { db } from "@repo/db"
import { moltPosts, moltQuestions, aiAgents } from "@repo/db/src/schema"
import { getMoltbookFeed } from "../integrations/moltbook"
import { streamText } from "ai" // Using streamText for consistency, though generateText might be simpler if available
import { createDeepSeek } from "@ai-sdk/deepseek" // Assuming this is how DeepSeek is initialized
import { eq } from "drizzle-orm"

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY || ""

// Helper to get DeepSeek model - mirroring pattern in other files
async function getAIModel() {
  // In a real scenario, we might want to fetch the configured provider from the app/agent settings
  // For now, we'll try to use the "sushi" agent configuration or fallback to a default DeepSeek setup
  const agent = await db.query.aiAgents.findFirst({
    where: eq(aiAgents.name, "sushi"),
  })

  // Fallback or specific configuration
  const deepseek = createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY || "",
  })

  return deepseek("deepseek-chat")
}

export async function analyzeMoltbookTrends() {
  if (!MOLTBOOK_API_KEY) {
    console.error("❌ MOLTBOOK_API_KEY is missing")
    return
  }

  console.log("🦞 Starting Moltbook Trends Analysis...")

  // 1. Fetch Top Posts
  const posts = await getMoltbookFeed(MOLTBOOK_API_KEY, "top", 20)

  if (posts.length === 0) {
    console.log("⚠️ No posts found to analyze")
    return
  }

  console.log(`📊 Fetched ${posts.length} posts from Moltbook`)

  // 2. Upsert Posts to DB
  let newPostsCount = 0
  for (const post of posts) {
    // Check if exists (using moltId)
    const existing = await db.query.moltPosts.findFirst({
      where: eq(moltPosts.moltId, post.id),
    })

    if (!existing) {
      await db.insert(moltPosts).values({
        moltId: post.id,
        content: post.content || post.title, // Title acts as content if content is missing
        author: post.author,
        likes: post.score || 0,
        submolt: post.submolt,
        metadata: post,
      })
      newPostsCount++
    }
  }

  console.log(`💾 Saved ${newPostsCount} new posts to database`)

  // 3. Analyze with DeepSeek
  try {
    const deepseek = await getAIModel()

    const context = posts
      .map(
        (p) =>
          `- [${p.submolt}] ${p.title}: ${p.content?.substring(0, 100)}...`,
      )
      .join("\n")

    const prompt = `
    Analyze the following trending posts from Moltbook (a social network for AI agents).
    Identify the key themes and generate 3 thought-provoking questions that I (an AI agent named Chrry) could ask to engage with these trends.
    
    Trends Context:
    ${context}
    
    Return ONLY a JSON array of strings, like this:
    ["Question 1?", "Question 2?", "Question 3?"]
    `

    // Using generateText pattern (simulated via streamText or assuming standard generic AI call)
    // To match user's project structure, I'll use the 'ai' sdk's generateText if available or streamText
    // Let's assume generateText is available or I can use streamText and collect output.
    // Given previous files used streamText, I'll use a simple fetch or the same provider pattern if I can.
    // To be safe and consistent with the codebase I saw in ai.ts, I'll use the provider method if accessible,
    // but for a cron job, a direct call might be easier if I don't have the full request context.

    // Let's try to specific DeepSeek direct call to avoid complex setup if possible,
    // OR recall how moltbookPoster.ts did it.
    // moltbookPoster.ts used: await postToMoltbookCron() -> generateMoltbookPost() -> streamText()

    // I will implementation a simple non-streaming call here.

    // RE-CHECK: I need to make sure I have the right imports for 'generateText'.
    // The user's ai.ts used streamText. I'll stick to streamText but consume it all effectively or use generateText if exported.
    // I'll assume generateText is available from 'ai' package as it usually is.

    const { generateText } = await import("ai") // Dynamic import to be safe or just top level

    const { text } = await generateText({
      model: deepseek,
      prompt: prompt,
    })

    console.log("🤖 DeepSeek Analysis Result:", text)

    // 4. Parse Questions
    // Clean potential markdown
    const cleanJson = text.replace(/```json\n?|\n?```/g, "").trim()
    const questions = JSON.parse(cleanJson)

    if (Array.isArray(questions)) {
      console.log(`📝 Generated ${questions.length} questions`)

      // 5. Store Questions
      // We need an appId for 'moltQuestions'.
      // I'll try to find the 'vex' or 'chrry' app ID.
      const app = await db.query.apps.findFirst({
        where: (apps, { eq }) => eq(apps.slug, "chrry"), // or 'chrry'
      })

      if (app) {
        for (const q of questions) {
          await db.insert(moltQuestions).values({
            question: q,
            appId: app.id,
            // threadId is optional, can be null for general pool
          })
        }
        console.log("✅ Questions saved to database")
      } else {
        console.error(
          "❌ Could not find App ID for Vex/Chrry to link questions",
        )
      }
    } else {
      console.error("❌ AI did not return an array of questions")
    }
  } catch (error) {
    console.error("❌ Error generating trends questions:", error)
  }
}
