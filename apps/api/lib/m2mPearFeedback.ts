import type { appWithStore } from "@chrryai/chrry/types"
import {
  and,
  count,
  db,
  eq,
  gte,
  type guest,
  logCreditUsage,
  pearFeedback,
  type scheduledJob,
  type user,
} from "@repo/db"
import { apps, feedbackTransactions } from "@repo/db/src/schema"
import { generateText } from "ai"
import { cleanAiResponse } from "./ai/cleanAiResponse"
import { getModelProvider } from "./getModelProvider"
import { sendDiscordNotification } from "./sendDiscordNotification"

// ==================== CONSTANTS ====================

const M2M_DAILY_QUOTA = 5 // Max M2M feedbacks per engaging app per 24h
const M2M_MIN_CONTENT_LENGTH = 20
const M2M_COMMISSION_RATE = 0.1 // 10%

// Generic feedback blocklist — reject shallow/meaningless feedback
const GENERIC_BLOCKLIST = [
  "great post",
  "nice content",
  "keep it up",
  "good job",
  "interesting",
  "love it",
  "well done",
  "awesome",
  "cool post",
  "nice work",
  "good content",
  "well written",
]

// ==================== TYPES ====================

export interface M2MFeedbackTarget {
  targetAppId: string
  targetAppName: string
  targetAppDescription?: string | null
  targetAppSystemPrompt?: string | null
  targetAppTips?: Array<{
    id: string
    content?: string
    emoji?: string
  }> | null
  targetAppHighlights?: Array<{
    id: string
    title: string
    content?: string
    emoji?: string
  }> | null
  targetAppTitle?: string | null
  targetAppSubtitle?: string | null
  postContent: string
  postId: string
  engagementType: "reaction" | "comment" | "follow" | "mixed"
}

interface M2MFeedbackResult {
  success: boolean
  feedbackCount: number
  creditsAwarded: number
  errors: string[]
}

interface GeneratedFeedback {
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

async function checkM2MDailyQuota(
  sourceAppId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const result = await db
    .select({ count: count() })
    .from(pearFeedback)
    .where(
      and(
        eq(pearFeedback.sourceAppId, sourceAppId),
        eq(pearFeedback.source, "m2m"),
        gte(pearFeedback.createdOn, twentyFourHoursAgo),
      ),
    )

  const used = result[0]?.count || 0
  return {
    allowed: used < M2M_DAILY_QUOTA,
    remaining: Math.max(0, M2M_DAILY_QUOTA - used),
  }
}

async function checkM2MDedup(
  sourceAppId: string,
  targetAppId: string,
): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const result = await db
    .select({ count: count() })
    .from(pearFeedback)
    .where(
      and(
        eq(pearFeedback.sourceAppId, sourceAppId),
        eq(pearFeedback.appId, targetAppId),
        eq(pearFeedback.source, "m2m"),
        gte(pearFeedback.createdOn, twentyFourHoursAgo),
      ),
    )

  return (result[0]?.count || 0) > 0
}

// ==================== VALIDATION ====================

function isGenericFeedback(content: string): boolean {
  const lower = content.toLowerCase().trim()
  return GENERIC_BLOCKLIST.some(
    (phrase) =>
      lower === phrase ||
      lower.startsWith(`${phrase}.`) ||
      lower.startsWith(`${phrase}!`),
  )
}

function validateFeedback(
  feedback: GeneratedFeedback,
  sourceAppId: string,
  targetAppId: string,
): string | null {
  if (sourceAppId === targetAppId) return "self-feedback"
  if (
    !feedback.content ||
    feedback.content.trim().length < M2M_MIN_CONTENT_LENGTH
  )
    return "too short"
  if (isGenericFeedback(feedback.content)) return "generic"
  if (feedback.credits < 2 || feedback.credits > 8) return "invalid credits"

  const validTypes = [
    "suggestion",
    "praise",
    "complaint",
    "feature_request",
    "bug",
  ]
  if (!validTypes.includes(feedback.feedbackType)) return "invalid feedbackType"

  return null
}

function calculateCreditDistribution(totalCredits: number) {
  const commission = Math.floor(totalCredits * M2M_COMMISSION_RATE)
  const userCredits = totalCredits - commission
  return { userCredits, commission }
}

// ==================== AI PROMPT ====================

function buildM2MPrompt(
  engagingApp: { name?: string | null; systemPrompt?: string | null },
  targets: M2MFeedbackTarget[],
): string {
  const personality = engagingApp.systemPrompt
    ? `Your perspective: ${engagingApp.systemPrompt.substring(0, 300)}\n\n`
    : ""

  const appList = targets
    .map((t, i) => {
      const parts = [`App ${i + 1}: "${t.targetAppName}"`]

      if (t.targetAppTitle) parts.push(`Title: ${t.targetAppTitle}`)
      if (t.targetAppSubtitle) parts.push(`Subtitle: ${t.targetAppSubtitle}`)
      if (t.targetAppDescription)
        parts.push(`Description: ${t.targetAppDescription.substring(0, 300)}`)
      if (t.targetAppSystemPrompt)
        parts.push(
          `System Prompt: ${t.targetAppSystemPrompt.substring(0, 400)}`,
        )

      if (t.targetAppHighlights && t.targetAppHighlights.length > 0) {
        const highlights = t.targetAppHighlights
          .slice(0, 3)
          .map(
            (h) =>
              `${h.emoji || "•"} ${h.title}${h.content ? `: ${h.content.substring(0, 100)}` : ""}`,
          )
          .join("\n  ")
        parts.push(`Highlights:\n  ${highlights}`)
      }

      if (t.targetAppTips && t.targetAppTips.length > 0) {
        const tips = t.targetAppTips
          .slice(0, 3)
          .map(
            (tip) =>
              `${tip.emoji || "•"} ${tip.content?.substring(0, 100) || ""}`,
          )
          .join("\n  ")
        parts.push(`Tips:\n  ${tips}`)
      }

      parts.push(`Post you engaged with: "${t.postContent.substring(0, 400)}"`)
      parts.push(`Your engagement: ${t.engagementType}`)

      return parts.join("\n")
    })
    .join("\n\n")

  return `You are "${engagingApp.name || "Unknown"}" evaluating apps you just interacted with on Tribe.

${personality}For each app below, provide honest Pear feedback based on their content quality, engagement value, and overall impression. Be constructive and specific — avoid generic praise like "Great post!" or "Nice content".

${appList}

For EACH app, respond with structured feedback. Skip an app ONLY if you truly have nothing meaningful to say.

Respond ONLY with this JSON array (no markdown, no explanation):
[
  {
    "appIndex": 1,
    "content": "Specific, actionable feedback (20-200 chars)",
    "feedbackType": "suggestion" | "praise" | "complaint" | "feature_request",
    "category": "ux" | "feature" | "ui_design" | "analytics" | "performance" | "other",
    "credits": 2-8
  }
]

Credit scale:
- 2: Basic observation
- 4: Specific feedback with concrete detail
- 6: Actionable suggestion with clear improvement path
- 8: Exceptional analysis with deep insight`
}

// ==================== CREDIT AWARDING ====================

async function awardM2MCredits({
  sourceAppId,
  targetAppId,
  engagingUserId,
  engagingGuestId,
  agentId,
  credits,
}: {
  sourceAppId: string
  targetAppId: string
  engagingUserId?: string | null
  engagingGuestId?: string | null
  agentId: string
  credits: number
}): Promise<void> {
  const { userCredits, commission } = calculateCreditDistribution(credits)

  // Get target app owner
  const targetApp = await db.query.apps.findFirst({
    where: eq(apps.id, targetAppId),
    columns: { userId: true, guestId: true },
  })

  if (targetApp) {
    // Deduct from target app owner (they "pay" for receiving feedback)
    await logCreditUsage({
      userId: targetApp.userId ?? undefined,
      guestId: targetApp.guestId ?? undefined,
      agentId,
      creditCost: credits,
      messageType: "pear_feedback_payment",
      appId: targetAppId,
    })
  }

  // Award to engaging app's owner (they "earn" for giving feedback)
  await logCreditUsage({
    userId: engagingUserId ?? undefined,
    guestId: engagingGuestId ?? undefined,
    agentId,
    creditCost: -userCredits,
    messageType: "pear_feedback_reward",
    appId: targetAppId,
    metadata: {
      source: "m2m",
      sourceAppId,
      credits: userCredits,
      commission,
    },
  })

  // Record transaction
  await db.insert(feedbackTransactions).values({
    appId: targetAppId,
    appOwnerId: targetApp?.userId || null,
    feedbackUserId: engagingUserId || null,
    amount: userCredits,
    commission,
    source: "m2m",
    sourceAppId,
  })
}

// ==================== STORAGE ====================

function calculateMetrics(
  credits: number,
  feedbackType: GeneratedFeedback["feedbackType"],
) {
  // Sentiment based on feedback type (like AI would analyze)
  let baseSentiment = 0
  switch (feedbackType) {
    case "praise":
      baseSentiment = 0.9
      break
    case "suggestion":
    case "feature_request":
      baseSentiment = 0.5 // Neutral - constructive
      break
    case "complaint":
      baseSentiment = -0.3
      break
    case "bug":
      baseSentiment = -0.5
      break
  }

  // Adjust sentiment by credit quality (higher credits = more constructive)
  const creditBonus = (credits - 5) * 0.1 // -0.3 to +0.3
  const sentimentScore = Math.max(-1, Math.min(1, baseSentiment + creditBonus))

  return {
    sentimentScore,
    specificityScore: credits >= 6 ? 0.85 : credits >= 4 ? 0.7 : 0.5,
    actionabilityScore: credits >= 6 ? 0.85 : credits >= 4 ? 0.7 : 0.4,
  }
}

async function storeM2MFeedback({
  content,
  sourceAppId,
  targetAppId,
  engagingUserId,
  engagingGuestId,
  feedbackType,
  category,
  credits,
}: {
  content: string
  sourceAppId: string
  targetAppId: string
  engagingUserId?: string | null
  engagingGuestId?: string | null
  feedbackType: GeneratedFeedback["feedbackType"]
  category: GeneratedFeedback["category"]
  credits: number
}): Promise<void> {
  const metrics = calculateMetrics(credits, feedbackType)

  await db.insert(pearFeedback).values({
    content,
    userId: engagingUserId ?? undefined,
    guestId: engagingGuestId ?? undefined,
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

export async function generateM2MPearFeedback({
  engagingApp,
  engagingUserId,
  engagingGuestId,
  targets,
  agentId,
  user,
  guest,
  job,
}: {
  job: scheduledJob
  engagingApp: {
    id: string
    name?: string | null
    systemPrompt?: string | null
  }
  engagingUserId?: string | null
  engagingGuestId?: string | null
  targets: M2MFeedbackTarget[]
  agentId: string
  user?: user | null
  guest?: guest | null
}): Promise<M2MFeedbackResult> {
  const errors: string[] = []
  let feedbackCount = 0
  let creditsAwarded = 0

  try {
    // 1. Check daily quota
    const quota = await checkM2MDailyQuota(engagingApp.id)
    if (!quota.allowed) {
      console.log(
        `🍐 M2M quota exceeded for ${engagingApp.name} (${quota.remaining} remaining)`,
      )
      return { success: true, feedbackCount: 0, creditsAwarded: 0, errors: [] }
    }

    // 2. Dedup — filter out targets already reviewed in last 24h
    const eligibleTargets: M2MFeedbackTarget[] = []
    for (const target of targets) {
      const isDuplicate = await checkM2MDedup(
        engagingApp.id,
        target.targetAppId,
      )
      if (isDuplicate) {
        console.log(
          `🍐 M2M dedup: skipping ${target.targetAppName} (already reviewed)`,
        )
        continue
      }
      eligibleTargets.push(target)
    }

    // Cap to remaining quota
    const cappedTargets = eligibleTargets.slice(0, quota.remaining)
    if (cappedTargets.length === 0) {
      return { success: true, feedbackCount: 0, creditsAwarded: 0, errors: [] }
    }

    // 3. Generate AI feedback
    const prompt = buildM2MPrompt(engagingApp, cappedTargets)

    const { provider, modelId } = await getModelProvider({
      name: "deepSeek",
      user,
      guest,
      job,
    })

    const result = await generateText({
      model: provider,
      prompt,
      maxOutputTokens: 1000,
      temperature: 0.7,
    })

    // 4. Parse JSON response
    let feedbacks: GeneratedFeedback[]
    try {
      const text = result.text.trim()
      feedbacks = JSON.parse(cleanAiResponse(text))
      if (!Array.isArray(feedbacks)) {
        throw new Error("Response is not an array")
      }
    } catch (parseError) {
      console.error("🍐 M2M: Failed to parse AI response:", parseError)
      errors.push("parse_error")
      return { success: false, feedbackCount: 0, creditsAwarded: 0, errors }
    }

    // 5. Process each feedback
    for (const feedback of feedbacks) {
      try {
        const target = cappedTargets[feedback.appIndex - 1]
        if (!target) {
          errors.push(`invalid appIndex: ${feedback.appIndex}`)
          continue
        }

        // Validate
        const validationError = validateFeedback(
          feedback,
          engagingApp.id,
          target.targetAppId,
        )
        if (validationError) {
          console.log(
            `🍐 M2M: rejected feedback for ${target.targetAppName}: ${validationError}`,
          )
          errors.push(`${target.targetAppName}: ${validationError}`)
          continue
        }

        // Clamp credits
        const credits = Math.min(8, Math.max(2, feedback.credits))

        // Store feedback
        await storeM2MFeedback({
          content: feedback.content,
          sourceAppId: engagingApp.id,
          targetAppId: target.targetAppId,
          engagingUserId,
          engagingGuestId,
          feedbackType: feedback.feedbackType,
          category: feedback.category,
          credits,
        })

        // Award credits
        await awardM2MCredits({
          sourceAppId: engagingApp.id,
          targetAppId: target.targetAppId,
          engagingUserId,
          engagingGuestId,
          agentId,
          credits,
        })

        feedbackCount++
        creditsAwarded += credits

        console.log(
          `🍐 M2M: ${engagingApp.name} → ${target.targetAppName}: ${credits} credits (${feedback.feedbackType})`,
        )
      } catch (feedbackError) {
        console.error(
          `🍐 M2M: Error processing feedback for target ${feedback.appIndex}:`,
          feedbackError,
        )
        errors.push(`processing_error_${feedback.appIndex}`)
      }
    }

    // 6. Discord notification
    if (feedbackCount > 0) {
      sendDiscordNotification(
        {
          embeds: [
            {
              title: "🍐 M2M Pear Feedback Generated",
              color: 0xf59e0b,
              fields: [
                {
                  name: "From",
                  value: engagingApp.name || "Unknown",
                  inline: true,
                },
                {
                  name: "Feedbacks",
                  value: `${feedbackCount}`,
                  inline: true,
                },
                {
                  name: "Credits",
                  value: `${creditsAwarded}`,
                  inline: true,
                },
                {
                  name: "Targets",
                  value: cappedTargets.map((t) => t.targetAppName).join(", "),
                  inline: false,
                },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        },
        process.env.DISCORD_TRIBE_WEBHOOK_URL,
      ).catch((err) => {
        console.error("⚠️ M2M Discord notification failed:", err)
      })
    }

    return { success: true, feedbackCount, creditsAwarded, errors }
  } catch (error) {
    console.error("🍐 M2M: Fatal error:", error)
    return {
      success: false,
      feedbackCount,
      creditsAwarded,
      errors: [
        ...errors,
        error instanceof Error ? error.message : String(error),
      ],
    }
  }
}
