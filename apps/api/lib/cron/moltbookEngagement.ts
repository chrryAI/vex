import { captureException } from "@sentry/node"
import { db, getMemories } from "@repo/db"
import { moltComments } from "@repo/db/src/schema"
import { getMoltbookFeed, postComment } from "../integrations/moltbook"
import { sendEmail } from "../sendEmail"
import { streamText } from "ai"
import { deepseek } from "@ai-sdk/deepseek"
import { randomInt } from "crypto"
import { isDevelopment, MOLTBOOK_API_KEYS } from ".."
import type { Context } from "hono"

const getAIModel = () => {
  const modelName = "deepseek-reasoner"
  return deepseek(modelName)
}

export async function engageWithMoltbookPosts({
  slug = "vex",
  c,
}: {
  slug?: string
  c?: Context
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
    const commentedPosts: typeof selectedPosts = [] // Track posts that actually received comments

    // 4. Comment on each selected post
    for (const post of selectedPosts.filter((post) => !!post)) {
      try {
        // Skip if this is our own post (prevent self-commenting)
        // Note: Comparing by author name until we add app.moltbookAgentId field
        if (post.author === app?.name || post.author === slug) {
          console.log(`⏭️ Skipping own post: "${post.title}"`)
          continue
        }

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
          // maxTokens: 150,
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
          // Save to database for tracking
          if (commentResult.comment_id && app?.id) {
            try {
              await db.insert(moltComments).values({
                moltId: post.id,
                commentId: commentResult.comment_id,
                // authorId should be Moltbook agent ID, not internal app.id
                // Using app name as temporary identifier until we add app.moltbookAgentId field
                authorId: app.name || slug, // Moltbook agent name/identifier
                authorName: app.name || slug,
                content: commentContent,
                replied: false, // This is a proactive comment, not a reply
                followed: false,
                metadata: {
                  type: "proactive_engagement",
                  postTitle: post.title,
                  timestamp: new Date().toISOString(),
                  internalAppId: app.id, // Store internal UUID in metadata
                },
              })
              console.log(`💾 Saved engagement comment to DB`)
            } catch (dbError) {
              // Don't fail the whole process if DB save fails
              console.error(`⚠️ Failed to save comment to DB:`, dbError)
            }
          }

          commentsPosted++
          commentedPosts.push(post) // Track this post as successfully commented
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

    // Send email notification (non-blocking) - only if comments were posted
    if (c && commentedPosts.length > 0) {
      sendEmail({
        c,
        to: "feedbackwallet@gmail.com",
        subject: `💬 Moltbook Engagement Activity - ${app?.name || slug}`,
        html: `
          <h2>🎯 Moltbook Engagement Report</h2>
          <p><strong>Agent:</strong> ${app?.name || slug}</p>
          <p><strong>Comments Posted:</strong> ${commentedPosts.length}/${selectedPosts.length}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <hr>
          <h3>Engaged Posts:</h3>
          <ul>
            ${commentedPosts
              .map(
                (post) =>
                  post &&
                  `<li><strong>${post.title}</strong> by ${post.author} (Score: ${post.score})</li>`,
              )
              .join("")}
          </ul>
        `,
      })
        .then(() => console.log("📧 Engagement email notification sent"))
        .catch((err) => {
          captureException(err)
          console.error("⚠️ Engagement email notification failed:", err)
        })
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error in Moltbook engagement:", error)
  }
}
