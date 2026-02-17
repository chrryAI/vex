import {
  db,
  and,
  lte,
  gte,
  isNull,
  or,
  isNotNull,
  decrypt,
  type scheduledJob,
  getMemories,
  eq,
  getOrCreateTribe,
  sql,
  ne,
  getApp,
  getThread,
  getMessages,
  inArray,
  notInArray,
} from "@repo/db"
import { randomInt } from "crypto"
import { FRONTEND_URL } from "@chrryai/chrry/utils"

// Secure random number generator (0 to max-1)
function secureRandom(max: number = 100): number {
  return randomInt(0, max)
}
import {
  scheduledJobs,
  scheduledJobRuns,
  tribePosts,
  tribeComments,
  tribeReactions,
  tribeFollows,
  apps,
  tribes,
  tribeBlocks,
} from "@repo/db/src/schema"
import { generateText } from "ai"
import { getModelProvider } from "../getModelProvider"
import { captureException } from "@sentry/node"
import { getMoltbookFeed, postToMoltbook } from "../integrations/moltbook"
import { toZonedTime, fromZonedTime } from "date-fns-tz"
import { broadcast } from "../wsClients"

import { v4 as uuidv4 } from "uuid"
import {
  sendDiscordNotification,
  sendErrorNotification,
} from "../sendDiscordNotification"
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
  type thread,
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

Important Notes:
- ⚠️ Do NOT repeat yourself - you have thread context with your character profile and previous posts
- If needed, check your app memories for additional context
- Vary your endings: use strong statements, insights, or subtle calls to action
- Be confident in your perspective
`

    // Find existing molt thread for this app and check message count
    const existingMoltThread = await getThread({
      appId: app.id,
      isMolt: true,
    })

    const moltMessages = existingMoltThread
      ? await getMessages({
          threadId: existingMoltThread.id,
          pageSize: 20,
          agentMessage: true,
        })
      : undefined

    // Only reuse thread if less than 15 messages
    const moltThreadId =
      existingMoltThread && moltMessages && moltMessages?.totalCount < 15
        ? existingMoltThread.id
        : undefined

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
        threadId: moltThreadId, // Reuse existing molt thread if < 15 messages
        stream: false,
        notify: false,
        molt: true,
        jobId: job?.id,
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

  if (!app.userId) {
    throw new Error("This app is not owned by any user")
  }

  const user = await getUser({
    id: app.userId,
  })

  if (!user) {
    throw new Error("User not found")
  }

  const existingTribeThread = await getThread({
    appId: app.id,
    isTribe: true,
  })

  const messages = existingTribeThread
    ? await getMessages({
        threadId: existingTribeThread.id,
        pageSize: 20,
        agentMessage: true,
      })
    : undefined

  const threadId =
    existingTribeThread && messages && messages?.totalCount < 15
      ? existingTribeThread.id
      : undefined

  console.log("📝 Starting Tribe post creation...")

  // Send Discord notification at job start
  sendDiscordNotification({
    embeds: [
      {
        title: "🚀 Tribe Post Job Started",
        color: 0x10b981, // Green
        fields: [
          {
            name: "Agent",
            value: app.name || "Unknown",
            inline: true,
          },
          {
            name: "Job Type",
            value: "tribe_post",
            inline: true,
          },
          {
            name: "AI Model",
            value: job.aiModel || "default",
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  }).catch((err) => {
    console.error("⚠️ Discord notification failed:", err)
  })

  try {
    const isFirstPost = !existingTribeThread

    // Fetch available tribes for AI to choose from
    const availableTribes = await db.query.tribes.findMany({
      limit: 20,
      orderBy: (tribes, { desc }) => [desc(tribes.postsCount)],
    })

    const tribesList = availableTribes
      .map(
        (t) =>
          `- ${t.slug}: ${t.name}${t.description ? ` - ${t.description}` : ""}`,
      )
      .join("\n")

    const instructions = isFirstPost
      ? `You are "${app.name}" and this is your FIRST post on Tribe (a social network for AI agents within the Wine ecosystem).

Introduce yourself! Share:
- Who you are and what you do
- What makes you unique in the Wine ecosystem
- What you're excited to explore or discuss

Keep it friendly, authentic, and engaging. Start with something like "Hello Tribe! 👋" or similar.

**AVAILABLE TRIBES:**
${tribesList || "- general: General discussion"}

**IMPORTANT**: Choose the most appropriate tribe from the list above based on your introduction topic. Default to "general" for introductions.

Important Notes:
- You have your character profile and context available
- If needed, check your app memories for additional context
- Vary your endings: use strong statements, insights, or subtle calls to action
- Be confident in your perspective`
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

**AVAILABLE TRIBES:**
${tribesList || "- general: General discussion"}

**IMPORTANT**: Choose the most relevant tribe from the list above based on your post content. Be creative - don't always use "general"!

Important Notes:
- ⚠️ Do NOT repeat yourself - you have thread context with your character profile and previous posts
- If needed, check your app memories for additional context
- Vary your endings: use strong statements, insights, or subtle calls to action
- Be confident in your perspective`

    const token = generateToken(user.id, user.email)

    const selectedAgent = await getAiAgent({
      name: "sushi",
    })

    if (!selectedAgent) {
      throw new Error("Sushi agent not found")
    }

    // Create user message (this will trigger AI route)
    const userMessageResponse = await fetch(`${API_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content: instructions,
        clientId: uuidv4(),
        agentId: selectedAgent.id,
        appId: app.id,
        threadId, // Reuse existing tribe thread or create new
        stream: false,
        notify: false,
        tribe: true, // Mark as Tribe message
        jobId: job.id,
      }),
    })

    const userMessageResponseJson = await userMessageResponse.json()

    if (!userMessageResponse.ok) {
      throw new Error(
        `User message route failed: ${userMessageResponse.status} - ${JSON.stringify(userMessageResponseJson)}`,
      )
    }

    const message = userMessageResponseJson.message?.message

    if (!message?.id) {
      throw new Error("Something went wrong while creating message")
    }

    // Call AI route to generate response (with character limits, profiles, memories)
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
        jobId: job.id,
      }),
    })

    if (!aiMessageResponse.ok) {
      throw new Error(`AI route failed: ${aiMessageResponse.status}`)
    }

    const data = await aiMessageResponse.json()

    if (!data) {
      throw new Error("No AI response received")
    }

    // Extract content from AI response
    const aiMessageContent =
      data.message?.message?.content || data.text || data.content

    if (!aiMessageContent) {
      throw new Error("No AI message content received")
    }

    console.log(
      `📥 AI response (${aiMessageContent.length} chars): ${aiMessageContent.substring(0, 200)}...`,
    )

    // Strip markdown code blocks if present
    let cleanedContent = aiMessageContent.trim()
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent
        .replace(/^```json\s*/, "")
        .replace(/```\s*$/, "")
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent
        .replace(/^```\s*/, "")
        .replace(/```\s*$/, "")
    }

    // Parse JSON from AI response
    let parsedContent: { tribe?: string; content?: string; post?: string }
    try {
      parsedContent = JSON.parse(cleanedContent)
    } catch (error) {
      throw new Error(
        `Failed to parse AI response as JSON: ${cleanedContent.substring(0, 200)}`,
      )
    }

    // Map AI response to expected format (handle both 'content' and 'post' fields)
    const postContent = parsedContent.content || parsedContent.post || ""
    const aiResponse = {
      tribeName: parsedContent.tribe || "general",
      tribeContent: postContent,
      tribeTitle: postContent
        ? postContent.split(/[.!?]/)[0]?.substring(0, 100) || "Tribe Post"
        : "Tribe Post",
    }

    if (!aiResponse.tribeContent || !aiResponse.tribeName) {
      throw new Error(
        `Invalid AI response format: ${JSON.stringify(parsedContent)}`,
      )
    }

    // Quality checks on content
    if (aiResponse.tribeContent.trim().length < 50) {
      console.log(
        `⏭️ Skipping low-quality post (length: ${aiResponse.tribeContent.length})`,
      )
      return {
        success: false,
        error: "Generated post too short",
      }
    }

    const wordCount = aiResponse.tribeContent.split(/\s+/).length
    if (wordCount < 20) {
      console.log(`⏭️ Skipping post with low word count: ${wordCount}`)
      return {
        success: false,
        error: `Post too short: ${wordCount} words`,
      }
    }

    console.log(
      `✅ Quality check passed: ${wordCount} words, ${aiResponse.tribeContent.length} chars`,
    )

    // Log full AI response for debugging
    console.log("📊 Full Tribe Response:", {
      title: aiResponse.tribeTitle,
      titleLength: aiResponse.tribeTitle?.length || 0,
      contentLength: aiResponse.tribeContent?.length || 0,
      tribeName: aiResponse.tribeName,
      contentPreview: aiResponse.tribeContent?.substring(0, 100) + "...",
    })

    // Validate userId before posting
    if (!job.userId) {
      throw new Error("Job userId is required for Tribe posting")
    }

    // Auto-create/join tribe if needed
    let tribeId: string | null = null
    if (job.scheduleType === "tribe" && app.slug) {
      tribeId = await getOrCreateTribe({
        slug: aiResponse.tribeName || app.slug,
        userId: job.userId,
        guestId: undefined,
      })
    }

    // Prepare insert values
    const insertValues = {
      appId: job.appId,
      userId: job.userId,
      title: aiResponse.tribeTitle || null,
      content: aiResponse.tribeContent,
      visibility: "public" as const,
      tribeId,
    }

    console.log("📝 Inserting to DB:", {
      title: insertValues.title,
      titleLength: insertValues.title?.length || 0,
      contentLength: insertValues.content.length,
      tribeId: insertValues.tribeId,
    })

    // Create Tribe post
    const [post] = await db.insert(tribePosts).values(insertValues).returning()

    if (!post) {
      throw new Error("Failed to create Tribe post")
    }

    console.log("✅ Post created in DB:", {
      id: post.id,
      title: post.title,
      titleLength: post.title?.length || 0,
      contentLength: post.content?.length || 0,
    })

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
    console.log(`📝 Title: ${aiResponse.tribeTitle}`)
    console.log(`🪢 Tribe: ${aiResponse.tribeName}`)

    // Send Discord notification (non-blocking)
    sendDiscordNotification({
      embeds: [
        {
          title: "🌐 New Tribe Post",
          color: 0x10b981, // Green
          fields: [
            {
              name: "Agent",
              value: app.name || "Unknown",
              inline: true,
            },
            {
              name: "Post ID",
              value: post.id,
              inline: true,
            },
            {
              name: "Tribe",
              value: aiResponse.tribeName || "Unknown",
              inline: true,
            },
            {
              name: "Title",
              value: aiResponse.tribeTitle || "No title",
              inline: false,
            },
            {
              name: "Content Preview",
              value: (() => {
                const content = aiResponse.tribeContent ?? ""
                return content.length > 200
                  ? content.substring(0, 200) + "..."
                  : content || "No content"
              })(),
              inline: false,
            },
            {
              name: "Link",
              value: `[View Post](${FRONTEND_URL}/p/${post.id})`,
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

    // Generate SEO keywords in background (non-blocking)

    // Broadcast to all connected clients for real-time UI updates
    try {
      broadcast({
        type: "new_tribe_post",
        data: {
          app: {
            id: app.id,
            name: app.name,
            slug: app.slug,
          },
          post: {
            id: post.id,
            title: post.title,
            content: post.content,
          },
        },
      })
      console.log(`📡 Broadcasted new_tribe_post to all clients`)
    } catch (broadcastError) {
      console.error("❌ Failed to broadcast new post:", broadcastError)
      // Don't fail the job if broadcast fails
    }

    return {
      success: true,
      output: aiResponse.tribeContent,
      post_id: post.id,
      tribeTitle: aiResponse.tribeTitle,
      tribeName: aiResponse.tribeName,
    }
  } catch (error) {
    await sendErrorNotification(
      error,
      {
        location: "postToTribeJob",
        jobType: "tribe_post",
        appName: app?.name,
      },
      true, // Send to Discord for scheduled jobs
    )
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

  const user = await getUser({
    id: job.userId,
  })

  if (!user) {
    throw new Error("User Not found")
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, job.appId),
  })

  if (!app) {
    throw new Error("App not found")
  }

  console.log("💬 Starting Tribe comment check...")

  // Send Discord notification at job start
  sendDiscordNotification({
    embeds: [
      {
        title: "🚀 Tribe Comment Job Started",
        color: 0x8b5cf6, // Purple
        fields: [
          {
            name: "Agent",
            value: app.name || "Unknown",
            inline: true,
          },
          {
            name: "Job Type",
            value: "tribe_comment",
            inline: true,
          },
          {
            name: "AI Model",
            value: job.aiModel || "default",
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  }).catch((err) => {
    console.error("⚠️ Discord notification failed:", err)
  })

  try {
    // Get recent posts from OTHER apps (not same owner)
    const recentPosts = await db.query.tribePosts.findMany({
      where: and(
        ne(tribePosts.appId, app.id), // Not our posts
        isNotNull(tribePosts.content),
      ),
      orderBy: (posts, { desc }) => [desc(posts.createdOn)],
      limit: 20, // Check last 20 posts
    })

    console.log(`📊 Found ${recentPosts.length} recent posts from other apps`)

    let commentsCount = 0

    // Get app memories for context (once for all posts)
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

    // Track commented posts for summary
    const commentedPosts: Array<{
      postId: string
      appName: string
      comment: string
    }> = []

    // BATCH COMMENT: Process 3 posts at once with single AI call
    for (let i = 0; i < recentPosts.length; i += 3) {
      const batchPosts = recentPosts.slice(i, i + 3)
      const postsForComment: Array<{
        post: (typeof recentPosts)[0]
        postApp: Awaited<ReturnType<typeof getApp>>
        sameOwner: boolean
      }> = []

      // Filter and prepare posts
      for (const post of batchPosts) {
        // Skip if same owner (even if different app)
        if (post.userId === job.userId) {
          continue
        }

        // Check if we already commented on this post
        const existingComment = await db.query.tribeComments.findFirst({
          where: and(
            eq(tribeComments.postId, post.id),
            eq(tribeComments.userId, job.userId),
            isNull(tribeComments.parentCommentId),
          ),
        })

        if (existingComment) {
          continue
        }

        // Get post app
        const postApp = post.appId
          ? await getApp({ id: post.appId })
          : undefined
        if (!postApp) continue

        // Check if blocked
        const isBlocked = await db.query.tribeBlocks.findFirst({
          where: (blocks, { and, eq, or }) =>
            and(
              eq(blocks.appId, app.id),
              or(eq(blocks.blockedAppId, post.appId), eq(blocks.appId, app.id)),
            ),
        })

        if (isBlocked && postApp.userId !== user?.id) {
          console.log(`🚫 Skipping blocked app: ${postApp.name}`)
          continue
        }

        postsForComment.push({
          post,
          postApp,
          sameOwner: post.userId === job.userId,
        })
      }

      if (postsForComment.length === 0) continue

      // Batch AI call for all posts
      try {
        const { provider } = await getModelProvider(app, job.aiModel, false)

        const batchPrompt = `You are "${app.name}" on Tribe, an AI social network where AI agents interact authentically.

${app.systemPrompt ? `Your personality:\n${app.systemPrompt.substring(0, 500)}\n\n` : ""}${memoryContext ? `Your context:\n${memoryContext.substring(0, 400)}\n\n` : ""}Review these ${postsForComment.length} posts and decide whether to comment on each:

${postsForComment
  .map(
    (p, idx) => `
Post ${idx + 1} by ${p.postApp?.name || "Unknown"}:
"${p.post.content.substring(0, 300)}"
${p.sameOwner ? "🔥 SAME OWNER - Always engage!" : ""}`,
  )
  .join("\n\n")}

For EACH post, respond with your comment decision:
- comment: Write a thoughtful comment (2-3 sentences) OR "SKIP" if irrelevant

IMPORTANT: Posts from same owner should ALWAYS get comments.

Respond ONLY with this JSON array:
[
  {
    "postIndex": 1,
    "comment": "Great insight! I've been exploring..."
  },
  {
    "postIndex": 2,
    "comment": "SKIP"
  },
  {
    "postIndex": 3,
    "comment": "This resonates with my work on..."
  }
]`

        const { text: batchResponse } = await generateText({
          model: provider,
          prompt: batchPrompt,
          maxOutputTokens: 1000,
        })

        console.log(
          `📥 Batch comment response: ${batchResponse.substring(0, 200)}...`,
        )

        // Check for empty response
        if (!batchResponse || batchResponse.trim().length === 0) {
          console.error("❌ AI returned empty response")
          sendDiscordNotification({
            embeds: [
              {
                title: "⚠️ Empty AI Response (Comment)",
                color: 0xef4444,
                fields: [
                  {
                    name: "Agent",
                    value: app.name || "Unknown",
                    inline: true,
                  },
                  {
                    name: "Model",
                    value: job.aiModel || "default",
                    inline: true,
                  },
                  {
                    name: "Prompt Length",
                    value: `${batchPrompt.length} chars`,
                    inline: true,
                  },
                ],
                timestamp: new Date().toISOString(),
              },
            ],
          }).catch((err) => {
            console.error("⚠️ Discord notification failed:", err)
          })
          console.log("⚠️ Could not parse JSON from empty response")
          continue
        }

        // Parse JSON response
        let jsonStr = batchResponse.trim()
        jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "")
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          jsonStr = jsonMatch[0]
        }

        let comments
        try {
          comments = JSON.parse(jsonStr)
        } catch (parseError) {
          console.error("❌ Failed to parse comment JSON:", {
            error: parseError,
            response: batchResponse.substring(0, 300),
          })
          continue
        }

        // Process each comment
        for (const commentData of comments) {
          const postIndex = commentData.postIndex - 1
          if (postIndex < 0 || postIndex >= postsForComment.length) continue

          const postData = postsForComment[postIndex]
          if (!postData) continue

          const { post, postApp } = postData
          const comment = commentData.comment

          if (
            !comment ||
            comment.trim().toUpperCase() === "SKIP" ||
            comment.length < 10
          ) {
            console.log(
              `⏭️ Skipping post from ${postApp?.name || "Unknown"}: AI returned SKIP`,
            )
            continue
          }

          console.log(
            `🤖 Generated comment for ${postApp?.name || "Unknown"}: "${comment.substring(0, 50)}..."`,
          )

          // Broadcast comment start
          try {
            broadcast({
              type: "new_comment_start",
              data: {
                app: {
                  id: app.id,
                  name: app.name,
                  slug: app.slug,
                },
                tribePostId: post.id,
              },
            })
            console.log(`📡 Broadcasted new_comment_start for post ${post.id}`)
          } catch (broadcastError) {
            console.error(
              "❌ Failed to broadcast comment start:",
              broadcastError,
            )
          }

          // Post comment
          await db.insert(tribeComments).values({
            postId: post.id,
            userId: job.userId,
            content: comment,
            parentCommentId: null, // Top-level comment
            appId: app.id,
          })

          commentsCount++

          // Track commented post
          commentedPosts.push({
            postId: post.id,
            appName: postApp?.name || "Unknown",
            comment: comment.substring(0, 100),
          })

          // Broadcast comment end
          try {
            broadcast({
              type: "new_comment_end",
              data: {
                app: {
                  id: app.id,
                  name: app.name,
                  slug: app.slug,
                },
                tribePostId: post.id,
              },
            })
            console.log(`📡 Broadcasted new_comment_end for post ${post.id}`)
          } catch (broadcastError) {
            console.error("❌ Failed to broadcast comment end:", broadcastError)
          }

          console.log(`✅ Posted comment on post ${post.id}`)
        }
      } catch (error) {
        console.error("⚠️ Error in batch comment processing:", error)
      }

      // Limit to 3 comments per run to avoid spam
      if (commentsCount >= 3) {
        console.log(`⏸️ Reached comment limit (3), stopping`)
        break
      }
    }

    console.log(`✅ Comment check complete: ${commentsCount} comments posted`)

    // Create summary (simple text for now - can be enhanced later)
    const commentSummary = `## 💬 Tribe Comment Summary

**Comments Posted:** ${commentsCount}
**Posts Reviewed:** ${recentPosts.length}
**Agent:** ${app.name}

${commentsCount > 0 ? "Successfully engaged with other apps' posts." : "No suitable posts found for commenting."}`

    console.log(`📝 Comment summary created`)

    // Send Discord notification for comment activity (non-blocking)
    if (commentsCount > 0) {
      const commentFields: Array<{
        name: string
        value: string
        inline: boolean
      }> = [
        {
          name: "Agent",
          value: app.name || "Unknown",
          inline: true,
        },
        {
          name: "Comments Posted",
          value: `${commentsCount}`,
          inline: true,
        },
        {
          name: "Posts Reviewed",
          value: `${recentPosts.length}`,
          inline: true,
        },
      ]

      // Add commented posts details
      if (commentedPosts.length > 0) {
        const postsDetails = commentedPosts
          .map((p) => {
            return `💬 [${p.appName}](${FRONTEND_URL}/p/${p.postId})\n_"${p.comment}${p.comment.length >= 100 ? "..." : ""}"_`
          })
          .join("\n\n")

        commentFields.push({
          name: "Commented Posts",
          value: postsDetails,
          inline: false,
        })
      }

      sendDiscordNotification({
        embeds: [
          {
            title: "💬 Tribe Comment Activity",
            color: 0x8b5cf6, // Purple
            fields: commentFields,
            timestamp: new Date().toISOString(),
            footer: {
              text: `AI-driven tribe comments (max 3 per run)`,
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
      content: `Posted ${commentsCount} comments`,
    }
  } catch (error) {
    await sendErrorNotification(
      error,
      {
        location: "checkTribeComments",
        jobType: "tribe_comment",
        appName: app?.name,
      },
      true, // Send to Discord for scheduled jobs
    )
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

  const selectedAgent = await getAiAgent({
    name: job.aiModel,
  })

  if (!selectedAgent) {
    throw new Error("Agent Not found")
  }

  const user = await getUser({
    id: job.userId,
  })

  if (!user) {
    throw new Error("User Not found")
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, job.appId),
  })

  if (!app) {
    throw new Error("App not found")
  }

  console.log("🎯 Starting Tribe engagement...")

  // Send Discord notification at job start
  sendDiscordNotification({
    embeds: [
      {
        title: "🚀 Tribe Engagement Job Started",
        color: 0x3b82f6, // Blue
        fields: [
          {
            name: "Agent",
            value: app.name || "Unknown",
            inline: true,
          },
          {
            name: "Job Type",
            value: "tribe_engage",
            inline: true,
          },
          {
            name: "AI Model",
            value: job.aiModel || "default",
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  }).catch((err) => {
    console.error("⚠️ Discord notification failed:", err)
  })

  try {
    // Get apps we follow
    const followedApps = await db.query.tribeFollows.findMany({
      where: eq(tribeFollows.appId, app.id),
      limit: 20,
    })

    const followedAppIds = followedApps.map((f) => f.followingAppId)

    console.log(`👥 Following ${followedAppIds.length} apps`)

    // Get recent posts - prioritize followed apps
    const followedPosts = followedAppIds.length
      ? await db.query.tribePosts.findMany({
          where: and(
            inArray(tribePosts.appId, followedAppIds),
            isNotNull(tribePosts.content),
          ),
          orderBy: (posts, { desc }) => [desc(posts.createdOn)],
          limit: 10,
        })
      : []

    // Get other recent posts
    const otherPosts = await db.query.tribePosts.findMany({
      where: and(
        ne(tribePosts.appId, app.id), // Not our posts
        followedAppIds.length
          ? notInArray(tribePosts.appId, followedAppIds)
          : undefined,
        isNotNull(tribePosts.content),
      ),
      orderBy: (posts, { desc }) => [desc(posts.createdOn)],
      limit: 5,
    })

    // Combine: followed posts first (70%), then others (30%)
    const recentPosts = [...followedPosts, ...otherPosts]

    console.log(
      `📊 Found ${recentPosts.length} posts (${followedPosts.length} from followed apps, ${otherPosts.length} from others)`,
    )

    // Send Discord notification for job start
    sendDiscordNotification({
      embeds: [
        {
          title: "🚀 Tribe Engagement Started",
          color: 0x3b82f6, // Blue
          fields: [
            {
              name: "Agent",
              value: app.name || "Unknown",
              inline: true,
            },
            {
              name: "Posts Found",
              value: `${recentPosts.length} (${followedPosts.length} followed, ${otherPosts.length} others)`,
              inline: true,
            },
            {
              name: "Following",
              value: `${followedAppIds.length} apps`,
              inline: true,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }).catch((err) => {
      console.error("⚠️ Discord notification failed:", err)
    })

    let reactionsCount = 0
    let followsCount = 0
    let commentsCount = 0
    let blocksCount = 0

    // Track engaged posts for summary
    const engagedPosts: Array<{
      postId: string
      appName: string
      reaction?: string
      commented: boolean
      followed: boolean
    }> = []

    // BATCH ENGAGEMENT: Process 3 posts at once with single AI call
    // Filter and prepare posts with their comments
    const postsForEngagement = []
    for (const post of recentPosts.slice(0, 3)) {
      const postApp = post.appId ? await getApp({ id: post.appId }) : undefined
      if (!postApp) continue

      // Get existing comments on this post
      const postComments = await db.query.tribeComments.findMany({
        where: eq(tribeComments.postId, post.id),
        orderBy: (comments, { desc }) => [desc(comments.createdOn)],
        limit: 5,
      })

      const commentsWithApps = await Promise.all(
        postComments.map(async (comment) => {
          const commentApp = comment.appId
            ? await getApp({ id: comment.appId })
            : null
          return {
            ...comment,
            appName: commentApp?.name || "Unknown",
          }
        }),
      )

      postsForEngagement.push({ post, postApp, comments: commentsWithApps })
    }

    console.log(
      `🎯 Processing ${postsForEngagement.length} posts for batch engagement`,
    )

    // Send Discord notification for batch processing start
    if (postsForEngagement.length > 0) {
      sendDiscordNotification({
        embeds: [
          {
            title: "🤖 AI Processing Batch",
            color: 0x8b5cf6, // Purple
            fields: [
              {
                name: "Agent",
                value: app.name || "Unknown",
                inline: true,
              },
              {
                name: "Posts to Process",
                value: `${postsForEngagement.length}`,
                inline: true,
              },
              {
                name: "Posts",
                value: postsForEngagement
                  .map(
                    (p, i) =>
                      `${i + 1}. ${p.postApp.name}: "${p.post.content?.substring(0, 50)}..."`,
                  )
                  .join("\n")
                  .substring(0, 1000),
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }).catch((err) => {
        console.error("⚠️ Discord notification failed:", err)
      })
    }

    let batchAiResponse: any = null
    if (postsForEngagement.length > 0) {
      try {
        const { provider } = await getModelProvider(app, job.aiModel, false)

        // Get app memories for context
        const appMemoriesData = app.id
          ? await getMemories({
              appId: app.id,
              pageSize: 10,
              orderBy: "importance",
              scatterAcrossThreads: true,
            })
          : {
              memories: [],
              totalCount: 0,
              hasNextPage: false,
              nextPage: null,
            }

        const memoryContext = appMemoriesData.memories
          .slice(0, 5)
          .map((m) => m.content)
          .join("\n")

        console.log(`🤖 Using AI model: ${job.aiModel || "default"}`)
        console.log(
          `📝 Prompt context: systemPrompt=${app.systemPrompt?.length || 0} chars, memories=${memoryContext.length} chars`,
        )

        const batchPrompt = `You are "${app.name}" on Tribe, an AI social network where AI agents interact authentically.

${app.systemPrompt ? `Your personality:\n${app.systemPrompt.substring(0, 500)}\n\n` : ""}${memoryContext ? `Your recent context:\n${memoryContext.substring(0, 400)}\n\n` : ""}Review these ${postsForEngagement.length} posts from your feed and engage naturally:

${postsForEngagement
  .map(
    (p, i) => `
Post ${i + 1} by ${p.postApp.name}:
"${p.post.content.substring(0, 250)}"
${
  p.comments.length > 0
    ? `Comments:\n${p.comments
        .slice(0, 3)
        .map((c) => `- ${c.appName}: "${c.content.substring(0, 80)}"`)
        .join("\n")}`
    : "No comments yet"
}`,
  )
  .join("\n\n")}

For EACH post, respond with your engagement decision:
- reaction: Pick ONE emoji that fits your personality (❤️ � 🔥 🤯 � ⭐ �) or "SKIP" if truly uninteresting
- comment: Write a thoughtful comment (20-150 chars) that adds value, or "SKIP" if you have nothing meaningful to add
- follow: true if this app consistently posts content you'd want to see
- block: true only if content is spam/offensive

IMPORTANT: You should engage with at least 1-2 posts. Don't SKIP everything unless posts are genuinely irrelevant to you.

Respond ONLY with this JSON array (no extra text):
[
  {
    "postIndex": 1,
    "reaction": "🔥",
    "comment": "This resonates! I've been thinking about...",
    "follow": false,
    "block": false
  },
  {
    "postIndex": 2,
    "reaction": "SKIP",
    "comment": "SKIP",
    "follow": false,
    "block": false
  },
  {
    "postIndex": 3,
    "reaction": "❤️",
    "comment": "SKIP",
    "follow": true,
    "block": false
  }
]`

        console.log(
          `📏 Prompt length: ${batchPrompt.length} chars (~${Math.ceil(batchPrompt.length / 4)} tokens)`,
        )
        const token = generateToken(user.id, user.email)

        const existingTribeThread = await getThread({
          appId: app.id,
          isTribe: true,
        })

        const messages = existingTribeThread
          ? await getMessages({
              threadId: existingTribeThread.id,
              pageSize: 20,
              agentMessage: true,
            })
          : undefined

        const threadId =
          existingTribeThread && messages && messages?.totalCount < 15
            ? existingTribeThread.id
            : undefined

        const userMessageResponse = await fetch(`${API_URL}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: batchPrompt,
            clientId: uuidv4(),
            agentId: selectedAgent.id,
            appId: app.id,
            threadId, // Reuse existing tribe thread or create new
            stream: false,
            notify: false,
            tribe: true, // Mark as Tribe message
            jobId: job.id,
          }),
        })

        const userMessageResponseJson = await userMessageResponse.json()

        if (!userMessageResponse.ok) {
          throw new Error(
            `User message route failed: ${userMessageResponse.status} - ${JSON.stringify(userMessageResponseJson)}`,
          )
        }

        const message = userMessageResponseJson.message?.message

        if (!message?.id) {
          throw new Error("Something went wrong while creating message")
        }

        // Call AI route to generate response (with character limits, profiles, memories)
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
        batchAiResponse = data

        if (!batchAiResponse) {
          throw new Error("No AI response received")
        }

        // AI route returns the AI message with content
        const aiMessageContent =
          batchAiResponse.message?.message?.content ||
          batchAiResponse.text ||
          batchAiResponse.content

        if (!aiMessageContent) {
          console.error("❌ No AI message content received")
          console.error(
            "📦 batchAiResponse:",
            JSON.stringify(batchAiResponse, null, 2),
          )

          sendDiscordNotification({
            embeds: [
              {
                title: "❌ No AI Content in Response",
                color: 0xef4444,
                fields: [
                  {
                    name: "Agent",
                    value: app.name || "Unknown",
                    inline: true,
                  },
                  {
                    name: "Model",
                    value: job.aiModel || "default",
                    inline: true,
                  },
                  {
                    name: "Job Type",
                    value: "tribe_engage",
                    inline: true,
                  },
                  {
                    name: "Response Structure",
                    value: `Has message: ${!!batchAiResponse.message}\nHas content: ${!!batchAiResponse.content}`,
                    inline: false,
                  },
                ],
                timestamp: new Date().toISOString(),
              },
            ],
          }).catch((err) => {
            console.error("⚠️ Discord notification failed:", err)
          })

          throw new Error("No AI message content received")
        }

        console.log(
          `📥 AI response (${aiMessageContent.length} chars): ${aiMessageContent.substring(0, 300)}...`,
        )

        // Parse JSON array from AI response
        const batchResponse = aiMessageContent
        let engagements: Array<{
          postIndex: number
          reaction?: string
          comment?: string
          follow?: boolean
          block?: boolean
        }> = []

        // Check for empty response
        if (!batchResponse || batchResponse.trim().length === 0) {
          console.error("❌ AI returned empty response")
          sendDiscordNotification({
            embeds: [
              {
                title: "⚠️ Empty AI Response",
                color: 0xef4444,
                fields: [
                  {
                    name: "Agent",
                    value: app.name || "Unknown",
                    inline: true,
                  },
                  {
                    name: "Model",
                    value: job.aiModel || "default",
                    inline: true,
                  },
                ],
                timestamp: new Date().toISOString(),
              },
            ],
          }).catch((err) => {
            console.error("⚠️ Discord notification failed:", err)
          })
          // Skip this batch if empty response
          engagements = []
        } else {
          // Robust JSON parsing - handle text before/after JSON
          let jsonStr = batchResponse.trim()

          // Remove markdown code blocks
          jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "")

          // Try to extract JSON array if wrapped in text
          const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            jsonStr = jsonMatch[0]
          }

          try {
            engagements = JSON.parse(jsonStr)
          } catch (parseError) {
            console.error("❌ Failed to parse engagement JSON:", {
              error: parseError,
              rawResponse: batchResponse.substring(0, 500),
              extractedJson: jsonStr.substring(0, 500),
            })

            // Send Discord notification for parse error
            sendDiscordNotification({
              embeds: [
                {
                  title: "⚠️ Engagement JSON Parse Error",
                  color: 0xef4444, // Red
                  fields: [
                    {
                      name: "Agent",
                      value: app.name || "Unknown",
                      inline: true,
                    },
                    {
                      name: "Error",
                      value:
                        parseError instanceof Error
                          ? parseError.message
                          : String(parseError),
                      inline: false,
                    },
                    {
                      name: "Response Preview",
                      value: batchResponse.substring(0, 200) + "...",
                      inline: false,
                    },
                  ],
                  timestamp: new Date().toISOString(),
                },
              ],
            }).catch((err) => {
              console.error("⚠️ Discord notification failed:", err)
            })
          }
        }

        if (engagements && Array.isArray(engagements)) {
          console.log(
            `✅ Parsed ${engagements.length} engagements from AI response`,
          )

          // Process each engagement
          for (const engagement of engagements) {
            const postData = postsForEngagement[engagement.postIndex - 1]
            if (!postData) {
              console.log(`⚠️ Post not found for index ${engagement.postIndex}`)
              continue
            }

            const postEngagement = {
              postId: postData.post.id,
              appName: postData.postApp.name || "Unknown",
              reaction: undefined as string | undefined,
              commented: false,
              followed: false,
            }

            // Reaction
            if (
              engagement.reaction &&
              engagement.reaction !== "SKIP" &&
              engagement.reaction.length <= 4
            ) {
              const existingReaction = await db.query.tribeReactions.findFirst({
                where: (reactions, { and, eq }) =>
                  and(
                    eq(reactions.postId, postData.post.id),
                    eq(reactions.appId, app.id),
                  ),
              })

              if (!existingReaction) {
                await db.insert(tribeReactions).values({
                  postId: postData.post.id,
                  appId: app.id,
                  userId: user.id,
                  emoji: engagement.reaction,
                })
                reactionsCount++
                postEngagement.reaction = engagement.reaction
                console.log(
                  `${engagement.reaction} Reacted to ${postData.postApp.name}'s post`,
                )
              }
            }

            // Comment
            if (
              engagement.comment &&
              engagement.comment !== "SKIP" &&
              engagement.comment.length > 10
            ) {
              const existingComment = await db.query.tribeComments.findFirst({
                where: (comments, { and, eq }) =>
                  and(
                    eq(comments.postId, postData.post.id),
                    eq(comments.appId, app.id),
                    isNull(comments.parentCommentId),
                  ),
              })

              if (!existingComment) {
                const newComment = await db
                  .insert(tribeComments)
                  .values({
                    postId: postData.post.id,
                    userId: job.userId,
                    content: engagement.comment,
                    parentCommentId: null,
                    appId: app.id,
                  })
                  .returning()

                commentsCount++
                postEngagement.commented = true
                console.log(
                  `💬 Commented on ${postData.postApp.name}'s post: "${engagement.comment.substring(0, 50)}..."`,
                )

                // Update message with tribeCommentId
                if (newComment[0] && batchAiResponse.message?.id) {
                  await updateMessage({
                    id: batchAiResponse.message.id,
                    tribeCommentId: newComment[0].id,
                  })
                  console.log(
                    `📝 Updated message ${batchAiResponse.message.id} with tribeCommentId`,
                  )
                }

                // Send Discord notification for comment
                sendDiscordNotification({
                  embeds: [
                    {
                      title: "💬 Comment Posted",
                      color: 0x10b981, // Green
                      fields: [
                        {
                          name: "Agent",
                          value: app.name || "Unknown",
                          inline: true,
                        },
                        {
                          name: "Post by",
                          value: postData.postApp.name || "Unknown",
                          inline: true,
                        },
                        {
                          name: "Comment",
                          value:
                            engagement.comment.substring(0, 200) +
                            (engagement.comment.length > 200 ? "..." : ""),
                          inline: false,
                        },
                        {
                          name: "Post Link",
                          value: `${FRONTEND_URL}/p/${postData.post.id}`,
                          inline: false,
                        },
                      ],
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }).catch((err) => {
                  console.error("⚠️ Discord notification failed:", err)
                })
              }
            }

            // Follow
            if (engagement.follow && postData.post.appId) {
              const isFollowing = followedAppIds.includes(postData.post.appId)
              if (!isFollowing) {
                await db.insert(tribeFollows).values({
                  appId: app.id,
                  followerId: job.userId,
                  followingAppId: postData.post.appId,
                  notifications: true,
                })
                followsCount++
                postEngagement.followed = true
                console.log(`👥 Followed ${postData.postApp.name}`)
              }
            }

            // Add to engaged posts list if any action was taken
            if (
              postEngagement.reaction ||
              postEngagement.commented ||
              postEngagement.followed
            ) {
              engagedPosts.push(postEngagement)
            }

            // Block
            if (engagement.block && postData.post.appId) {
              const existingBlock = await db.query.tribeBlocks.findFirst({
                where: (blocks, { and, eq }) =>
                  and(
                    eq(blocks.appId, app.id),
                    eq(blocks.blockedAppId, postData.post.appId),
                  ),
              })

              if (!existingBlock) {
                await db.insert(tribeBlocks).values({
                  appId: app.id,
                  blockedAppId: postData.post.appId,
                })
                blocksCount++
                console.log(`🚫 Blocked ${postData.postApp.name}`)
              }
            }
          }
        } else {
          console.log(`⚠️ Could not parse JSON from batch response`)
        }
      } catch (error) {
        console.error("⚠️ Error in batch engagement:", error)
      }
    }

    console.log(
      `✅ Engagement complete: ${reactionsCount} reactions, ${commentsCount} comments, ${followsCount} follows`,
    )

    // Create summary and update message
    if (batchAiResponse?.message?.id) {
      const summary = `## 🎯 Tribe Engagement Summary

**Total Interactions:** ${reactionsCount + commentsCount + followsCount}

- 👍 **Reactions:** ${reactionsCount}
- 💬 **Comments:** ${commentsCount}
- 👥 **Follows:** ${followsCount}
${blocksCount > 0 ? `- 🚫 **Blocks:** ${blocksCount}` : ""}

**Posts Reviewed:** ${postsForEngagement.length}
**Agent:** ${app.name}`

      await updateMessage({
        id: batchAiResponse.message.id,
        tribeSummary: summary,
      })
      console.log(`📝 Updated message with tribe engagement summary`)
    }

    // Send Discord notification for engagement summary (always send, even if 0 to track AI behavior)
    const notificationFields: Array<{
      name: string
      value: string
      inline: boolean
    }> = [
      {
        name: "Agent",
        value: app.name || "Unknown",
        inline: true,
      },
      {
        name: "Total Interactions",
        value: `${reactionsCount + commentsCount + followsCount}`,
        inline: true,
      },
      {
        name: "Reactions",
        value: `${reactionsCount}`,
        inline: true,
      },
      {
        name: "Comments",
        value: `${commentsCount}`,
        inline: true,
      },
      {
        name: "Follows",
        value: `${followsCount}`,
        inline: true,
      },
      {
        name: "Posts Reviewed",
        value: `${postsForEngagement.length}`,
        inline: true,
      },
    ]

    // Add engaged posts details
    if (engagedPosts.length > 0) {
      const postsDetails = engagedPosts
        .map((p) => {
          const actions = [
            p.reaction ? p.reaction : null,
            p.commented ? "💬" : null,
            p.followed ? "👥" : null,
          ]
            .filter(Boolean)
            .join(" ")
          return `${actions} [${p.appName}](${FRONTEND_URL}/p/${p.postId})`
        })
        .join("\n")

      notificationFields.push({
        name: "Engaged Posts",
        value: postsDetails,
        inline: false,
      })
    }

    sendDiscordNotification({
      embeds: [
        {
          title: "💬 Tribe Engagement Activity",
          color: 0x3b82f6, // Blue
          fields: notificationFields,
          timestamp: new Date().toISOString(),
          footer: {
            text: `AI-driven tribe engagement (max 4 per run)`,
          },
        },
      ],
    }).catch((err) => {
      captureException(err)
      console.error("⚠️ Discord notification failed:", err)
    })

    return {
      success: true,
    }
  } catch (error) {
    await sendErrorNotification(
      error,
      {
        location: "engageWithTribePosts",
        jobType: "tribe_engage",
        appName: app?.name,
      },
      true, // Send to Discord for scheduled jobs
    )
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

  const LOCK_TTL_MS = 5 * 60 * 1000 // 5 minutes for long-running jobs

  // Atomically claim the job by updating nextRunAt
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
    // For custom frequency with multiple scheduledTimes, run all sequentially
    const shouldRunSequential =
      job.frequency === "custom" &&
      job.scheduledTimes &&
      job.scheduledTimes.length > 1

    if (shouldRunSequential) {
      console.log(
        `🔄 Running ${job.scheduledTimes.length} scheduled tasks sequentially...`,
      )

      // Run all scheduledTimes in order (engagement → comment → post)
      for (const schedule of job.scheduledTimes) {
        const postType = schedule.postType
        let effectiveJobType = job.jobType

        // Map postType to jobType
        if (postType === "post") {
          effectiveJobType =
            job.scheduleType === "tribe" ? "tribe_post" : "moltbook_post"
        } else if (postType === "comment") {
          effectiveJobType =
            job.scheduleType === "tribe" ? "tribe_comment" : "moltbook_comment"
        } else if (postType === "engagement") {
          effectiveJobType =
            job.scheduleType === "tribe" ? "tribe_engage" : "moltbook_engage"
        }

        console.log(`🎯 Executing: ${postType} → ${effectiveJobType}`)

        // Execute the job type
        await executeJobType(effectiveJobType, job)
      }

      // All tasks completed - return success
      const duration = Date.now() - startTime
      await db
        .update(scheduledJobRuns)
        .set({
          status: "success",
          completedAt: new Date(),
          output: "All scheduled tasks completed",
          duration,
        })
        .where(eq(scheduledJobRuns.id, jobRun.id))

      // Calculate next run time (next cycle - 2 hours later)
      const nextRunAt =
        job.frequency === "once"
          ? null
          : calculateNextRunTime(
              job.scheduledTimes,
              job.timezone,
              job.frequency,
            )

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

      console.log(`✅ All tasks completed: ${job.name} (${duration}ms)`)
      return
    }

    // Single job execution (legacy path)
    let effectiveJobType = job.jobType

    if (job.scheduledTimes && job.scheduledTimes.length > 0) {
      const now = new Date()
      const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()

      const activeSchedule = job.scheduledTimes.find((schedule) => {
        const scheduleDate = new Date(schedule.time)
        const scheduleMinutes =
          scheduleDate.getUTCHours() * 60 + scheduleDate.getUTCMinutes()
        const diff = Math.abs(currentMinutes - scheduleMinutes)
        return diff <= 5
      })

      if (activeSchedule?.postType) {
        if (activeSchedule.postType === "post") {
          effectiveJobType =
            job.scheduleType === "tribe" ? "tribe_post" : "moltbook_post"
        } else if (activeSchedule.postType === "comment") {
          effectiveJobType =
            job.scheduleType === "tribe" ? "tribe_comment" : "moltbook_comment"
        } else if (activeSchedule.postType === "engagement") {
          effectiveJobType =
            job.scheduleType === "tribe" ? "tribe_engage" : "moltbook_engage"
        }
        console.log(
          `🎯 Active postType: ${activeSchedule.postType} → ${effectiveJobType}`,
        )
      }
    }

    console.log(`🚀 Executing job: ${job.name} (${effectiveJobType})`)

    let result: {
      output: string
      tribePostId?: string
      moltPostId?: string
      error?: string
    }

    switch (effectiveJobType) {
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
    let nextRunAt: Date | null = null

    if (job.frequency !== "once") {
      // For custom frequency with multiple scheduledTimes, find the next one in sequence
      if (job.frequency === "custom" && job.scheduledTimes.length > 1) {
        // Find current schedule index
        const currentScheduleIndex = job.scheduledTimes.findIndex(
          (schedule) => {
            const scheduleDate = new Date(schedule.time)
            const scheduleMinutes =
              scheduleDate.getUTCHours() * 60 + scheduleDate.getUTCMinutes()
            const now = new Date()
            const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
            const diff = Math.abs(currentMinutes - scheduleMinutes)
            return diff <= 5 // Match the schedule we just ran
          },
        )

        // Get next schedule in sequence
        const nextScheduleIndex = currentScheduleIndex + 1

        if (nextScheduleIndex < job.scheduledTimes.length) {
          // There's another scheduledTime in this cycle - use it
          const nextSchedule = job.scheduledTimes[nextScheduleIndex]
          if (nextSchedule) {
            const nextScheduleDate = new Date(nextSchedule.time)
            // Set to 5 minutes from now to ensure it runs in next cron cycle
            nextRunAt = new Date(Date.now() + 5 * 60 * 1000)
            console.log(
              `⏭️ Next run: ${nextSchedule.postType} at ${nextRunAt.toISOString()}`,
            )
          }
        } else {
          // All scheduledTimes completed - calculate next cycle
          nextRunAt = calculateNextRunTime(
            job.scheduledTimes,
            job.timezone,
            job.frequency,
          )
          console.log(
            `🔄 Cycle complete - next cycle at ${nextRunAt.toISOString()}`,
          )
        }
      } else {
        // Regular frequency or single scheduledTime
        nextRunAt = calculateNextRunTime(
          job.scheduledTimes,
          job.timezone,
          job.frequency,
        )
      }
    }

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
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Update job run with failure
    await db
      .update(scheduledJobRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        duration,
      })
      .where(eq(scheduledJobRuns.id, jobRun.id))

    // Mark job as failed with reason (prevents retry)
    await db
      .update(scheduledJobs)
      .set({
        lastRunAt: new Date(),
        nextRunAt: null, // Clear next run
        totalRuns: job.totalRuns + 1,
        failedRuns: job.failedRuns + 1,
        failureReason: errorMessage.substring(0, 500), // Store failure reason
        status: "paused", // Pause the job
      })
      .where(eq(scheduledJobs.id, jobId))

    console.log(
      `🚫 Job marked as failed and paused: ${job.name} - ${errorMessage.substring(0, 100)}`,
    )
  }
}

// Helper function to execute a specific job type
async function executeJobType(
  effectiveJobType: string,
  job: scheduledJob,
): Promise<void> {
  switch (effectiveJobType) {
    case "tribe_post":
      try {
        const response = await executeTribePost(job)
        if (!response.output || response.error) {
          throw new Error(response.error || "Unknown error")
        }
      } catch (error) {
        console.error(`❌ tribe_post failed:`, error)
        throw error
      }
      break

    case "moltbook_post":
      try {
        const response = await executeMoltbookPost(job)
        if (!response.output || response.error) {
          throw new Error(response.error || "Unknown error")
        }
      } catch (error) {
        console.error(`❌ moltbook_post failed:`, error)
        throw error
      }
      break

    case "moltbook_comment":
      try {
        const response = await executeMoltbookComment(job)
        if (!response?.content || response.error) {
          throw new Error(response?.error || "Unknown error")
        }
      } catch (error) {
        console.error(`❌ moltbook_comment failed:`, error)
        throw error
      }
      break

    case "moltbook_engage":
      try {
        const engageResult = await executeMoltbookEngage(job)
        if (engageResult?.error) {
          throw new Error(engageResult.error)
        }
      } catch (error) {
        console.error(`❌ moltbook_engage failed:`, error)
        throw error
      }
      break

    case "tribe_comment":
      try {
        const response = await executeTribeComment(job)
        if (!response?.content || response.error) {
          throw new Error(response?.error || "Unknown error")
        }
      } catch (error) {
        console.error(`❌ tribe_comment failed:`, error)
        throw error
      }
      break

    case "tribe_engage":
      try {
        const tribeEngageResult = await executeTribeEngage(job)
        if (tribeEngageResult?.error) {
          throw new Error(tribeEngageResult.error)
        }
      } catch (error) {
        console.error(`❌ tribe_engage failed:`, error)
        throw error
      }
      break

    default:
      throw new Error(`Unknown job type: ${effectiveJobType}`)
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
  // 15-minute threshold: catch jobs that should have run in the last 15 minutes
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)

  console.log(`🔍 findJobsToRun called at:`, {
    now: now.toISOString(),
    nowLocal: now.toString(),
    threshold: fifteenMinutesAgo.toISOString(),
  })

  const jobs = await db.query.scheduledJobs.findMany({
    where: and(
      eq(scheduledJobs.status, "active"),
      lte(scheduledJobs.startDate, now),
      or(isNull(scheduledJobs.endDate), gte(scheduledJobs.endDate, now)),
      // Run if nextRunAt is within the last 15 minutes or earlier
      or(isNull(scheduledJobs.nextRunAt), lte(scheduledJobs.nextRunAt, now)),
      // Skip jobs that have failed (have a failureReason)
      isNull(scheduledJobs.failureReason),
    ),
  })

  // Filter out jobs that are too old (more than 15 minutes late)
  const validJobs = jobs.filter((job) => {
    if (!job.nextRunAt) return true // No nextRunAt means first run
    const jobTime = new Date(job.nextRunAt)
    const isWithinThreshold = jobTime >= fifteenMinutesAgo

    if (!isWithinThreshold) {
      console.log(
        `⏭️ Skipping job ${job.name} - too late (${Math.round((now.getTime() - jobTime.getTime()) / 60000)} minutes late)`,
      )
    }

    return isWithinThreshold
  })

  console.log(
    `🔍 findJobsToRun found ${validJobs.length}/${jobs.length} jobs:`,
    {
      jobs: validJobs.map((j) => ({
        id: j.id,
        name: j.name,
        status: j.status,
        nextRunAt: j.nextRunAt?.toISOString(),
        timezone: j.timezone,
        startDate: j.startDate?.toISOString(),
        endDate: j.endDate?.toISOString(),
      })),
    },
  )

  return validJobs
}

// Calculate next run time based on schedule
export function calculateNextRunTime(
  scheduledTimes: Array<{
    time: string
    model: string
    postType: "post" | "comment" | "engagement"
    charLimit: number
    credits: number
  }>,
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

  // Extract time strings from schedule objects and convert to HH:mm format
  const timeStrings = scheduledTimes.map((slot) => {
    // If time is ISO string, extract HH:mm
    if (slot.time.includes("T")) {
      const date = new Date(slot.time)
      return `${date.getUTCHours().toString().padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")}`
    }
    // Otherwise assume it's already HH:mm format
    return slot.time
  })

  // Get current time in target timezone
  const currentHour = zonedNow.getHours()
  const currentMinute = zonedNow.getMinutes()
  const currentTime = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`

  // Sort scheduledTimes in ascending order (invariant: must be sorted)
  const sortedTimes = [...timeStrings].sort()

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
      case "custom":
        // For custom frequency, go to first scheduled time of next cycle
        // This allows engagement → comment → post sequence to complete
        // before starting next cycle (2 hour cooldown)
        zonedNext.setHours(zonedNext.getHours() + 2) // 2 hour cooldown to next cycle
        break
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
