import type { app, guest, scheduledJob, user } from "@repo/db"
import { and, db, eq, gte, sql } from "@repo/db"
import { pearFeedback } from "@repo/db/src/schema"
import { sendDiscordNotification } from "../sendDiscordNotification"

// ==================== CONSTANTS ====================

const FEEDBACK_DAILY_QUOTA = 10 // Max feedbacks per app per day
const MIN_FEEDBACK_LENGTH = 30
const FEEDBACK_COMMISSION_RATE = 0.1 // 10% platform commission

// ==================== TYPES ====================

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
  targetAppIds,
  job,
}: {
  targetAppIds: string[]
  job: scheduledJob
}): Promise<{
  success: boolean
  feedbackCount: number
  errors: string[]
}> {
  const errors: string[] = []
  let feedbackCount = 0

  const reviewingApp = job.appId
    ? await getApp({
        id: job.appId,
      })
    : null

  if (!reviewingApp) {
    throw new Error("ReviewingApp is not found")
  }

  const reviewingUserId = reviewingApp.userId
  const reviewingGuestId = reviewingApp.guestId

  const user = reviewingUserId ? await getUser({ id: reviewingUserId }) : null

  const guest = reviewingGuestId
    ? await getGuest({ id: reviewingGuestId })
    : null

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

      validTargetIds.push(targetAppId)
    }

    if (validTargetIds.length === 0) {
      console.log(
        `🍐 No valid targets after filtering for ${reviewingApp.name}`,
      )
      return { success: true, feedbackCount: 0, errors: [] }
    }

    // 3. Call AI route for rich feedback generation
    const baseUrl = process.env.API_URL || "http://localhost:3000"
    const prompt = `Review the following apps and provide constructive Pear feedback. Analyze their:
- Character profiles and personality
- Recent posts and content quality
- App features, tips, and highlights
- Overall platform presence and value

For each app, provide specific, actionable feedback (30-250 chars) with a feedbackType (suggestion/praise/complaint/feature_request/bug), category (ux/feature/ui_design/analytics/performance/other), and credit score (3-10).

Respond with a JSON array of feedback objects.`

    const response = await fetch(`${baseUrl}/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        appId: reviewingApp.id,
        userId: reviewingUserId,
        guestId: reviewingGuestId,
        feedbackAppIds: validTargetIds,
        model: "deepSeek",
        maxTokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `AI route failed: ${response.status} ${response.statusText}`,
      )
    }

    const aiResult = await response.json()

    // 4. Parse AI response
    let feedbacks: GeneratedAppFeedback[]
    try {
      let text = aiResult.content || aiResult.text || ""
      text = text.trim()
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

    // 5. Process each feedback
    for (const feedback of feedbacks) {
      try {
        const targetAppId = validTargetIds[feedback.appIndex - 1]
        if (!targetAppId) {
          errors.push(`invalid appIndex: ${feedback.appIndex}`)
          continue
        }

        // Validate
        if (
          !feedback.content ||
          feedback.content.trim().length < MIN_FEEDBACK_LENGTH
        ) {
          console.log(`🍐 Rejected feedback for app ${targetAppId}: too short`)
          errors.push(`${targetAppId}: too_short`)
          continue
        }

        // Clamp credits
        const credits = Math.min(10, Math.max(3, feedback.credits))

        // Store feedback
        await storeAppFeedback({
          content: feedback.content,
          sourceAppId: reviewingApp.id,
          targetAppId,
          reviewingUserId,
          reviewingGuestId,
          feedbackType: feedback.feedbackType,
          category: feedback.category,
          credits,
        })

        feedbackCount++

        console.log(
          `🍐 App feedback: ${reviewingApp.name} → ${targetAppId}: ${credits} credits (${feedback.feedbackType})`,
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
