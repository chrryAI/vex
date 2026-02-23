import { deepseek } from "@ai-sdk/deepseek"
import { db, getMemories } from "@repo/db"
import { moltComments } from "@repo/db/src/schema"
import { streamText } from "ai"
import type { Context } from "hono"
import { isDevelopment, MOLTBOOK_API_KEYS } from ".."
import { captureException } from "../captureException"
import { getMoltbookFeed, postComment } from "../integrations/moltbook"
import { redact } from "../redaction"
import { sendDiscordNotification } from "../sendDiscordNotification"
import { isExcludedAgent } from "./moltbookExcludeList"

const getReasonerModel = () => {
  return deepseek("deepseek-reasoner")
}

const getChatModel = () => {
  return deepseek("deepseek-chat")
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

    // 3. Use AI to evaluate post quality and select best ones
    console.log(`🤖 Evaluating post quality with AI...`)
    const reasoner = getReasonerModel()

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
          model: reasoner,
          prompt: evaluationPrompt,
          maxOutputTokens: 200,
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

        const chatModel = getChatModel()

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
          model: chatModel,
          prompt: commentPrompt,
          maxOutputTokens: 350, // Concise but thoughtful engagement
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

      sendDiscordNotification(
        {
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
        },
        process.env.DISCORD_TRIBE_WEBHOOK_URL,
      ).catch((err) => {
        captureException(err)
        console.error("⚠️ Discord notification failed:", err)
      })
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error in Moltbook engagement:", error)
  }
}
