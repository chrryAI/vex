import crypto from "node:crypto"
import {
  and,
  type appCampaign,
  appCampaigns,
  type autonomousBid,
  autonomousBids,
  db,
  eq,
  gte,
  inArray,
  sql,
  type storeTimeSlot,
  storeTimeSlots,
} from "@repo/db"
import { generateText } from "ai"
import { getModelProvider } from "../../lib/getModelProvider"
import { captureException } from "../captureException"

interface _BiddingContext {
  campaign: appCampaign
  availableSlots: storeTimeSlot[]
  historicalPerformance: PerformanceData[]
  marketConditions: MarketData
}

interface PerformanceData {
  slotId: string
  storeId: string
  dayOfWeek: number
  timeSlot: string
  bidAmount: number
  predictedROI: number
  actualROI: number
  traffic: number
  conversions: number
  timestamp: string
}

interface MarketData {
  averageSlotPrice: number
  competitionLevel: number
  peakHours: string[]
}

interface ScoredSlot extends storeTimeSlot {
  score: number // 0-100
  recommendedBid: number
  confidence: number // 0-1
  bidReason: string
  predictedROI: number
}

/**
 * Main autonomous bidding function - runs periodically for all active campaigns
 */
export async function runautonomousBidding({
  campaignId,
}: {
  campaignId: string
}) {
  try {
    console.log(`🤖 Running autonomous bidding for campaign ${campaignId}`)

    // 1. GET CAMPAIGN
    const campaign = await db.query.appCampaigns.findFirst({
      where: eq(appCampaigns.id, campaignId),
    })

    if (!campaign || campaign.status !== "active") {
      return { skipped: true, reason: "Campaign not active" }
    }

    if (campaign.creditsRemaining <= 0) {
      // Auto-pause campaign
      await db
        .update(appCampaigns)
        .set({ status: "completed" })
        .where(eq(appCampaigns.id, campaignId))

      return { skipped: true, reason: "No credits remaining" }
    }

    // 2. GET AVAILABLE SLOTS
    const availableSlots = await getAvailableSlots({
      targetStores: campaign.targetStores,
      targetCategories: campaign.targetCategories,
      excludeStores: campaign.excludeStores,
      minTraffic: campaign.minTraffic,
      preferredDays: campaign.preferredDays,
      preferredHours: campaign.preferredHours,
    })

    console.log(`📊 Found ${availableSlots.length} available slots`)

    if (availableSlots.length === 0) {
      return { skipped: true, reason: "No available slots" }
    }

    // 3. SCORE EACH SLOT USING AI
    const scoredSlots = await scoreSlots({
      slots: availableSlots,
      campaign,
      historicalPerformance: await getHistoricalPerformance(campaignId),
    })

    // 4. SELECT TOP SLOTS WITHIN BUDGET
    const selectedSlots = selectOptimalSlots({
      scoredSlots,
      budget: campaign.creditsRemaining,
      dailyBudget: campaign.dailyBudget || undefined,
      biddingStrategy: campaign.biddingStrategy,
    })

    console.log(`🎯 Selected ${selectedSlots.length} slots to bid on`)

    if (selectedSlots.length === 0) {
      return { skipped: true, reason: "No slots meet criteria" }
    }

    // 5. PLACE BIDS
    const bids: autonomousBid[] = []
    let totalCreditsAllocated = 0

    for (const slot of selectedSlots) {
      const bid = await placeBid({
        campaignId,
        slot,
        bidAmount: slot.recommendedBid,
        confidence: slot.confidence,
        reason: slot.bidReason,
        predictedROI: slot.predictedROI,
        predictedTraffic: slot.averageTraffic ?? 0,
      })

      if (bid) {
        bids.push(bid)
        totalCreditsAllocated += slot.recommendedBid
      }
    }

    // 6. UPDATE CAMPAIGN
    await db
      .update(appCampaigns)
      .set({
        creditsRemaining: campaign.creditsRemaining - totalCreditsAllocated,
        creditsSpent: campaign.creditsSpent + totalCreditsAllocated,
        updatedOn: new Date(),
      })
      .where(eq(appCampaigns.id, campaignId))

    console.log(
      `✅ Placed ${bids.length} bids, allocated ${totalCreditsAllocated} credits`,
    )

    return {
      success: true,
      slotsEvaluated: availableSlots.length,
      bidsPlaced: bids.length,
      creditsAllocated: totalCreditsAllocated,
      bids,
    }
  } catch (error) {
    console.error(
      `❌ Autonomous bidding failed for campaign ${campaignId}:`,
      error,
    )
    captureException(error)
    return { error: String(error) }
  }
}

/**
 * Get available time slots based on campaign targeting
 */
async function getAvailableSlots({
  targetStores,
  targetCategories,
  excludeStores,
  minTraffic,
  preferredDays,
  preferredHours,
}: {
  targetStores?: string[] | null
  targetCategories?: string[] | null
  excludeStores?: string[] | null
  minTraffic?: number | null
  preferredDays?: number[] | null
  preferredHours?: string[] | null
}): Promise<storeTimeSlot[]> {
  const conditions = [eq(storeTimeSlots.isActive, true)]

  // Store targeting
  if (targetStores && targetStores.length > 0) {
    conditions.push(inArray(storeTimeSlots.storeId, targetStores))
  }

  // Exclude stores
  if (excludeStores && excludeStores.length > 0) {
    conditions.push(sql`${storeTimeSlots.storeId} NOT IN ${excludeStores}`)
  }

  // Minimum traffic
  if (minTraffic) {
    conditions.push(gte(storeTimeSlots.averageTraffic, minTraffic))
  }

  // Preferred days
  if (preferredDays && preferredDays.length > 0) {
    conditions.push(inArray(storeTimeSlots.dayOfWeek, preferredDays))
  }

  const slots = await db.query.storeTimeSlots.findMany({
    where: and(...conditions),
    with: {
      store: true,
    },
  })

  return slots as any
}

/**
 * Get historical performance data for learning
 */
async function getHistoricalPerformance(
  campaignId: string,
): Promise<PerformanceData[]> {
  const campaign = await db.query.appCampaigns.findFirst({
    where: eq(appCampaigns.id, campaignId),
  })

  return (campaign?.performanceHistory as PerformanceData[]) || []
}

/**
 * AI-powered slot scoring
 */
async function scoreSlots({
  slots,
  campaign,
  historicalPerformance,
}: {
  slots: storeTimeSlot[]
  campaign: appCampaign
  historicalPerformance: PerformanceData[]
}): Promise<ScoredSlot[]> {
  const scoredSlots: ScoredSlot[] = []

  // Get AI model for scoring
  let provider
  try {
    const result = await getModelProvider(
      { id: campaign.appId } as any,
      "claude-sonnet-4",
    )
    provider = result.provider
  } catch (_error) {
    console.warn("⚠️ Failed to get AI provider, using heuristic scoring")
    // Fallback to heuristic scoring for all slots
    return slots.map((slot) => ({
      ...slot,
      score: calculateHeuristicScore(slot, campaign),
      recommendedBid: slot.creditsPerHour,
      confidence: 0.5,
      bidReason: "Heuristic scoring (AI unavailable)",
      predictedROI: 0,
    }))
  }

  for (const slot of slots) {
    try {
      // Build context for AI
      const context = {
        slot: {
          store: (slot as any).store?.name || "Unknown Store",
          dayOfWeek: getDayName(slot.dayOfWeek),
          time: `${slot.startTime}-${slot.endTime}`,
          traffic: slot.averageTraffic,
          isPrimeTime: slot.isPrimeTime,
          currentPrice: slot.creditsPerHour,
        },
        campaign: {
          goal: campaign.optimizationGoal,
          budget: campaign.creditsRemaining,
          strategy: campaign.biddingStrategy,
        },
        history: historicalPerformance
          .filter(
            (p) => p.storeId === slot.storeId || p.dayOfWeek === slot.dayOfWeek,
          )
          .slice(0, 5), // Last 5 similar performances
      }

      // AI scoring prompt
      const scoringPrompt = `You are an AI ad bidding optimizer for the Wine ecosystem.

SLOT TO EVALUATE:
${JSON.stringify(context.slot, null, 2)}

CAMPAIGN CONTEXT:
${JSON.stringify(context.campaign, null, 2)}

HISTORICAL PERFORMANCE (similar slots):
${JSON.stringify(context.history, null, 2)}

Evaluate this slot and provide:
1. Score (0-100): How good is this slot for the campaign?
2. Recommended bid (credits): How much to bid?
3. Confidence (0-1): How confident are you?
4. Reason: Why this score/bid?
5. Predicted ROI: Expected return on investment

Consider:
- Store traffic vs price
- Time slot alignment with campaign goals
- Historical performance data
- Competition level
- Budget constraints

Return ONLY JSON:
{
  "score": <0-100>,
  "recommendedBid": <credits>,
  "confidence": <0-1>,
  "reason": "<brief explanation>",
  "predictedROI": <number>
}`

      const { text } = await generateText({
        model: provider,
        prompt: scoringPrompt,
      })

      // Safe JSON extraction: first try parsing the entire stripped text, then fall back to brace-counting
      let parsed: any
      try {
        // Strip markdown code fences if present
        const strippedText = text
          .replace(/^```(?:json)?\n?/gm, "")
          .replace(/\n?```$/gm, "")
          .trim()

        // Try parsing the entire stripped text first
        try {
          parsed = JSON.parse(strippedText)
        } catch {
          // Fallback: extract JSON using brace-counting (handles cases where AI adds text before/after JSON)
          let jsonText = "{}"
          const firstBrace = text.indexOf("{")
          if (firstBrace !== -1) {
            let braceCount = 0
            let endIndex = firstBrace
            for (let i = firstBrace; i < text.length; i++) {
              if (text[i] === "{") braceCount++
              if (text[i] === "}") braceCount--
              if (braceCount === 0) {
                endIndex = i + 1
                break
              }
            }
            jsonText = text.substring(firstBrace, endIndex)
          }
          parsed = JSON.parse(jsonText)
        }
      } catch (e) {
        console.warn("Failed to parse JSON from AI response:", e)
        // Use default values if parsing fails completely
        parsed = {}
      }

      scoredSlots.push({
        ...slot,
        score: parsed.score || 0,
        recommendedBid: parsed.recommendedBid || slot.creditsPerHour,
        confidence: parsed.confidence || 0.5,
        bidReason: parsed.reason || "AI evaluation",
        predictedROI: parsed.predictedROI || 0,
      })

      console.log(
        `✅ Scored ${(slot as any).store?.name} ${slot.dayOfWeek} ${slot.startTime}: ${parsed.score}/100`,
      )
    } catch (error) {
      console.error(`❌ Failed to score slot ${slot.id}:`, error)

      // Fallback: Simple heuristic scoring
      const score = calculateHeuristicScore(slot, campaign)
      scoredSlots.push({
        ...slot,
        score,
        recommendedBid: slot.creditsPerHour,
        confidence: 0.3,
        bidReason: "Heuristic fallback",
        predictedROI: 0,
      })
    }
  }

  return scoredSlots.sort((a, b) => b.score - a.score)
}

/**
 * Fallback heuristic scoring when AI is unavailable
 */
function calculateHeuristicScore(
  slot: storeTimeSlot,
  campaign: appCampaign,
): number {
  let score = 50 // Base score

  // Traffic bonus
  if (slot.averageTraffic && slot.averageTraffic > 1000) score += 20
  else if (slot.averageTraffic && slot.averageTraffic > 500) score += 10
  else if (slot.averageTraffic && slot.averageTraffic < 100) score -= 10

  // Price penalty
  if (
    campaign.maxPricePerSlot &&
    slot.creditsPerHour > campaign.maxPricePerSlot
  ) {
    score -= 30
  }

  // Prime time adjustment
  if (slot.isPrimeTime && !campaign.avoidPrimeTime) score += 15
  if (slot.isPrimeTime && campaign.avoidPrimeTime) score -= 20

  // Day preference
  if (campaign.preferredDays?.includes(slot.dayOfWeek)) score += 10

  return Math.max(0, Math.min(100, score))
}

/**
 * Select optimal slots based on bidding strategy
 */
function selectOptimalSlots({
  scoredSlots,
  budget,
  dailyBudget,
  biddingStrategy,
}: {
  scoredSlots: ScoredSlot[]
  budget: number
  dailyBudget?: number
  biddingStrategy: string
}): ScoredSlot[] {
  const strategies = {
    smart: {
      diversification: 0.7,
      riskTolerance: 0.5,
      primeTimePreference: 0.6,
      minScore: 50,
    },
    aggressive: {
      diversification: 0.3,
      riskTolerance: 0.8,
      primeTimePreference: 0.9,
      minScore: 60,
    },
    conservative: {
      diversification: 0.9,
      riskTolerance: 0.2,
      primeTimePreference: 0.3,
      minScore: 40,
    },
    custom: {
      diversification: 0.5,
      riskTolerance: 0.5,
      primeTimePreference: 0.5,
      minScore: 45,
    },
  }

  const strategy =
    strategies[biddingStrategy as keyof typeof strategies] || strategies.smart

  const selected: ScoredSlot[] = []
  let remainingBudget = budget
  const storesUsed = new Set<string>()

  // Sort by risk-adjusted score
  const sortedSlots = scoredSlots.sort((a, b) => {
    const scoreA = a.score * a.confidence ** strategy.riskTolerance
    const scoreB = b.score * b.confidence ** strategy.riskTolerance
    return scoreB - scoreA
  })

  for (const slot of sortedSlots) {
    // Budget check
    if (slot.recommendedBid > remainingBudget) continue

    // Minimum score threshold
    if (slot.score < strategy.minScore) continue

    // Diversification check
    if (selected.length > 0) {
      const storeUsage = storesUsed.size / selected.length
      if (
        storeUsage < strategy.diversification &&
        storesUsed.has(slot.storeId)
      ) {
        continue // Skip, need more diversification
      }
    }

    // Prime time preference check (using crypto for secure randomness)
    if (slot.isPrimeTime) {
      const primeTimeRoll = crypto.randomInt(0, 100) / 100 // 0.00 to 0.99
      if (primeTimeRoll > strategy.primeTimePreference) {
        continue // Skip prime time based on strategy
      }
    }

    // Select this slot
    selected.push(slot)
    remainingBudget -= slot.recommendedBid
    storesUsed.add(slot.storeId)

    // Daily budget check
    if (dailyBudget) {
      const dailySpend = selected.reduce((sum, s) => sum + s.recommendedBid, 0)
      if (dailySpend >= dailyBudget) break
    }
  }

  return selected
}

/**
 * Place a bid on a time slot
 */
async function placeBid({
  campaignId,
  slot,
  bidAmount,
  confidence,
  reason,
  predictedROI,
  predictedTraffic,
}: {
  campaignId: string
  slot: ScoredSlot
  bidAmount: number
  confidence: number
  reason: string
  predictedROI: number
  predictedTraffic: number
}): Promise<autonomousBid | undefined> {
  const [bid] = await db
    .insert(autonomousBids)
    .values({
      campaignId,
      slotId: slot.id,
      bidAmount,
      bidReason: reason,
      confidence,
      predictedROI,
      predictedTraffic,
      status: "pending",
    })
    .returning()

  return bid
}

/**
 * Helper: Get day name from number
 */
function getDayName(dayOfWeek: number): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]
  return days[dayOfWeek] || "Unknown"
}
