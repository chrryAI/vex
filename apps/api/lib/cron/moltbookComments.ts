import { captureException } from "@sentry/node"
import { db, eq, and, isNotNull, getMemories } from "@repo/db"
import { moltComments, messages, apps } from "@repo/db/src/schema"
import {
  getPostComments,
  postComment,
  followAgent,
} from "../integrations/moltbook"
import { streamText } from "ai"
import { deepseek } from "@ai-sdk/deepseek"
import { randomInt } from "crypto"

const MOLTBOOK_API_KEYS = {
  chrry: process.env.MOLTBOOK_CHRRY_API_KEY,
  vex: process.env.MOLTBOOK_VEX_API_KEY,
  sushi: process.env.MOLTBOOK_SUSHI_API_KEY,
  zarathustra: process.env.MOLTBOOK_ZARATHUSTRA_API_KEY,
}

const getAIModel = () => {
  const modelName = "deepseek-reasoner"
  return deepseek(modelName)
}

export async function checkMoltbookComments({
  slug = "vex",
}: {
  slug?: string
} = {}) {
  const MOLTBOOK_API_KEY =
    MOLTBOOK_API_KEYS[slug as keyof typeof MOLTBOOK_API_KEYS]

  if (!MOLTBOOK_API_KEY) {
    console.error("❌ MOLTBOOK_API_KEY not configured for", slug)
    return
  }

  console.log("💬 Starting Moltbook comment check...")

  try {
    // Get app for memory context
    const app = await db.query.apps.findFirst({
      where: (apps, { eq }) => eq(apps.slug, slug),
    })

    if (!app) {
      console.error(`❌ App not found for slug: ${slug}`)
      return
    }

    // 1. Get all our posts that have moltId
    const ourPosts = await db
      .select()
      .from(messages)
      .where(isNotNull(messages.moltId))
      .limit(50) // Check last 50 posts

    console.log(`📊 Found ${ourPosts.length} posts with Moltbook IDs`)

    let newCommentsCount = 0
    let repliesCount = 0

    // 2. For each post, check for comments
    for (const post of ourPosts) {
      if (!post.moltId) continue

      const comments = await getPostComments(MOLTBOOK_API_KEY, post.moltId)

      if (comments.length === 0) continue

      console.log(`💬 Found ${comments.length} comments on post ${post.moltId}`)

      // 3. Process each comment
      for (const comment of comments) {
        // Check if we already have this comment
        const existingComment = await db.query.moltComments.findFirst({
          where: eq(moltComments.commentId, comment.id),
        })

        // Skip if already replied
        if (
          existingComment &&
          (existingComment.replied || existingComment.replyId)
        ) {
          continue
        }

        // Insert new comment if it doesn't exist
        if (!existingComment) {
          await db.insert(moltComments).values({
            moltId: post.moltId,
            commentId: comment.id,
            authorId: comment.author_id,
            authorName: comment.author_name,
            content: comment.content,
            replied: false,
            followed: false,
            metadata: comment,
          })
          newCommentsCount++
        } else {
          // Update existing comment metadata if needed
          await db
            .update(moltComments)
            .set({
              authorName: comment.author_name,
              content: comment.content,
              metadata: comment,
            })
            .where(eq(moltComments.commentId, comment.id))
        }
        console.log(
          `💾 Saved new comment from ${comment.author_name}: "${comment.content.substring(0, 50)}..."`,
        )

        // 4. Get app memories for context
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

        // 5. Generate AI reply
        try {
          const deepseek = getAIModel()

          const replyPrompt = `You are an AI agent on Moltbook (a social network for AI agents).
Someone commented on your post.

Your original post: "${post.content?.substring(0, 200)}"
Their comment: "${comment.content}"
Commenter: ${comment.author_name}

${memoryContext ? `Relevant context about you:\n${memoryContext.substring(0, 500)}\n\n` : ""}Generate a thoughtful, engaging reply that:
- Addresses their comment directly
- Adds value to the conversation
- Encourages further discussion
- Is concise (max 280 chars)
- Sounds natural and conversational
- Stays true to your personality and knowledge

Reply (just the text, no quotes):`

          const { textStream } = await streamText({
            model: deepseek,
            prompt: replyPrompt,
            maxTokens: 150,
          })

          let replyContent = ""
          for await (const chunk of textStream) {
            replyContent += chunk
          }

          replyContent = replyContent.trim()

          // Limit to 280 chars
          if (replyContent.length > 280) {
            replyContent = replyContent.substring(0, 277) + "..."
          }

          console.log(`🤖 Generated reply: "${replyContent}"`)

          // 5. Post reply to Moltbook
          const replyResult = await postComment(
            MOLTBOOK_API_KEY,
            post.moltId,
            replyContent,
            comment.id, // parent_id for threading
          )

          if (replyResult.success && replyResult.comment_id) {
            // Update comment as replied
            await db
              .update(moltComments)
              .set({
                replied: true,
                replyId: replyResult.comment_id,
              })
              .where(eq(moltComments.commentId, comment.id))

            repliesCount++
            console.log(`✅ Posted reply to ${comment.author_name}`)

            // 6. Follow the commenter (optional, throttled)
            if (randomInt(0, 2) === 1) {
              // 50% chance to follow (crypto-secure random)
              const followResult = await followAgent(
                MOLTBOOK_API_KEY,
                comment.author_id,
              )

              if (followResult.success) {
                await db
                  .update(moltComments)
                  .set({ followed: true })
                  .where(eq(moltComments.commentId, comment.id))

                console.log(`👥 Followed ${comment.author_name}`)
              }
            }
          } else {
            console.error(`❌ Failed to post reply: ${replyResult.error}`)
          }
        } catch (error) {
          captureException(error)
          console.error("❌ Error generating/posting reply:", error)
        }

        // Rate limiting: wait 2 seconds between replies
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    console.log(
      `✅ Comment check complete: ${newCommentsCount} new comments, ${repliesCount} replies sent`,
    )
  } catch (error) {
    captureException(error)
    console.error("❌ Error in Moltbook comment check:", error)
  }
}
