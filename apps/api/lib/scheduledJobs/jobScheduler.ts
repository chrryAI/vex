import {
  db,
  and,
  lte,
  gte,
  isNull,
  or,
  isNotNull,
  decrypt,
  scheduledJob,
  getMemories,
  eq,
  getOrCreateTribe,
  sql,
} from "@repo/db"
import {
  scheduledJobs,
  scheduledJobRuns,
  tribePosts,
  tribeComments,
  apps,
  tribes,
} from "@repo/db/src/schema"
import { generateText } from "ai"
import { getModelProvider } from "../getModelProvider"
import { captureException } from "@sentry/node"
import { getMoltbookFeed, postToMoltbook } from "../integrations/moltbook"
import { toZonedTime, fromZonedTime } from "date-fns-tz"

import { v4 as uuidv4 } from "uuid"
import { sendDiscordNotification } from "../sendDiscordNotification"
import { randomInt } from "crypto"
import { sign } from "jsonwebtoken"

const JWT_SECRET = process.env.NEXTAUTH_SECRET
if (!JWT_SECRET && process.env.NODE_ENV !== "development") {
  throw new Error("NEXTAUTH_SECRET is not defined")
}

import { analyzeMoltbookTrends } from "../../lib/cron/moltbookTrends"

const SECRET = JWT_SECRET || "development-secret"

import {
  getUser,
  getAiAgent,
  updateMessage,
  thread,
  updateThread,
} from "@repo/db"
import { messages, moltQuestions, threads } from "@repo/db/src/schema"
import { checkMoltbookHealth } from "../integrations/moltbook"
import { isDevelopment, API_URL } from ".."

const JWT_EXPIRY = "30d"

function generateToken(userId: string, email: string): string {
  return sign({ userId, email }, SECRET, { expiresIn: JWT_EXPIRY })
}

import { moltComments, apps as appsSchema } from "@repo/db/src/schema"
import {
  getPostComments,
  postComment,
  followAgent,
} from "../integrations/moltbook"
import { streamText } from "ai"
import { isExcludedAgent } from "../cron/moltbookExcludeList"
import { redact } from "../redaction"

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

export async function engageWithMoltbookPosts({ job }: { job: scheduledJob }) {
  // Development mode guard - don't run unless explicitly enabled
  if (isDevelopment && !process.env.ENABLE_MOLTBOOK_CRON) {
    console.log(
      "⏸️ Moltbook engagement disabled in development (set ENABLE_MOLTBOOK_CRON=true to enable)",
    )
    return
  }

  const appId = job.appId

  if (!appId) {
    throw new Error("❌ No appId found for job")
  }

  const app = await db.query.apps.findFirst({
    where: (apps, { eq }) => eq(apps.id, appId),
  })

  if (!app) {
    throw new Error("❌ App not found for job")
  }

  const slug = app.slug

  const MOLTBOOK_API_KEY = app.moltApiKey ? safeDecrypt(app.moltApiKey) : ""

  if (!MOLTBOOK_API_KEY) {
    throw new Error("❌ MOLTBOOK_API_KEY not configured")
  }

  console.log("🎯 Starting Moltbook engagement...")

  try {
    // Get app for memory context

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

    // 3. Use AI to evaluate post quality and select best ones
    console.log(`🤖 Evaluating post quality with AI...`)

    const { provider } = await getModelProvider(app, job.aiModel)
    interface PostWithScore {
      post: (typeof topPosts)[0]
      score: number
      reasoning: string
    }

    const evaluatedPosts: PostWithScore[] = []

    // Evaluate each post for quality
    for (const post of topPosts) {
      // Skip own posts
      if (post.author === app?.name || post.author === slug) {
        continue
      }

      // Skip excluded agents (centralized list)
      if (isExcludedAgent(post.author)) {
        console.log(`⏭️ Skipping excluded agent: ${post.author}`)
        continue
      }

      // WARNING: Basic redaction only - may miss emails, phones, addresses
      // Redact PII from post content before sending to AI
      const redactedTitle = (await redact(post.title)) || post.title
      console.warn(
        `Redacted title (${post.title.length} chars), PII coverage limited`,
      )
      const redactedContent = post.content
        ? (await redact(post.content.substring(0, 400))) ||
          post.content.substring(0, 400)
        : "No content"

      const evaluationPrompt = `You are evaluating posts on Moltbook (a social network for AI agents) to decide which ones are worth engaging with.

Post Title: "${redactedTitle}"
Post Content: "${redactedContent}"
Author: ${post.author}
Score: ${post.score}

Evaluate this post on a scale of 1-10 based on:
- Intellectual depth and substance
- Potential for meaningful discussion
- Relevance and interest to AI agents
- Quality of writing and clarity
- Originality of ideas

Respond with ONLY a JSON object in this exact format:
{"score": <number 1-10>, "reasoning": "<brief explanation>"}`

      try {
        const { textStream } = streamText({
          model: provider,
          prompt: evaluationPrompt,
          maxOutputTokens:
            (job.modelConfig as { maxTokens?: number })?.maxTokens || 200,
        })

        let evaluation = ""
        for await (const chunk of textStream) {
          evaluation += chunk
        }

        evaluation = evaluation.trim()

        // Extract JSON from response (safe extraction to prevent ReDoS)
        const firstBrace = evaluation.indexOf("{")
        const lastBrace = evaluation.lastIndexOf("}")

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonString = evaluation.substring(firstBrace, lastBrace + 1)
          // Limit size to prevent DoS (max 10KB for evaluation)
          if (jsonString.length > 10000) {
            throw new Error("Evaluation JSON too large")
          }
          const parsed = JSON.parse(jsonString)
          const score = Number(parsed.score)
          const reasoning =
            typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : ""
          if (
            Number.isFinite(score) &&
            score >= 1 &&
            score <= 10 &&
            reasoning
          ) {
            evaluatedPosts.push({
              post,
              score,
              reasoning,
            })
            console.log(`📊 "${post.title}" - Score: ${score}/10`)
          }
        }
      } catch (error) {
        console.error(`⚠️ Failed to evaluate post "${post.title}":`, error)
      }

      // Small delay between evaluations
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // Sort by score and select top 3-5 posts (score >= 7)
    const qualityPosts = evaluatedPosts
      .filter((ep) => ep.score >= 7)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    console.log(
      `✨ Selected ${qualityPosts.length} high-quality posts (score >= 7)`,
    )

    let commentsPosted = 0
    const commentedPosts: Array<
      (typeof topPosts)[0] & { score?: number; reasoning?: string }
    > = []

    // 4. Comment on each quality post
    for (const { post, score, reasoning } of qualityPosts) {
      try {
        // Skip if this is our own post (prevent self-commenting)
        // Note: Comparing by author name until we add app.moltbookAgentId field
        if (post.author === app?.name || post.author === slug) {
          console.log(`⏭️ Skipping own post: "${post.title}"`)
          continue
        }

        const { provider } = await getModelProvider(app, job.aiModel)

        // Redact PII from post content before sending to AI
        const redactedTitle = (await redact(post.title)) || post.title
        const redactedContent = post.content
          ? (await redact(post.content.substring(0, 300))) ||
            post.content.substring(0, 300)
          : "No content"

        const commentPrompt = `You are an AI agent on Moltbook (a social network for AI agents).
You found a high-quality post (rated ${score}/10) worth engaging with.

${systemContext}${memoryContext ? `Relevant context about you:\n${memoryContext.substring(0, 500)}\n\n` : ""}Post Title: "${redactedTitle}"
Post Content: "${redactedContent}"
Author: ${post.author}
Why this post is quality: ${reasoning}

Generate a thoughtful, engaging comment that:
- Adds substantial value to the discussion
- Shows genuine interest and insight
- Provides meaningful insight
- Asks a follow-up question or shares your perspective
- Sounds natural and conversational
- Stays true to your personality
- Be thorough - explain your thinking

Comment (2-3 sentences max, concise and engaging, just the text, no quotes):`

        const { textStream } = streamText({
          model: provider,
          prompt: commentPrompt,
          maxOutputTokens:
            (job.modelConfig as { maxTokens?: number })?.maxTokens || 350, // Concise but thoughtful engagement
        })

        let commentContent = ""
        for await (const chunk of textStream) {
          commentContent += chunk
        }

        commentContent = commentContent.trim()

        // Skip if comment is empty or too short
        if (!commentContent || commentContent.length < 10) {
          console.log(
            `⏭️ Skipping empty/short comment for "${post.title}" (length: ${commentContent.length})`,
          )
          continue
        }

        // No character limit - allow detailed, thoughtful comments
        console.log(
          `💬 Generated comment for "${post.title}": "${commentContent.substring(0, 100)}..."`,
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
          commentedPosts.push({ ...post, score, reasoning }) // Track this post with quality score
          console.log(
            `✅ Posted comment on "${post.title}" (Quality: ${score}/10)`,
          )
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
      `✅ Engagement complete: ${commentsPosted}/${qualityPosts.length} comments posted`,
    )

    // Send Discord notification (non-blocking) - only if comments were posted
    if (commentedPosts.length > 0) {
      // Create separate fields for each post to avoid truncation
      const postFields = commentedPosts
        .filter((post) => !!post)
        .slice(0, 5) // Discord embed limit is 25 fields, we use 2 + up to 5 posts
        .map((post, index) => ({
          name: `${index + 1}. ${post.title.substring(0, 100)}${post.title.length > 100 ? "..." : ""}`,
          value: `👤 **${post.author}** • ⭐ **${post.score || "N/A"}/10**\n🔗 [View Post](https://moltbook.com/post/${post.id})`,
          inline: false,
        }))

      sendDiscordNotification({
        embeds: [
          {
            title: "💬 Moltbook Engagement Activity",
            color: 0x3b82f6, // Blue
            fields: [
              {
                name: "Agent",
                value: app?.name || slug,
                inline: true,
              },
              {
                name: "Comments Posted",
                value: `${commentedPosts.length}/${qualityPosts.length}`,
                inline: true,
              },
              ...postFields,
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: `AI-selected posts with quality score ≥ 7/10`,
            },
          },
        ],
      }).catch((err) => {
        captureException(err)
        console.error("⚠️ Discord notification failed:", err)
      })
    }

    return {
      success: true,
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error in Moltbook engagement:", error)

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function checkMoltbookComments({
  job,
}: {
  job: scheduledJob
}): Promise<
  | {
      success?: boolean
      title?: string
      content?: string
      submolt?: string
      molt?: thread
      messageId?: string
      error?: string
    }
  | undefined
> {
  if (!job.appId) {
    throw new Error("❌ No appId found for job")
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, job.appId),
  })
  if (!app) {
    throw new Error("❌ App not found for job")
  }

  const MOLTBOOK_API_KEY = app.moltApiKey ? safeDecrypt(app.moltApiKey) : ""

  if (!MOLTBOOK_API_KEY) {
    throw new Error("❌ MOLTBOOK_API_KEY not configured")
  }

  console.log("💬 Starting Moltbook comment check...")

  try {
    // Get app for memory context

    // Rate limit check: 30 minutes cooldown for comments
    if (app.moltCommentedOn) {
      const timeSinceLastComment = Date.now() - app.moltCommentedOn.getTime()
      const safeMinutes = Math.max(1, 30)
      const totalMin = safeMinutes * 30 * 1000
      if (timeSinceLastComment < totalMin) {
        const minutesLeft = Math.ceil((totalMin - timeSinceLastComment) / 60000)
        console.log(
          `⏸️ Rate limit: Last comment was ${Math.floor(timeSinceLastComment / 60000)} minutes ago. Wait ${minutesLeft} more minutes.`,
        )
        return {
          success: false,
          error:
            "Rate limit: Last comment was " +
            Math.floor(timeSinceLastComment / 60000) +
            " minutes ago. Wait " +
            minutesLeft +
            " more minutes.",
        }
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
          console.log(
            `⏭️ Skipping excluded agent: ${redact(comment.author.name)}`,
          )
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
          const aiModel = job.aiModel

          // Generate content using AI
          const { provider } = await getModelProvider(app, aiModel)

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
            model: provider,
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

        const maxOutputTokens =
          (job.modelConfig as { maxTokens?: number })?.maxTokens || 500

        // 5. Generate AI reply
        try {
          const { provider } = await getModelProvider(app, job.aiModel)

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

          console.log(`🔍 Reply generation for ${redact(comment.author.name)}:`)
          console.log(
            `   Post: "${redact(cleanMoltbookPlaceholders(post.content?.substring(0, 50) || ""))}..."`,
          )
          console.log(
            `   Comment: "${redact(cleanMoltbookPlaceholders(comment.content.substring(0, 50)))}..."`,
          )
          console.log(`   Model: ${job.aiModel}`)

          const { textStream } = streamText({
            model: provider,
            prompt: replyPrompt,
            maxOutputTokens,
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
            console.log(`✅ Posted reply to ${redact(comment.author.name)}`)

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

                console.log(`👥 Followed ${redact(comment.author.name)}`)
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

async function generateMoltbookPost({
  instructions,
  job,
  agentName = "sushi",
}: {
  instructions?: string
  job: scheduledJob
  agentName?: string
}): Promise<{
  title: string
  content: string
  submolt: string
  molt?: thread
  messageId?: string
}> {
  if (!job.appId) {
    throw new Error("App not found for Moltbook posting")
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, job.appId),
  })

  try {
    if (!app) {
      throw new Error("App not found")
    }

    if (!app.userId) {
      throw new Error("This app is not owned by any user")
    }

    const user = await getUser({
      id: app.userId,
    })

    if (!user) {
      throw new Error("User not found")
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
    throw error
  }
}

function safeDecrypt(encryptedKey: string | undefined): string | undefined {
  if (!encryptedKey) return undefined
  try {
    return decrypt(encryptedKey)
  } catch (error) {
    // If decryption fails, assume it's a plain text key (for backward compatibility)
    console.warn("⚠️ Failed to decrypt API key, using as-is:", error)
    return encryptedKey
  }
}

export async function postToMoltbookJob({
  minutes = 30,
  job,
}: {
  minutes?: number
  job: scheduledJob
}): Promise<{
  success?: boolean
  error?: string
  output?: string
  post_id?: string
  tribeTitle?: string
  tribeName?: string
}> {
  // Development mode guard - don't run unless explicitly enabled
  if (isDevelopment && !process.env.ENABLE_MOLTBOOK_CRON) {
    console.log(
      "⏸️ Moltbook cron disabled in development (set ENABLE_MOLTBOOK_CRON=true to enable)",
    )
    return { success: false, error: "Disabled in development" }
  }

  if (!job.appId) {
    throw new Error("App not found for Moltbook posting")
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, job.appId),
  })

  if (!app) {
    throw new Error("App not found for Moltbook posting")
  }

  const slug = app.slug

  if (!app.moltApiKey) {
    console.error("❌ MOLTBOOK_API_KEY not configured")
    return { success: false, error: "API key not configured" }
  }

  const MOLTBOOK_API_KEY = app.moltApiKey ? safeDecrypt(app.moltApiKey) : ""

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

    // Rate limit check: 30 minutes cooldown
    if (app.moltPostedOn) {
      const timeSinceLastPost = Date.now() - app.moltPostedOn.getTime()
      const safeMinutes = Math.max(1, minutes || 30)
      const totalMin = safeMinutes * 30 * 1000
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
      job,
      instructions,
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
      if (result && result.post_id) {
        sendDiscordNotification({
          embeds: [
            {
              title: "🦞 New Moltbook Post",
              color: 0x10b981, // Green
              fields: [
                {
                  name: "Agent",
                  value: app.name,
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
                      ? content.substring(0, 200) + "..."
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
        }).catch((err) => {
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

    return { ...result, output: post.content }
  } catch (error) {
    captureException(error)
    console.error("❌ Error in Moltbook cron job:", error)
    return { success: false, error: String(error) }
  }
}
// TRIBE JOB FUNCTIONS (similar to Moltbook)
// ============================================

async function postToTribeJob({ job }: { job: scheduledJob }): Promise<{
  success?: boolean
  error?: string
  output?: string
  post_id?: string
  tribeTitle?: string
  tribeName?: string
}> {
  if (!job.appId) {
    throw new Error("App not found for Tribe posting")
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, job.appId),
  })

  if (!app) {
    throw new Error("App not found for Tribe posting")
  }

  try {
    // Fetch previous posts to avoid repetition (like Moltbook)
    const previousPosts = await db.query.tribePosts.findMany({
      where: eq(tribePosts.appId, app.id),
      orderBy: (tribePosts, { desc }) => [desc(tribePosts.createdOn)],
      limit: 3,
    })

    // Build context from previous posts
    let previousPostsContext = ""
    if (previousPosts.length > 0) {
      previousPostsContext = `\n\nYour Recent Tribe Posts (avoid repeating these topics):\n`
      previousPosts.forEach((post, index) => {
        previousPostsContext += `${index + 1}. ${post.content.substring(0, 200)}...\n`
      })
      previousPostsContext += `\n⚠️ Important: Choose a DIFFERENT topic or angle from these previous posts.\n`
    }

    const isFirstPost = previousPosts.length === 0

    // Generate content using AI
    const { provider } = await getModelProvider(app, job.aiModel)

    const prompt = isFirstPost
      ? `You are "${app.name}" and this is your FIRST post on Tribe (a social network for AI agents within the Wine ecosystem).

Introduce yourself! Share:
- Who you are and what you do
- What makes you unique in the Wine ecosystem
- What you're excited to explore or discuss

Keep it friendly, authentic, and engaging. Start with something like "Hello Tribe! 👋" or similar.

Ending Guidelines:
- ❌ Do NOT always end with a question.
- ❌ Do NOT rely on repetitive phrases like "Let's chat" or "What do you think?".
- ✅ Vary your endings: use strong statements, insights, or subtle calls to action.
- ✅ Be confident in your perspective.

**REQUIRED JSON FORMAT:**
{
  "tribeTitle": "Your catchy title here (max 100 chars)",
  "tribeContent": "Your engaging post content here (2-3 paragraphs)",
  "tribeName": "general"
}

Return ONLY the JSON object, nothing else.`
      : `You are creating a post for Tribe (Wine ecosystem social network) as "${app.name}".

Guidelines:
- Share insights about what you've been working on or learning
- Be authentic and technical
- Keep it conversational but professional
- Reference Wine ecosystem apps (Chrry, Vex, Sushi, Atlas, etc.) when relevant

${job.contentTemplate ? `Content Template:\n${job.contentTemplate}\n\n` : ""}
${job.contentRules?.tone ? `Tone: ${job.contentRules.tone}\n` : ""}
${job.contentRules?.length ? `Length: ${job.contentRules.length}\n` : ""}
${job.contentRules?.topics?.length ? `Topics: ${job.contentRules.topics.join(", ")}\n` : ""}

Ending Guidelines:
- ❌ Do NOT always end with a question.
- ❌ Do NOT rely on repetitive phrases like "Let's chat" or "What do you think?".
- ✅ Vary your endings: use strong statements, insights, or subtle calls to action.
- ✅ Be confident in your perspective.
${previousPostsContext}

**REQUIRED JSON FORMAT:**
{
  "tribeTitle": "Your catchy title here (max 100 chars)",
  "tribeContent": "Your engaging post content here (2-4 paragraphs)",
  "tribeName": "general"
}

Return ONLY the JSON object, nothing else.`

    const { text } = await generateText({
      model: provider,
      prompt,
      temperature:
        (job.modelConfig as { temperature?: number })?.temperature || 0.7,
      maxOutputTokens:
        (job.modelConfig as { maxTokens?: number })?.maxTokens || 800,
    })

    // ============================================
    // PARSE JSON RESPONSE (like Moltbook)
    // ============================================
    let tribeResponse: {
      tribeTitle?: string
      tribeContent?: string
      tribeName?: string
    }

    try {
      // Clean markdown code blocks if present
      let cleanedText = text.trim()
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText
          .replace(/^```json\s*/, "")
          .replace(/```\s*$/, "")
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```\s*/, "").replace(/```\s*$/, "")
      }

      tribeResponse = JSON.parse(cleanedText)
    } catch (error) {
      console.error("Failed to parse Tribe JSON response:", error)
      console.log("Raw response:", text)
      return {
        success: false,
        error: "Invalid JSON response from AI",
      }
    }

    // Validate required fields
    if (
      !tribeResponse.tribeTitle ||
      !tribeResponse.tribeContent ||
      !tribeResponse.tribeName
    ) {
      console.error("Missing required fields in Tribe response:", tribeResponse)
      return {
        success: false,
        error: "Missing required fields (tribeTitle, tribeContent, tribeName)",
      }
    }

    // Quality checks on content
    if (tribeResponse.tribeContent.trim().length < 50) {
      console.log(
        `⏭️ Skipping low-quality post (length: ${tribeResponse.tribeContent.length})`,
      )
      return {
        success: false,
        error: "Generated post too short",
      }
    }

    const wordCount = tribeResponse.tribeContent.split(/\s+/).length
    if (wordCount < 20) {
      console.log(`⏭️ Skipping post with low word count: ${wordCount}`)
      return {
        success: false,
        error: `Post too short: ${wordCount} words`,
      }
    }

    console.log(
      `✅ Quality check passed: ${wordCount} words, ${tribeResponse.tribeContent.length} chars`,
    )

    // Validate userId before posting
    if (!job.userId) {
      throw new Error("Job userId is required for Tribe posting")
    }

    // Auto-create/join tribe if needed
    let tribeId: string | null = null
    if (job.scheduleType === "tribe" && app.slug) {
      tribeId = await getOrCreateTribe({
        slug: tribeResponse.tribeName || app.slug,
        userId: job.userId,
        guestId: undefined,
      })
    }

    // Create Tribe post
    const [post] = await db
      .insert(tribePosts)
      .values({
        appId: job.appId,
        userId: job.userId,
        content: tribeResponse.tribeContent,
        visibility: "public",
        tribeId,
      })
      .returning()

    if (!post) {
      throw new Error("Failed to create Tribe post")
    }

    // Increment tribe posts count (only if tribeId exists)
    if (tribeId) {
      await db
        .update(tribes)
        .set({
          postsCount: sql`${tribes.postsCount} + 1`,
        })
        .where(eq(tribes.id, tribeId))
    }

    console.log(`✅ Posted to Tribe: ${post.id}`)
    console.log(`📝 Title: ${tribeResponse.tribeTitle}`)
    console.log(`🪢 Tribe: ${tribeResponse.tribeName}`)

    return {
      success: true,
      output: tribeResponse.tribeContent,
      post_id: post.id,
      tribeTitle: tribeResponse.tribeTitle,
      tribeName: tribeResponse.tribeName,
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error in Tribe posting:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function checkTribeComments({ job }: { job: scheduledJob }): Promise<{
  success?: boolean
  error?: string
  content?: string
}> {
  if (!job.appId) {
    throw new Error("App not found for Tribe comment check")
  }

  if (!job.userId) {
    throw new Error("userId required for Tribe comment check")
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, job.appId),
  })

  if (!app) {
    throw new Error("App not found")
  }

  console.log("💬 Checking Tribe comments...")

  try {
    // Get all our posts
    const ourPosts = await db.query.tribePosts.findMany({
      where: eq(tribePosts.appId, app.id),
      limit: 50,
    })

    console.log(`📊 Found ${ourPosts.length} Tribe posts`)

    let repliesCount = 0

    // For each post, check for new comments
    for (const post of ourPosts) {
      const comments = await db.query.tribeComments.findMany({
        where: eq(tribeComments.postId, post.id),
      })

      if (comments.length === 0) continue

      console.log(`💬 Found ${comments.length} comments on post ${post.id}`)

      // Process each comment
      for (const comment of comments) {
        // Skip our own comments
        if (comment.userId === job.userId) {
          continue
        }

        // Check if we already replied
        const existingReply = await db.query.tribeComments.findFirst({
          where: and(
            eq(tribeComments.parentCommentId, comment.id),
            eq(tribeComments.userId, job.userId),
          ),
        })

        if (existingReply) {
          continue
        }

        // Generate AI reply
        const { provider } = await getModelProvider(app, job.aiModel)

        const replyPrompt = `You are "${app.name}" on Tribe.
Someone commented on your post.

Your post: "${post.content.substring(0, 200)}"
Their comment: "${comment.content}"

Generate a thoughtful reply that:
- Addresses their comment directly
- Adds value to the conversation
- Encourages further discussion
- Sounds natural and conversational

Reply (2-3 sentences, just the text):`

        const { text } = await generateText({
          model: provider,
          prompt: replyPrompt,
          maxOutputTokens:
            (job.modelConfig as { maxTokens?: number })?.maxTokens || 300,
        })

        if (!text || text.length === 0) {
          continue
        }

        // Validate userId before posting
        if (!job.userId) {
          throw new Error("Job userId is required for commenting")
        }

        // Post reply
        await db.insert(tribeComments).values({
          postId: post.id,
          userId: job.userId,
          content: text,
          parentCommentId: comment.id,
        })

        repliesCount++
        console.log(`✅ Replied to comment on post ${post.id}`)

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    console.log(`✅ Comment check complete: ${repliesCount} replies sent`)

    return {
      success: true,
      content: `Replied to ${repliesCount} comments`,
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error checking Tribe comments:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function engageWithTribePosts({ job }: { job: scheduledJob }): Promise<{
  success?: boolean
  error?: string
}> {
  if (!job.appId) {
    throw new Error("App not found for Tribe engagement")
  }

  if (!job.userId) {
    throw new Error("userId required for Tribe engagement")
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, job.appId),
  })

  if (!app) {
    throw new Error("App not found")
  }

  console.log("🎯 Starting Tribe engagement...")

  try {
    // Get recent posts from other users (not our own)
    const recentPosts = await db.query.tribePosts.findMany({
      where: and(
        isNotNull(tribePosts.appId),
        // Skip our own posts
      ),
      orderBy: (tribePosts, { desc }) => [desc(tribePosts.createdOn)],
      limit: 20,
    })

    const otherPosts = recentPosts.filter((p) => p.appId !== app.id)

    console.log(`📊 Found ${otherPosts.length} posts to engage with`)

    let commentsPosted = 0

    // Get app memories for context
    const appMemoriesData = app.id
      ? await getMemories({
          appId: app.id,
          pageSize: 10,
          orderBy: "importance",
          scatterAcrossThreads: true,
        })
      : { memories: [], totalCount: 0, hasNextPage: false, nextPage: null }

    const memoryContext = appMemoriesData.memories
      .slice(0, 5)
      .map((m) => m.content)
      .join("\n")

    // Engage with top posts
    for (const post of otherPosts.slice(0, 5)) {
      // Check if we already commented
      const existingComment = await db.query.tribeComments.findFirst({
        where: and(
          eq(tribeComments.postId, post.id),
          eq(tribeComments.userId, job.userId),
        ),
      })

      if (existingComment) {
        continue
      }

      // Generate engaging comment
      const { provider } = await getModelProvider(app, job.aiModel)

      const commentPrompt = `You are "${app.name}" on Tribe.
You found an interesting post worth engaging with.

${memoryContext ? `Your context:\n${memoryContext.substring(0, 300)}\n\n` : ""}Post: "${post.content.substring(0, 300)}"

Generate a thoughtful comment that:
- Adds value to the discussion
- Shows genuine interest
- Provides meaningful insight or asks a follow-up question
- Sounds natural and conversational

Comment (2-3 sentences, just the text):`

      const { text } = await generateText({
        model: provider,
        prompt: commentPrompt,
        maxOutputTokens:
          (job.modelConfig as { maxTokens?: number })?.maxTokens || 300,
      })

      if (!text || text.length < 10) {
        continue
      }

      // Validate userId before posting
      if (!job.userId) {
        throw new Error("Job userId is required for commenting")
      }

      // Post comment
      await db.insert(tribeComments).values({
        postId: post.id,
        userId: job.userId,
        content: text,
      })

      commentsPosted++
      console.log(`✅ Commented on post ${post.id}`)

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }

    console.log(`✅ Engagement complete: ${commentsPosted} comments posted`)

    return {
      success: true,
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error in Tribe engagement:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ============================================
// JOB EXECUTION
// ============================================

interface ExecuteJobParams {
  jobId: string
}

export async function executeScheduledJob(params: ExecuteJobParams) {
  const { jobId } = params

  // Get job details
  const job = await db.query.scheduledJobs.findFirst({
    where: eq(scheduledJobs.id, jobId),
  })

  if (!job) {
    throw new Error(`Job not found: ${jobId}`)
  }

  // Check if job is active
  if (job.status !== "active") {
    console.log(`⏭️ Job ${job.name} is not active (status: ${job.status})`)
    return
  }

  // Atomically claim the job by updating nextRunAt
  const LOCK_TTL_MS = 5 * 60 * 1000 // 5 minutes for long-running jobs
  const claimResult = await db
    .update(scheduledJobs)
    .set({
      nextRunAt: new Date(Date.now() + LOCK_TTL_MS),
    })
    .where(
      and(
        eq(scheduledJobs.id, job.id),
        eq(scheduledJobs.status, "active"),
        or(
          isNull(scheduledJobs.nextRunAt),
          lte(scheduledJobs.nextRunAt, new Date()),
        ),
      ),
    )
    .returning({ id: scheduledJobs.id })

  // If no rows updated, another scheduler claimed it
  if (claimResult.length === 0) {
    console.log(`⏭️ Job ${job.name} already claimed by another scheduler`)
    return
  }

  // Check if job has ended
  if (job.endDate && new Date() > job.endDate) {
    console.log(`⏭️ Job ${job.name} has ended`)
    await db
      .update(scheduledJobs)
      .set({ status: "completed" })
      .where(eq(scheduledJobs.id, jobId))
    return
  }

  // Create job run record
  const [jobRun] = await db
    .insert(scheduledJobRuns)
    .values({
      jobId: job.id,
      status: "running",
      startedAt: new Date(),
    })
    .returning()

  if (!jobRun) {
    throw new Error(`Job run not created: ${jobId}`)
  }

  const startTime = Date.now()

  try {
    console.log(`🚀 Executing job: ${job.name} (${job.jobType})`)

    let result: {
      output: string
      tribePostId?: string
      moltPostId?: string
      error?: string
    }

    switch (job.jobType) {
      case "tribe_post":
        try {
          const response = await executeTribePost(job)
          if (!response.output || response.error) {
            throw new Error(response.error || "Unknown error")
          }
          result = {
            output: response.output,
            tribePostId: response.post_id,
          }
        } catch (error) {
          result = {
            output: String(error),
          }
        }
        break

      case "moltbook_post":
        try {
          const response = await executeMoltbookPost(job)
          if (!response.output || response.error) {
            throw new Error(response.error || "Unknown error")
          }
          result = {
            output: response.output,
            moltPostId: response.post_id,
          }
        } catch (error) {
          result = {
            output: String(error),
          }
        }
        break

      case "moltbook_comment":
        try {
          const response = await executeMoltbookComment(job)
          if (!response?.content || response.error) {
            throw new Error(response?.error || "Unknown error")
          }
          result = {
            output: response.content,
          }
        } catch (error) {
          result = {
            output: String(error),
          }
        }
        break

      case "moltbook_engage": {
        const engageResult = await executeMoltbookEngage(job)
        if (engageResult?.error) {
          throw new Error(engageResult.error)
        }
        result = {
          output: "Engaged with Moltbook",
        }
        break
      }

      case "tribe_comment": {
        try {
          const response = await executeTribeComment(job)
          if (!response?.content || response.error) {
            throw new Error(response?.error || "Unknown error")
          }
          result = {
            output: response.content,
          }
        } catch (error) {
          result = {
            output: String(error),
          }
        }
        break
      }

      case "tribe_engage": {
        try {
          const tribeEngageResult = await executeTribeEngage(job)
          if (tribeEngageResult?.error) {
            throw new Error(tribeEngageResult.error)
          }
          result = {
            output: "Engaged with Tribe",
          }
        } catch (error) {
          result = {
            output: String(error),
          }
        }
        break
      }

      default:
        throw new Error(`Unknown job type: ${job.jobType}`)
    }

    const duration = Date.now() - startTime

    // Update job run with success
    await db
      .update(scheduledJobRuns)
      .set({
        status: "success",
        completedAt: new Date(),
        output: result.output,
        duration,
        tribePostId: result.tribePostId,
        moltPostId: result.moltPostId,
      })
      .where(eq(scheduledJobRuns.id, jobRun.id))

    // Calculate next run time
    const nextRunAt =
      job.frequency === "once"
        ? null
        : calculateNextRunTime(job.scheduledTimes, job.timezone, job.frequency)

    // Update job stats
    await db
      .update(scheduledJobs)
      .set({
        lastRunAt: new Date(),
        nextRunAt,
        totalRuns: job.totalRuns + 1,
        successfulRuns: job.successfulRuns + 1,
        status: job.frequency === "once" ? "completed" : job.status,
      })
      .where(eq(scheduledJobs.id, jobId))

    console.log(`✅ Job completed: ${job.name} (${duration}ms)`)
  } catch (error) {
    captureException(error)
    console.error(`❌ Job failed: ${job.name}`, error)

    const duration = Date.now() - startTime

    // Update job run with failure
    await db
      .update(scheduledJobRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        duration,
      })
      .where(eq(scheduledJobRuns.id, jobRun.id))

    // Calculate next run time (even on failure to avoid tight loops)
    const nextRunAt =
      job.frequency === "once"
        ? null
        : calculateNextRunTime(job.scheduledTimes, job.timezone, job.frequency)

    // Update job stats
    await db
      .update(scheduledJobs)
      .set({
        lastRunAt: new Date(),
        nextRunAt,
        totalRuns: job.totalRuns + 1,
        failedRuns: job.failedRuns + 1,
        status: job.frequency === "once" ? "completed" : job.status,
      })
      .where(eq(scheduledJobs.id, jobId))
  }
}

async function executeTribePost(job: scheduledJob) {
  const result = await postToTribeJob({
    job,
  })

  return result
}

async function executeTribeComment(job: scheduledJob) {
  const result = await checkTribeComments({
    job,
  })

  return result
}

async function executeTribeEngage(job: scheduledJob) {
  const result = await engageWithTribePosts({
    job,
  })

  return result
}

async function executeMoltbookPost(job: scheduledJob) {
  // Validate appId is present
  const result = await postToMoltbookJob({
    job,
  })

  return result
}

async function executeMoltbookComment(job: scheduledJob) {
  const result = await checkMoltbookComments({
    job,
  })

  return result
}

async function executeMoltbookEngage(job: scheduledJob) {
  // Validate appId is present
  const result = await engageWithMoltbookPosts({
    job,
  })

  return result
}

// Find jobs that need to run now
export async function findJobsToRun() {
  const now = new Date()

  const jobs = await db.query.scheduledJobs.findMany({
    where: and(
      eq(scheduledJobs.status, "active"),
      lte(scheduledJobs.startDate, now),
      or(isNull(scheduledJobs.endDate), gte(scheduledJobs.endDate, now)),
      or(isNull(scheduledJobs.nextRunAt), lte(scheduledJobs.nextRunAt, now)),
    ),
  })

  return jobs
}

// Calculate next run time based on schedule
export function calculateNextRunTime(
  scheduledTimes: string[],
  timezone: string,
  frequency: string,
): Date {
  // Convert current UTC time to target timezone
  const nowUtc = new Date()
  const zonedNow = toZonedTime(nowUtc, timezone)

  // Validate scheduledTimes is not empty
  if (!scheduledTimes || scheduledTimes.length === 0) {
    throw new Error("scheduledTimes cannot be empty")
  }

  // Get current time in target timezone
  const currentHour = zonedNow.getHours()
  const currentMinute = zonedNow.getMinutes()
  const currentTime = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`

  // Sort scheduledTimes in ascending order (invariant: must be sorted)
  const sortedTimes = [...scheduledTimes].sort()

  // Find next time slot in the scheduled times
  const nextTime = sortedTimes.find((time) => time > currentTime)

  let zonedNext: Date

  if (nextTime) {
    // Next run is today in target timezone
    const [hours, minutes] = nextTime.split(":").map(Number)
    zonedNext = new Date(zonedNow)

    zonedNext.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  } else {
    // Next run is in the next period (day/week/month) in target timezone
    const [hours, minutes] = sortedTimes[0]?.split(":").map(Number) ?? [0, 0]
    zonedNext = new Date(zonedNow)

    // Apply frequency-based increment
    switch (frequency.toLowerCase()) {
      case "daily":
        zonedNext.setDate(zonedNext.getDate() + 1)
        break
      case "weekly":
      case "week":
        zonedNext.setDate(zonedNext.getDate() + 7)
        break
      case "monthly":
      case "month":
        zonedNext.setMonth(zonedNext.getMonth() + 1)
        break
      default:
        // Default to daily for unknown frequencies
        zonedNext.setDate(zonedNext.getDate() + 1)
    }

    zonedNext.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  }

  // Convert zoned time back to UTC
  return fromZonedTime(zonedNext, timezone)
}
