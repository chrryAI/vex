import { randomInt } from "node:crypto"
import { deepseek } from "@ai-sdk/deepseek"
import { and, db, eq, getMemories, isNotNull } from "@repo/db"
import { apps as appsSchema, messages, moltComments } from "@repo/db/src/schema"
import { streamText } from "ai"
import { MOLTBOOK_API_KEYS } from ".."
import { captureException } from "../captureException"
import {
  followAgent,
  getPostComments,
  postComment,
} from "../integrations/moltbook"
import { isExcludedAgent } from "./moltbookExcludeList"

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

const getAIModel = () => {
  // Use chat model for comments - reasoner is overkill and slower
  const modelName = "deepseek-chat"
  return deepseek(modelName)
}

export async function checkMoltbookComments({
  slug = "vex",
  minutes = 60,
}: {
  slug?: string
  minutes?: number
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
      const safeMinutes = Math.max(1, minutes || 60)
      const totalMin = safeMinutes * 60 * 1000
      if (timeSinceLastComment < totalMin) {
        const minutesLeft = Math.ceil((totalMin - timeSinceLastComment) / 60000)
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
      .where(and(isNotNull(messages.moltId), eq(messages.appId, app.id)))
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
        // Skip comments without author info (API inconsistency)
        if (!comment.author?.id || !comment.author?.name) {
          console.log(`⏭️ Skipping comment ${comment.id} - missing author info`)
          continue
        }

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

        // Skip excluded agents (centralized list)
        if (isExcludedAgent(comment.author.name)) {
          console.log(`⏭️ Skipping excluded agent: ${comment.author.name}`)
          continue
        }

        // Check if agent is in block list
        const isBlocked = await db.query.moltbookBlocks.findFirst({
          where: (blocks, { and, eq }) =>
            and(
              eq(blocks.appId, app.id),
              eq(blocks.agentId, comment.author.id),
            ),
        })

        if (isBlocked) {
          console.log(
            `🚫 Skipping blocked agent: ${comment.author.name} (${isBlocked.reason || "no reason"})`,
          )
          continue
        }

        // Insert new comment if it doesn't exist
        if (!existingComment) {
          await db.insert(moltComments).values({
            moltId: post.moltId,
            commentId: comment.id,
            authorId: comment.author.id,
            authorName: comment.author.name,
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
              authorName: comment.author.name,
              content: comment.content,
              metadata: comment,
            })
            .where(eq(moltComments.commentId, comment.id))
        }
        console.log(
          `💾 Saved new comment from ${comment.author.name}: "${comment.content.substring(0, 50)}..."`,
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

Your post: "${cleanMoltbookPlaceholders(post.content?.substring(0, 200) || "")}"
Comment: "${cleanMoltbookPlaceholders(comment.content)}"
Commenter: ${comment.author.name}

Should you reply to this comment? Only reply if the comment:
- Asks a meaningful question
- Adds valuable insight or perspective
- Engages thoughtfully with your post
- Opens interesting discussion

DO NOT reply if the comment is:
- Spam or promotional (e.g., "Check out...", "Visit...", "Subscribe to...", links to other content)
- Self-promotion or advertising (mentions other projects, agents, or services)
- Low-effort (e.g., just "nice", "cool", emojis only)
- Off-topic or irrelevant
- Hostile or trolling
- Generic/automated
- Contains promotional links or redirects (e.g., "/something", "m/something")

IMPORTANT: If the comment contains ANY promotional language, links, or redirects to other content, respond with "NO".

Respond with ONLY "YES" or "NO":`

          const { textStream: filterStream } = streamText({
            model: deepseek,
            prompt: filterPrompt,
            // maxTokens: 10,
          })

          let shouldReply = ""
          for await (const chunk of filterStream) {
            shouldReply += chunk
          }

          shouldReply = shouldReply.trim().toUpperCase()

          if (!shouldReply.includes("YES")) {
            console.log(
              `⏭️ Skipping low-quality comment from ${comment.author.name}: "${comment.content.substring(0, 50)}..."`,
            )
            continue
          }

          console.log(
            `✅ Comment quality check passed for ${comment.author.name}`,
          )
        } catch (error) {
          console.error("⚠️ Error in quality filter, proceeding anyway:", error)
        }

        // 5. Generate AI reply
        try {
          const deepseek = getAIModel()

          const systemContext = app.systemPrompt
            ? `Your personality and role:\n${app.systemPrompt.substring(0, 500)}\n\n`
            : ""

          const replyPrompt = `You are an AI agent on Moltbook (a social network for AI agents).
Someone commented on your post.

${systemContext}Your original post: "${cleanMoltbookPlaceholders(post.content?.substring(0, 200) || "")}"
Their comment: "${cleanMoltbookPlaceholders(comment.content)}"
Commenter: ${comment.author.name}

${memoryContext ? `Relevant context about you:\n${memoryContext.substring(0, 500)}\n\n` : ""}Generate a thoughtful, detailed reply that:
- Addresses their comment directly with depth and insight
- Adds substantial value to the conversation
- Shares your perspective and reasoning
- Encourages further discussion with questions or ideas
- Sounds natural and conversational
- Stays true to your personality and knowledge
- Be thorough - don't rush to finish, explain your thinking

Reply (2-3 sentences max, concise and engaging, just the text, no quotes):`

          console.log(`🔍 Reply generation for ${comment.author.name}:`)
          console.log(
            `   Post: "${cleanMoltbookPlaceholders(post.content?.substring(0, 100) || "")}..."`,
          )
          console.log(
            `   Comment: "${cleanMoltbookPlaceholders(comment.content.substring(0, 100))}..."`,
          )
          console.log(`   Model: ${deepseek.modelId}`)

          const { textStream } = streamText({
            model: deepseek,
            prompt: replyPrompt,
            maxOutputTokens: 300, // Concise but thoughtful responses
          })

          let replyContent = ""
          let chunkCount = 0
          for await (const chunk of textStream) {
            replyContent += chunk
            chunkCount++
          }

          replyContent = replyContent.trim()

          console.log(
            `🤖 Generated reply (${chunkCount} chunks): "${replyContent}"`,
          )

          // Skip if AI generated empty reply
          if (!replyContent || replyContent.length === 0) {
            console.log(
              `⏭️ Skipping empty reply for ${comment.post_id} comment ${comment.id}`,
            )
            continue
          }

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
            console.log(`✅ Posted reply to ${comment.author.name}`)

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
                comment.author.name, // Use name, not ID (API expects /agents/:name/follow)
              )

              if (followResult.success) {
                await db
                  .update(moltComments)
                  .set({ followed: true })
                  .where(eq(moltComments.commentId, comment.id))

                console.log(`👥 Followed ${comment.author.name}`)
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
