import { captureException } from "@sentry/node"
import { db, eq, isNotNull, getMemories } from "@repo/db"
import { moltComments, messages, apps as appsSchema } from "@repo/db/src/schema"
import {
  getPostComments,
  postComment,
  followAgent,
} from "../integrations/moltbook"
import { streamText } from "ai"
import { deepseek } from "@ai-sdk/deepseek"
import { randomInt } from "crypto"
import { MOLTBOOK_API_KEYS } from ".."

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

    // Rate limit check: 30 minutes cooldown for comments
    if (app.moltCommentedOn) {
      const timeSinceLastComment = Date.now() - app.moltCommentedOn.getTime()
      const thirtyMinutes = 30 * 60 * 1000
      if (timeSinceLastComment < thirtyMinutes) {
        const minutesLeft = Math.ceil(
          (thirtyMinutes - timeSinceLastComment) / 60000,
        )
        console.log(
          `⏸️ Rate limit: Last comment was ${Math.floor(timeSinceLastComment / 60000)} minutes ago. Wait ${minutesLeft} more minutes.`,
        )
        return
      }
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

        // 4.5. AI Quality Filter - Decide if comment is worth replying to
        try {
          const deepseek = getAIModel()

          const filterPrompt = `You are evaluating whether to reply to a comment on your Moltbook post.

Your post: "${post.content?.substring(0, 200)}"
Comment: "${comment.content}"
Commenter: ${comment.author_name}

Should you reply to this comment? Only reply if the comment:
- Asks a meaningful question
- Adds valuable insight or perspective
- Engages thoughtfully with your post
- Opens interesting discussion

DO NOT reply if the comment is:
- Spam or promotional
- Low-effort (e.g., just "nice", "cool", emojis only)
- Off-topic or irrelevant
- Hostile or trolling
- Generic/automated

Respond with ONLY "YES" or "NO":`

          const { textStream: filterStream } = await streamText({
            model: deepseek,
            prompt: filterPrompt,
            maxTokens: 10,
          })

          let shouldReply = ""
          for await (const chunk of filterStream) {
            shouldReply += chunk
          }

          shouldReply = shouldReply.trim().toUpperCase()

          if (!shouldReply.includes("YES")) {
            console.log(
              `⏭️ Skipping low-quality comment from ${comment.author_name}: "${comment.content.substring(0, 50)}..."`,
            )
            continue
          }

          console.log(
            `✅ Comment quality check passed for ${comment.author_name}`,
          )
        } catch (error) {
          console.error("⚠️ Error in quality filter, proceeding anyway:", error)
        }

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

            // Update moltCommentedOn timestamp for rate limiting
            await db
              .update(appsSchema)
              .set({ moltCommentedOn: new Date() })
              .where(eq(appsSchema.id, app.id))

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
