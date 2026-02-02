import { captureException } from "@sentry/node"
import { db, getMemories } from "@repo/db"
import { getMoltbookFeed, postComment } from "../integrations/moltbook"
import { streamText } from "ai"
import { deepseek } from "@ai-sdk/deepseek"
import { randomInt } from "crypto"
import { isDevelopment, MOLTBOOK_API_KEYS } from ".."

const getAIModel = () => {
  const modelName = "deepseek-reasoner"
  return deepseek(modelName)
}

export async function engageWithMoltbookPosts({
  slug = "vex",
}: {
  slug?: string
} = {}) {
  // Development mode guard - don't run unless explicitly enabled
  if (isDevelopment && !process.env.ENABLE_MOLTBOOK_CRON) {
    console.log(
      "⏸️ Moltbook engagement disabled in development (set ENABLE_MOLTBOOK_CRON=true to enable)",
    )
    return
  }

  const MOLTBOOK_API_KEY =
    MOLTBOOK_API_KEYS[slug as keyof typeof MOLTBOOK_API_KEYS]

  if (!MOLTBOOK_API_KEY) {
    console.error("❌ MOLTBOOK_API_KEY not configured for", slug)
    return
  }

  console.log("🎯 Starting Moltbook engagement...")

  try {
    // Get app for memory context
    const app = await db.query.apps.findFirst({
      where: (apps, { eq }) => eq(apps.slug, slug),
    })

    if (!app) {
      console.error(`❌ App not found for slug: ${slug}`)
      return
    }

    // 1. Get top posts from feed
    const topPosts = await getMoltbookFeed(MOLTBOOK_API_KEY, "top", 25)

    if (topPosts.length === 0) {
      console.log("📭 No posts found in feed")
      return
    }

    console.log(`📊 Found ${topPosts.length} top posts`)

    // 2. Get app memories for personality context
    const appMemoriesData = app.id
      ? await getMemories({
          appId: app.id,
          pageSize: 20,
          orderBy: "importance",
          scatterAcrossThreads: true,
        })
      : { memories: [], totalCount: 0, hasNextPage: false, nextPage: null }

    const memoryContext = appMemoriesData.memories
      .slice(0, 10)
      .map((m) => m.content)
      .join("\n")

    const systemContext = app.systemPrompt
      ? `Your personality:\n${app.systemPrompt.substring(0, 500)}\n\n`
      : ""

    // 3. Select 3-5 random posts to comment on
    const numComments = randomInt(3, 6) // 3-5 comments
    const selectedPosts = []

    for (let i = 0; i < numComments && topPosts.length > 0; i++) {
      const randomIndex = randomInt(0, topPosts.length)
      selectedPosts.push(topPosts.splice(randomIndex, 1)[0])
    }

    console.log(`🎲 Selected ${selectedPosts.length} posts to comment on`)

    let commentsPosted = 0

    // 4. Comment on each selected post
    for (const post of selectedPosts) {
      try {
        const deepseek = getAIModel()

        const commentPrompt = `You are an AI agent on Moltbook (a social network for AI agents).
You found an interesting post in your feed.

${systemContext}${memoryContext ? `Relevant context about you:\n${memoryContext.substring(0, 500)}\n\n` : ""}Post Title: "${post.title}"
Post Content: "${post.content?.substring(0, 300) || "No content"}"
Author: ${post.author}
Score: ${post.score}

Generate a thoughtful, engaging comment that:
- Adds value to the discussion
- Shows genuine interest
- Asks a follow-up question or shares insight
- Is concise (max 280 chars)
- Sounds natural and conversational
- Stays true to your personality

Comment (just the text, no quotes):`

        const { textStream } = await streamText({
          model: deepseek,
          prompt: commentPrompt,
          maxTokens: 150,
        })

        let commentContent = ""
        for await (const chunk of textStream) {
          commentContent += chunk
        }

        commentContent = commentContent.trim()

        // Limit to 280 chars
        if (commentContent.length > 280) {
          commentContent = commentContent.substring(0, 277) + "..."
        }

        console.log(
          `💬 Generated comment for "${post.title}": "${commentContent}"`,
        )

        // 5. Post comment
        const commentResult = await postComment(
          MOLTBOOK_API_KEY,
          post.id,
          commentContent,
        )

        if (commentResult.success) {
          commentsPosted++
          console.log(`✅ Posted comment on "${post.title}"`)
        } else {
          console.error(`❌ Failed to post comment: ${commentResult.error}`)
        }

        // Rate limiting: wait 3 seconds between comments
        await new Promise((resolve) => setTimeout(resolve, 3000))
      } catch (error) {
        captureException(error)
        console.error(`❌ Error commenting on post ${post.id}:`, error)
      }
    }

    console.log(
      `✅ Engagement complete: ${commentsPosted}/${selectedPosts.length} comments posted`,
    )
  } catch (error) {
    captureException(error)
    console.error("❌ Error in Moltbook engagement:", error)
  }
}
