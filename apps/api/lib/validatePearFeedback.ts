import type { appWithStore } from "@chrryai/chrry/types"
import { db, eq, logCreditUsage, pearFeedback } from "@repo/db"
import { apps, feedbackTransactions } from "@repo/db/src/schema"
import { generateText } from "ai"
import { getModelProvider } from "./getModelProvider"

// ==================== TYPES ====================
interface FeedbackValidationResult {
  isValid: boolean
  credits: number
  reason: string
}

interface AIEvaluation {
  isValid: boolean
  credits: number
  reason: string
}

interface CreditDistribution {
  userCredits: number
  commission: number
}

// ==================== VALIDATION HELPERS ====================

/**
 * Validate basic feedback requirements
 */
function validateFeedbackBasics(
  feedbackText: string,
): FeedbackValidationResult | null {
  if (!feedbackText || feedbackText.trim().length < 10) {
    return {
      isValid: false,
      credits: 0,
      reason: "Feedback too short. Please provide more detail.",
    }
  }
  return null // null means passed validation
}

/**
 * Generate AI evaluation prompt
 */
function createEvaluationPrompt(
  feedbackText: string,
  appName?: string,
): string {
  return `You are evaluating user feedback for the app "${appName || "this app"}".

Feedback: "${feedbackText}"

First, determine if this is actually feedback:
- REJECT (isValid: false, credits: 0) if it is a question, greeting, random chat, or anything not about the app experience.
- REJECT if it is fewer than 10 meaningful characters.
- REJECT if it contains no real observation about the app.

If it IS feedback, award credits:
- 5 credits: Basic valid feedback — simple positive/negative opinion ("I like the design", "Feels fast")
- 10 credits: Specific feedback — identifies a concrete UI/UX issue or detail ("The fire icon is confusing, add a tooltip")
- 15 credits: Actionable feedback — includes a clear improvement suggestion ("Add keyboard shortcuts for power users")
- 20 credits: Exceptional feedback — detailed UX analysis with specific, well-reasoned suggestions

Examples of INVALID feedback (questions, not feedback):
- "hey is dark mode on?"
- "how do I reset my password?"
- "what does this button do?"

Examples of VALID feedback:
- "I like the clean design" → 5 credits
- "The back button goes to home instead of the previous list" → 10 credits
- "Add bulk delete to the list view, deleting one by one is tedious" → 15 credits
- "The checkout flow has 5 steps but 3 and 4 could be merged — users drop off heavily there" → 20 credits

Respond ONLY with a JSON object in this exact format:
{
  "isValid": true/false,
  "credits": 0-20,
  "reason": "Brief explanation"
}`
}

/**
 * Parse and validate AI response
 */
function parseAIEvaluation(responseText: string): AIEvaluation | null {
  try {
    // Safe extraction: find first { and last } without backtracking regex
    const trimmed = responseText.trim()
    const firstBrace = trimmed.indexOf("{")
    const lastBrace = trimmed.lastIndexOf("}")

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      return null
    }

    const cleanText = trimmed.substring(firstBrace, lastBrace + 1)
    const parsed = JSON.parse(cleanText)

    // Validate structure
    if (
      typeof parsed.isValid !== "boolean" ||
      typeof parsed.credits !== "number" ||
      typeof parsed.reason !== "string"
    ) {
      throw new Error("Invalid evaluation structure")
    }

    return parsed as AIEvaluation
  } catch (error) {
    console.error("Failed to parse Pear AI evaluation:", error)
    return null
  }
}

/**
 * Get AI evaluation of feedback
 */
async function evaluateFeedbackWithAI(
  feedbackText: string,
  appName: string | undefined,
  provider: any,
): Promise<AIEvaluation | null> {
  const evaluationPrompt = createEvaluationPrompt(feedbackText, appName)

  const result = await generateText({
    model: provider,
    messages: [{ role: "user", content: evaluationPrompt }],
    temperature: 0.3,
  })

  return parseAIEvaluation(result.text)
}

// ==================== CREDIT HELPERS ====================

/**
 * Calculate credit distribution (user + commission)
 */
function calculateCreditDistribution(totalCredits: number): CreditDistribution {
  const commission = Math.floor(totalCredits * 0.1)
  const userCredits = totalCredits - commission
  return { userCredits, commission }
}

/**
 * Get app owner ID
 */
async function getAppOwnerId(appId: string): Promise<string | null> {
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
    columns: { userId: true, guestId: true, id: true },
  })
  return app?.userId || app?.guestId || null
}

/**
 * Transfer credits from app owner to user
 */
async function transferCreditsFromOwner(
  appOwnerId: string,
  userId: string | undefined,
  guestId: string | undefined,
  agentId: string,
  credits: number,
  appId: string,
): Promise<void> {
  const { userCredits, commission } = calculateCreditDistribution(credits)

  console.log("🍐 Transferring credits from app owner:", {
    appOwnerId: appOwnerId.substring(0, 8),
    totalCredits: credits,
    userCredits,
    commission,
  })

  // Deduct from app owner
  await logCreditUsage({
    userId: appOwnerId,
    agentId,
    guestId: undefined, // App owner is a user, not a guest
    creditCost: credits, // Positive = deduction
    messageType: "pear_feedback_payment",
    appId,
  })

  // Give to feedback user
  await logCreditUsage({
    userId,
    guestId,
    agentId,
    creditCost: -userCredits, // Negative = top-up
    messageType: "pear_feedback_reward",
    appId,
    metadata: {
      appId,
      appOwnerId,
      credits: userCredits,
      commission,
    },
  })

  // Record transaction
  await db.insert(feedbackTransactions).values({
    appId,
    appOwnerId,
    feedbackUserId: userId || null,
    amount: userCredits,
    commission,
  })

  console.log("✅ Feedback credit transfer completed")
}

/**
 * Award credits from system (fallback when no app owner)
 */
async function awardCreditsFromSystem(
  userId: string | undefined,
  guestId: string | undefined,
  agentId: string,
  credits: number,
  appId: string,
): Promise<void> {
  console.log("⚠️ No app owner found, awarding from system")
  await logCreditUsage({
    userId,
    guestId,
    agentId,
    creditCost: -credits,
    messageType: "pear_feedback",
    appId,
    threadId: undefined,
  })
}

/**
 * Award credits to user (with or without app owner)
 */
async function awardFeedbackCredits(
  userId: string | undefined,
  guestId: string | undefined,
  agentId: string,
  credits: number,
  appId: string,
): Promise<void> {
  console.log("🍐 Awarding Pear credits:", {
    userId: userId?.substring(0, 8),
    guestId: guestId?.substring(0, 8),
    credits,
    creditCost: -credits,
  })

  const appOwnerId = await getAppOwnerId(appId)

  if (appOwnerId) {
    await transferCreditsFromOwner(
      appOwnerId,
      userId,
      guestId,
      agentId,
      credits,
      appId,
    )
  } else {
    await awardCreditsFromSystem(userId, guestId, agentId, credits, appId)
  }

  console.log("✅ Pear credits awarded successfully")
}

// ==================== DATABASE HELPERS ====================

/**
 * Map credits to feedback metrics
 */
function calculateFeedbackMetrics(credits: number, feedbackText?: string) {
  // Determine sentiment from text when possible
  const isPositiveTone = feedbackText
    ? /\b(like|love|great|nice|clean|smooth|fast|good|awesome|excellent|beautiful|enjoy|easy)\b/i.test(
        feedbackText,
      )
    : false

  // feedbackType: suggestion for high-value, praise for positive simple, complaint for negative/neutral simple
  const feedbackType =
    credits >= 15
      ? "suggestion"
      : credits >= 10
        ? "praise"
        : isPositiveTone
          ? "praise"
          : "complaint"

  return {
    sentimentScore: credits >= 15 ? 0.8 : credits >= 10 ? 0.5 : 0.2,
    specificityScore: credits >= 15 ? 0.9 : credits >= 10 ? 0.7 : 0.5,
    actionabilityScore: credits >= 15 ? 0.9 : credits >= 10 ? 0.7 : 0.4,
    feedbackType: feedbackType as
      | "suggestion"
      | "praise"
      | "complaint"
      | "bug"
      | "feature_request",
    category: "ux" as const,
  }
}

/**
 * Store feedback in database for analytics
 */
async function storeFeedbackInDatabase(
  feedbackText: string,
  userId: string | undefined,
  guestId: string | undefined,
  appId: string,
  messageId: string | undefined,
  credits: number,
): Promise<void> {
  try {
    const metrics = calculateFeedbackMetrics(credits, feedbackText)

    await db.insert(pearFeedback).values({
      content: feedbackText,
      userId,
      guestId,
      appId,
      messageId,
      feedbackType: metrics.feedbackType,
      category: metrics.category,
      sentimentScore: metrics.sentimentScore,
      specificityScore: metrics.specificityScore,
      actionabilityScore: metrics.actionabilityScore,
      status: "reviewed", // Auto-mark as reviewed since AI validated it
    })

    console.log("🍐 Feedback stored in database for analytics:", {
      appId: appId?.substring(0, 8),
      credits,
      sentiment: metrics.sentimentScore,
    })
  } catch (dbError) {
    console.error("❌ Error storing Pear feedback in database:", dbError)
    // Don't fail the validation if database insert fails
  }
}

// ==================== MAIN FUNCTION ====================

export async function validatePearFeedback({
  feedbackText,
  userId,
  guestId,
  appName,
  agentId,
  app,
  messageId,
}: {
  feedbackText: string
  userId?: string
  guestId?: string
  appName?: string
  agentId: string
  app: appWithStore
  messageId?: string
}): Promise<FeedbackValidationResult> {
  console.log("🍐🍐🍐 validatePearFeedback CALLED:", {
    feedbackLength: feedbackText?.length,
    userId: userId?.substring(0, 8),
    guestId: guestId?.substring(0, 8),
    appName,
    agentId: agentId?.substring(0, 8),
  })

  const appId = app.id

  try {
    // 1. Basic validation
    const basicError = validateFeedbackBasics(feedbackText)
    if (basicError) return basicError

    // 2. Get AI provider (CRITICAL: Use DeepSeek for credit transactions, never free models)
    const providerResult = await getModelProvider({ app, name: "deepSeek" })
    const deepseek = providerResult.provider

    // 3. Evaluate with AI
    const evaluation = await evaluateFeedbackWithAI(
      feedbackText,
      appName,
      deepseek,
    )
    if (!evaluation) {
      return {
        isValid: false,
        credits: 0,
        reason: "Validation error - please try again",
      }
    }

    // 4. Award credits if valid
    const hasUser = userId || guestId
    if (evaluation.isValid && evaluation.credits > 0 && hasUser) {
      await awardFeedbackCredits(
        userId,
        guestId,
        agentId,
        evaluation.credits,
        appId,
      )
      await storeFeedbackInDatabase(
        feedbackText,
        userId,
        guestId,
        appId,
        messageId,
        evaluation.credits,
      )
    }

    // 5. Return result
    return {
      isValid: evaluation.isValid,
      credits: evaluation.credits,
      reason: evaluation.reason,
    }
  } catch (error) {
    console.error("Pear validation error:", error)
    return {
      isValid: false,
      credits: 0,
      reason: "Error validating feedback",
    }
  }
}
