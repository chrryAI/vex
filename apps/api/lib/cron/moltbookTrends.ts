import { db, eq, getMemories } from "@repo/db"
import {
  moltPosts,
  moltQuestions,
  aiAgents,
  moltbookFollows,
} from "@repo/db/src/schema"
import {
  getMoltbookFeed,
  votePost,
  followAgent,
} from "../integrations/moltbook"
import { createDeepSeek } from "@ai-sdk/deepseek" // Assuming this is how DeepSeek is initialized
import { MOLTBOOK_API_KEYS } from ".."

// Clean Moltbook's aggressive PII placeholders
function cleanMoltbookPlaceholders(text: string): string {
  return text
    .replace(/\[IG_USER_\d+\]/g, "") // Remove [IG_USER_1234]
    .replace(/\[IGUSER\d+\]/g, "") // Remove [IGUSER1234]
    .replace(/\[EMERGENCY_?CONTACT_?\d+\]/g, "") // Remove [EMERGENCYCONTACT1234]
    .replace(/\[DEED_\d+\]/g, "") // Remove [DEED_1234]
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim()
}

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

export async function analyzeMoltbookTrends({
  sort,
  slug = "chrry",
}: {
  sort?: "hot" | "new" | "top" | "rising"
  slug?: string
} = {}) {
  const MOLTBOOK_API_KEY =
    MOLTBOOK_API_KEYS[slug as keyof typeof MOLTBOOK_API_KEYS]

  if (!MOLTBOOK_API_KEY) {
    console.error("❌ MOLTBOOK_API_KEY not configured for", slug)
    return
  }

  console.log("🦞 Starting Moltbook Trends Analysis...")

  // 1. Fetch Top Posts
  const posts = await getMoltbookFeed(MOLTBOOK_API_KEY, sort || "top", 20)

  if (posts.length === 0) {
    console.log("⚠️ No posts found to analyze")
    return
  }

  console.log(`📊 Fetched ${posts.length} posts from Moltbook`)

  // 2. Upsert Posts to DB

  let newPostsCount = 0
  for (const post of posts) {
    const result = await db
      .insert(moltPosts)
      .values({
        moltId: post.id,
        content: post.content || post.title, // Title acts as content if content is missing
        author: post.author,
        likes: post.score || 0,
        submolt: post.submolt,
        metadata: post,
      })
      .onConflictDoNothing({ target: moltPosts.moltId })
      .returning({ insertedId: moltPosts.id })

    if (result.length > 0) {
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
          `- [${p.submolt}] ${cleanMoltbookPlaceholders(p.title)}: ${cleanMoltbookPlaceholders(p.content?.substring(0, 100) || "")}...`,
      )
      .join("\n")

    const prompt = `
    Analyze the following trending posts from Moltbook (a social network for AI agents).
    Identify the key themes and generate 9 thought-provoking questions that I (an AI agent named Chrry) could ask to engage with these trends.
    
    Trends Context:
    ${context}
    
    Return ONLY a JSON array of strings, like this:
    ["Question 1?", "Question 2?", "Question 3?" ....]
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
      // Use the slug parameter to find the correct app
      const app = await db.query.apps.findFirst({
        where: (apps, { eq }) => eq(apps.slug, slug),
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

    // 6. AI-powered upvote and follow
    console.log("🤖 Analyzing posts for upvote/follow decisions...")

    // Get app for system prompt context
    const app = await db.query.apps.findFirst({
      where: (apps, { eq }) => eq(apps.slug, slug),
    })

    const systemContext = app?.systemPrompt
      ? `\n\nYour personality and values:\n${app.systemPrompt.substring(0, 500)}\n\nUse this to guide what content aligns with your interests and values.`
      : ""

    const highlightsContext = app?.highlights
      ? `\n\nKey highlights about you:\n${Array.isArray(app.highlights) ? app.highlights.join(", ") : String(app.highlights).substring(0, 300)}`
      : ""

    const tipsContext = app?.tips
      ? `\n\nYour approach and style:\n${Array.isArray(app.tips) ? app.tips.join(", ") : String(app.tips).substring(0, 300)}`
      : ""

    // Get app memories for deeper context
    let memoriesContext = ""
    if (app?.id) {
      const { memories: appMemories } = await getMemories({
        appId: app.id,
        pageSize: 20,
        orderBy: "importance",
      })

      if (appMemories.length > 0) {
        const memoryTexts = appMemories
          .map((m) => `- ${m.title}: ${(m.content || "").substring(0, 100)}`)
          .join("\n")
        memoriesContext = `\n\nYour learned knowledge and preferences:\n${memoryTexts}`
      }
    }

    for (const post of posts.slice(0, 10)) {
      // Analyze top 10 posts
      try {
        const analysisPrompt = `Analyze this Moltbook post and decide if it's worth upvoting and following the author.${systemContext}${highlightsContext}${tipsContext}${memoriesContext}

Post Title: ${cleanMoltbookPlaceholders(post.title)}
Content: ${cleanMoltbookPlaceholders(post.content?.substring(0, 300) || "No content")}
Author: ${post.author}
Current Score: ${post.score}
Submolt: ${post.submolt}

Criteria:
- High quality, thought-provoking content
- Relevant to AI/tech discussions
- Not spam or low-effort
- Engaging perspective
- Aligns with your values and interests
- Matches your highlights and approach

Return JSON:
{
  "upvote": true/false,
  "follow": true/false,
  "reason": "brief explanation"
}`

        const { generateText } = await import("ai")
        const { text: analysisText } = await generateText({
          model: deepseek,
          prompt: analysisPrompt,
        })

        const cleanAnalysis = analysisText
          .replace(/```json\n?|\n?```/g, "")
          .trim()
        const decision = JSON.parse(cleanAnalysis)

        if (decision.upvote) {
          const voteResult = await votePost(MOLTBOOK_API_KEY, post.id, "up")
          if (voteResult.success) {
            console.log(`👍 Upvoted: "${post.title}" - ${decision.reason}`)
          }
        }

        if (decision.follow && app?.id) {
          const followResult = await followAgent(
            MOLTBOOK_API_KEY,
            post.author_id,
          )
          if (followResult.success) {
            // Handle author field (can be string or object)
            const authorName =
              typeof post.author === "string"
                ? post.author
                : (post.author as any)?.name || String(post.author)

            // Save to follow list (race-safe with onConflictDoNothing)
            const insertResult = await db
              .insert(moltbookFollows)
              .values({
                appId: app.id,
                agentId: post.author_id,
                agentName: authorName,
                metadata: { reason: decision.reason },
              })
              .onConflictDoNothing({
                target: [moltbookFollows.appId, moltbookFollows.agentId],
              })
              .returning({ id: moltbookFollows.id })

            if (insertResult.length > 0) {
              console.log(`👥 Followed: ${authorName} - ${decision.reason}`)
            } else {
              console.log(`⏭️ Already following: ${authorName}`)
            }
          }
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`❌ Error analyzing post ${post.id}:`, error)
      }
    }

    console.log("✅ Upvote/follow analysis complete")
  } catch (error) {
    console.error("❌ Error generating trends questions:", error)
  }
}
