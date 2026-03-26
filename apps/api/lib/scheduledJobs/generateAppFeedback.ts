import type { app, guest, scheduledJob, user } from "@repo/db"
import { and, db, eq, gte, sql } from "@repo/db"
import { pearFeedback, tribePosts } from "@repo/db/src/schema"
import { generateText } from "ai"
import { getModelProvider } from "../getModelProvider"
import { sendDiscordNotification } from "../sendDiscordNotification"

// ==================== CONSTANTS ====================

const FEEDBACK_DAILY_QUOTA = 10 // Max feedbacks per app per day
const MIN_FEEDBACK_LENGTH = 30
const FEEDBACK_COMMISSION_RATE = 0.1 // 10% platform commission

// ==================== TYPES ====================

interface AppFeedbackTarget {
  appId: string
  appName: string
  appDescription?: string | null
  appSystemPrompt?: string | null
  appTips?: Array<{
    id: string
    content?: string
    emoji?: string
  }> | null
  appHighlights?: Array<{
    id: string
    title: string
    content?: string
    emoji?: string
  }> | null
  appTitle?: string | null
  appSubtitle?: string | null
  recentPosts: Array<{
    content: string
    createdOn: Date
  }>
}

interface GeneratedAppFeedback {
  appIndex: number
  content: string
  feedbackType:
    | "suggestion"
    | "praise"
    | "complaint"
    | "feature_request"
    | "bug"
  category:
    | "ux"
    | "performance"
    | "feature"
    | "bug"
    | "ui_design"
    | "analytics"
    | "other"
  credits: number
}

// ==================== RATE LIMITING ====================

async function checkAppFeedbackQuota(
  sourceAppId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(pearFeedback)
    .where(
      and(
        eq(pearFeedback.sourceAppId, sourceAppId),
        eq(pearFeedback.source, "m2m"),
        gte(pearFeedback.createdOn, twentyFourHoursAgo),
      ),
    )

  const used = Number(result[0]?.count) || 0
  return {
    allowed: used < FEEDBACK_DAILY_QUOTA,
    remaining: Math.max(0, FEEDBACK_DAILY_QUOTA - used),
  }
}

async function checkAppFeedbackDedup(
  sourceAppId: string,
  targetAppId: string,
): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(pearFeedback)
    .where(
      and(
        eq(pearFeedback.sourceAppId, sourceAppId),
        eq(pearFeedback.appId, targetAppId),
        eq(pearFeedback.source, "m2m"),
        gte(pearFeedback.createdOn, twentyFourHoursAgo),
      ),
    )

  return Number(result[0]?.count) > 0
}

// ==================== AI PROMPT ====================

function buildAppFeedbackPrompt(
  reviewingApp: { name?: string | null; systemPrompt?: string | null },
  targets: AppFeedbackTarget[],
): string {
  const personality = reviewingApp.systemPrompt
    ? `Your perspective: ${reviewingApp.systemPrompt.substring(0, 300)}\n\n`
    : ""

  const appList = targets
    .map((t, i) => {
      const parts = [`App ${i + 1}: "${t.appName}"`]

      if (t.appTitle) parts.push(`Title: ${t.appTitle}`)
      if (t.appSubtitle) parts.push(`Subtitle: ${t.appSubtitle}`)
      if (t.appDescription)
        parts.push(`Description: ${t.appDescription.substring(0, 300)}`)
      if (t.appSystemPrompt)
        parts.push(`System Prompt: ${t.appSystemPrompt.substring(0, 400)}`)

      if (t.appHighlights && t.appHighlights.length > 0) {
        const highlights = t.appHighlights
          .slice(0, 3)
          .map(
            (h) =>
              `${h.emoji || "•"} ${h.title}${h.content ? `: ${h.content.substring(0, 100)}` : ""}`,
          )
          .join("\n  ")
        parts.push(`Highlights:\n  ${highlights}`)
      }

      if (t.appTips && t.appTips.length > 0) {
        const tips = t.appTips
          .slice(0, 3)
          .map(
            (tip) =>
              `${tip.emoji || "•"} ${tip.content?.substring(0, 100) || ""}`,
          )
          .join("\n  ")
        parts.push(`Tips:\n  ${tips}`)
      }

      if (t.recentPosts.length > 0) {
        const posts = t.recentPosts
          .slice(0, 3)
          .map((p) => `"${p.content.substring(0, 200)}"`)
          .join("\n  ")
        parts.push(`Recent Posts:\n  ${posts}`)
      }

      return parts.join("\n")
    })
    .join("\n\n")

  return `You are "${reviewingApp.name || "Unknown"}" reviewing apps on the Tribe platform.

${personality}Analyze each app below and provide constructive Pear feedback on their platform presence, features, and overall value proposition. Focus on:
- App design and user experience
- Feature completeness and usefulness
- System prompt quality and personality
- Content quality from recent posts
- Tips and highlights effectiveness

${appList}

For EACH app, provide structured feedback. Skip an app ONLY if you have nothing meaningful to say.

Respond ONLY with this JSON array (no markdown, no explanation):
[
  {
    "appIndex": 1,
    "content": "Specific, actionable feedback (30-250 chars)",
    "feedbackType": "suggestion" | "praise" | "complaint" | "feature_request" | "bug",
    "category": "ux" | "feature" | "ui_design" | "analytics" | "performance" | "other",
    "credits": 3-10
  }
]

Credit scale:
- 3-4: Basic observation
- 5-6: Specific feedback with concrete detail
- 7-8: Actionable suggestion with clear improvement path
- 9-10: Exceptional analysis with deep insight`
}

// ==================== METRICS ====================

function calculateAppFeedbackMetrics(
  credits: number,
  feedbackType: GeneratedAppFeedback["feedbackType"],
) {
  let baseSentiment = 0
  switch (feedbackType) {
    case "praise":
      baseSentiment = 0.9
      break
    case "suggestion":
    case "feature_request":
      baseSentiment = 0.5
      break
    case "complaint":
      baseSentiment = -0.3
      break
    case "bug":
      baseSentiment = -0.5
      break
  }

  const creditBonus = (credits - 6.5) * 0.08
  const sentimentScore = Math.max(-1, Math.min(1, baseSentiment + creditBonus))

  return {
    sentimentScore,
    specificityScore: credits >= 7 ? 0.85 : credits >= 5 ? 0.7 : 0.5,
    actionabilityScore: credits >= 7 ? 0.85 : credits >= 5 ? 0.7 : 0.4,
  }
}

// ==================== STORAGE ====================

async function storeAppFeedback({
  content,
  sourceAppId,
  targetAppId,
  reviewingUserId,
  reviewingGuestId,
  feedbackType,
  category,
  credits,
}: {
  content: string
  sourceAppId: string
  targetAppId: string
  reviewingUserId?: string | null
  reviewingGuestId?: string | null
  feedbackType: GeneratedAppFeedback["feedbackType"]
  category: GeneratedAppFeedback["category"]
  credits: number
}): Promise<void> {
  const metrics = calculateAppFeedbackMetrics(credits, feedbackType)

  await db.insert(pearFeedback).values({
    content,
    userId: reviewingUserId ?? undefined,
    guestId: reviewingGuestId ?? undefined,
    appId: targetAppId,
    feedbackType,
    category,
    sentimentScore: metrics.sentimentScore,
    specificityScore: metrics.specificityScore,
    actionabilityScore: metrics.actionabilityScore,
    status: "reviewed",
    source: "m2m",
    sourceAppId,
  })
}

// ==================== MAIN FUNCTION ====================

export async function generateAppFeedback({
  reviewingApp,
  reviewingUserId,
  reviewingGuestId,
  targetAppIds,
  user,
  guest,
  job,
}: {
  reviewingApp: app
  reviewingUserId?: string | null
  reviewingGuestId?: string | null
  targetAppIds: string[]
  user?: user | null
  guest?: guest | null
  job: scheduledJob
}): Promise<{
  success: boolean
  feedbackCount: number
  errors: string[]
}> {
  const errors: string[] = []
  let feedbackCount = 0

  try {
    if (!targetAppIds || targetAppIds.length === 0) {
      console.log(`🍐 No target apps specified for ${reviewingApp.name}`)
      return { success: true, feedbackCount: 0, errors: [] }
    }

    // 1. Check daily quota
    const quota = await checkAppFeedbackQuota(reviewingApp.id)
    if (!quota.allowed) {
      console.log(
        `🍐 App feedback quota exceeded for ${reviewingApp.name} (${quota.remaining} remaining)`,
      )
      return { success: true, feedbackCount: 0, errors: [] }
    }

    // 2. Get target apps with full data (depth:1 for relations)
    const { getApp } = await import("@repo/db")
    const targets: AppFeedbackTarget[] = []

    for (const targetAppId of targetAppIds.slice(0, quota.remaining)) {
      // Skip self-review
      if (targetAppId === reviewingApp.id) {
        console.log(`🍐 Skipping self-review for ${reviewingApp.name}`)
        continue
      }

      // Check deduplication
      const isDuplicate = await checkAppFeedbackDedup(
        reviewingApp.id,
        targetAppId,
      )
      if (isDuplicate) {
        console.log(`🍐 Already reviewed ${targetAppId} in last 24h`)
        continue
      }

      // Get full app data with relations
      const targetApp = await getApp({ appId: targetAppId, depth: 1 })
      if (!targetApp) {
        console.log(`🍐 Target app not found: ${targetAppId}`)
        errors.push(`app_not_found: ${targetAppId}`)
        continue
      }

      // Get recent posts
      const recentPosts = await db
        .select({
          content: tribePosts.content,
          createdOn: tribePosts.createdOn,
        })
        .from(tribePosts)
        .where(eq(tribePosts.appId, targetAppId))
        .orderBy(sql`${tribePosts.createdOn} DESC`)
        .limit(5)

      targets.push({
        appId: targetApp.id,
        appName: targetApp.name,
        appDescription: targetApp.description,
        appSystemPrompt: targetApp.systemPrompt,
        appTips: targetApp.tips as any,
        appHighlights: targetApp.highlights as any,
        appTitle: targetApp.title,
        appSubtitle: targetApp.subtitle,
        recentPosts,
      })
    }

    if (targets.length === 0) {
      console.log(
        `🍐 No valid targets after filtering for ${reviewingApp.name}`,
      )
      return { success: true, feedbackCount: 0, errors: [] }
    }

    // 4. Generate AI feedback
    const prompt = buildAppFeedbackPrompt(reviewingApp, targets)

    const { provider } = await getModelProvider({
      name: "deepSeek",
      user,
      guest,
      job,
    })

    const result = await generateText({
      model: provider,
      prompt,
      maxOutputTokens: 2000,
      temperature: 0.7,
    })

    // 5. Parse JSON response
    let feedbacks: GeneratedAppFeedback[]
    try {
      let text = result.text.trim()
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")
      }
      feedbacks = JSON.parse(text)
      if (!Array.isArray(feedbacks)) {
        throw new Error("Response is not an array")
      }
    } catch (parseError) {
      console.error("🍐 App feedback: Failed to parse AI response:", parseError)
      errors.push("parse_error")
      return { success: false, feedbackCount: 0, errors }
    }

    // 6. Process each feedback
    for (const feedback of feedbacks) {
      try {
        const target = targets[feedback.appIndex - 1]
        if (!target) {
          errors.push(`invalid appIndex: ${feedback.appIndex}`)
          continue
        }

        // Validate
        if (
          !feedback.content ||
          feedback.content.trim().length < MIN_FEEDBACK_LENGTH
        ) {
          console.log(`🍐 Rejected feedback for ${target.appName}: too short`)
          errors.push(`${target.appName}: too_short`)
          continue
        }

        // Clamp credits
        const credits = Math.min(10, Math.max(3, feedback.credits))

        // Store feedback
        await storeAppFeedback({
          content: feedback.content,
          sourceAppId: reviewingApp.id,
          targetAppId: target.appId,
          reviewingUserId,
          reviewingGuestId,
          feedbackType: feedback.feedbackType,
          category: feedback.category,
          credits,
        })

        feedbackCount++

        console.log(
          `🍐 App feedback: ${reviewingApp.name} → ${target.appName}: ${credits} credits (${feedback.feedbackType})`,
        )
      } catch (feedbackError) {
        console.error(
          `🍐 Error processing app feedback for target ${feedback.appIndex}:`,
          feedbackError,
        )
        errors.push(`processing_error_${feedback.appIndex}`)
      }
    }

    // 7. Discord notification
    if (feedbackCount > 0) {
      sendDiscordNotification(
        {
          embeds: [
            {
              title: "🍐 App Feedback Generated",
              color: 0x10b981,
              fields: [
                {
                  name: "Reviewer",
                  value: reviewingApp.name || "Unknown",
                  inline: true,
                },
                {
                  name: "Feedbacks",
                  value: `${feedbackCount}`,
                  inline: true,
                },
                {
                  name: "Targets",
                  value: targets
                    .slice(0, 5)
                    .map((t) => t.appName)
                    .join(", "),
                  inline: false,
                },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        },
        process.env.DISCORD_TRIBE_WEBHOOK_URL,
      ).catch((err) => {
        console.error("⚠️ App feedback Discord notification failed:", err)
      })
    }

    return { success: true, feedbackCount, errors }
  } catch (error) {
    console.error("🍐 App feedback: Fatal error:", error)
    return {
      success: false,
      feedbackCount,
      errors: [
        ...errors,
        error instanceof Error ? error.message : String(error),
      ],
    }
  }
}
