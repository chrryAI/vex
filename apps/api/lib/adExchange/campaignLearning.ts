import {
  and,
  appCampaigns,
  autonomousBids,
  db,
  eq,
  type slotRental,
  slotRentals,
  storeTimeSlots,
} from "@repo/db"
import { captureException } from "../captureException"

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

/**
 * Update campaign performance after a rental completes
 */
export async function updateCampaignPerformance({
  rentalId,
}: {
  rentalId: string
}) {
  try {
    console.log(`📊 Updating campaign performance for rental ${rentalId}`)

    // Get rental with slot details
    const rental = await db.query.slotRentals.findFirst({
      where: eq(slotRentals.id, rentalId),
      with: {
        slot: true,
        campaign: true,
      },
    })

    if (!rental || !rental.campaign) {
      console.warn(`⚠️ Rental ${rentalId} not found or has no campaign`)
      return
    }

    // Find the autonomous bid that won this rental
    const bid = await db.query.autonomousBids.findFirst({
      where: and(
        eq(autonomousBids.slotId, rental.slotId),
        eq(autonomousBids.status, "won"),
        eq(autonomousBids.campaignId, rental.campaignId),
      ),
    })

    if (!bid) {
      console.warn(`⚠️ No winning bid found for rental ${rentalId}`)
      return
    }

    // Calculate actual ROI
    const actualROI = calculateROI(rental)

    // Update bid with actual performance
    await db
      .update(autonomousBids)
      .set({
        actualTraffic: rental.trafficGenerated,
        actualConversions: rental.conversions,
        actualROI,
      })
      .where(eq(autonomousBids.id, bid.id))

    // Update campaign performance history
    const campaign = rental.campaign
    const performanceHistory =
      (campaign.performanceHistory as PerformanceData[]) || []

    const newEntry: PerformanceData = {
      slotId: rental.slotId,
      storeId: (rental as any).slot?.storeId || "",
      dayOfWeek: (rental as any).slot?.dayOfWeek || 0,
      timeSlot: `${(rental as any).slot?.startTime}-${(rental as any).slot?.endTime}`,
      bidAmount: bid.bidAmount,
      predictedROI: bid.predictedROI || 0,
      actualROI,
      traffic: rental.trafficGenerated ?? 0,
      conversions: rental.conversions ?? 0,
      timestamp: new Date().toISOString(),
    }

    performanceHistory.push(newEntry)

    // Keep only last 100 entries
    const trimmedHistory = performanceHistory.slice(-100)

    // Calculate updated metrics
    const totalImpressions =
      campaign.totalImpressions + (rental.impressions ?? 0)
    const totalClicks = campaign.totalClicks + (rental.clicks ?? 0)
    const totalConversions =
      campaign.totalConversions + (rental.conversions ?? 0)
    const totalKnowledgeGained =
      campaign.totalKnowledgeGained + (rental.knowledgeGained ?? 0)

    const averageCPC = totalClicks > 0 ? campaign.creditsSpent / totalClicks : 0
    const averageROI = calculateAverageROI(trimmedHistory)

    // Retrain AI model with new data (simplified - just store the history)
    const mlModel = {
      version: "1.0",
      trainedOn: new Date().toISOString(),
      dataPoints: trimmedHistory.length,
      averageROI,
      bestPerformingSlots: findBestPerformingSlots(trimmedHistory),
      insights: generateInsights(trimmedHistory),
    }

    // Update campaign
    await db
      .update(appCampaigns)
      .set({
        performanceHistory: trimmedHistory,
        mlModel,
        totalImpressions,
        totalClicks,
        totalConversions,
        totalKnowledgeGained,
        averageCPC,
        roi: averageROI,
        updatedOn: new Date(),
      })
      .where(eq(appCampaigns.id, campaign.id))

    console.log(
      `✅ Updated campaign ${campaign.name} with new performance data (ROI: ${actualROI.toFixed(2)}%)`,
    )

    return {
      success: true,
      actualROI,
      averageROI,
      insights: mlModel.insights,
    }
  } catch (error) {
    console.error(`❌ Failed to update campaign performance:`, error)
    captureException(error)
    return { error: String(error) }
  }
}

/**
 * Calculate ROI for a rental
 */
function calculateROI(rental: slotRental): number {
  // Assume €10 per conversion as revenue
  const revenuePerConversion = 10
  const revenue = (rental.conversions || 0) * revenuePerConversion

  // Cost is the credits charged (convert to EUR if needed)
  const cost = rental.priceEur || rental.creditsCharged * 0.01 // Assume 1 credit = €0.01

  if (cost === 0) return 0

  return ((revenue - cost) / cost) * 100
}

/**
 * Calculate average ROI from performance history
 */
function calculateAverageROI(history: PerformanceData[]): number {
  if (history.length === 0) return 0

  const totalROI = history.reduce((sum, entry) => sum + entry.actualROI, 0)
  return totalROI / history.length
}

/**
 * Find best performing slots from history
 */
function findBestPerformingSlots(
  history: PerformanceData[],
): Array<{ slotId: string; avgROI: number; count: number }> {
  const slotPerformance = new Map<string, { totalROI: number; count: number }>()

  history.forEach((entry) => {
    const existing = slotPerformance.get(entry.slotId) || {
      totalROI: 0,
      count: 0,
    }
    slotPerformance.set(entry.slotId, {
      totalROI: existing.totalROI + entry.actualROI,
      count: existing.count + 1,
    })
  })

  return Array.from(slotPerformance.entries())
    .map(([slotId, data]) => ({
      slotId,
      avgROI: data.totalROI / data.count,
      count: data.count,
    }))
    .sort((a, b) => b.avgROI - a.avgROI)
    .slice(0, 5) // Top 5
}

/**
 * Generate AI insights from performance data
 */
function generateInsights(history: PerformanceData[]): string[] {
  const insights: string[] = []

  if (history.length === 0) {
    return ["Not enough data yet to generate insights"]
  }

  // Best performing day
  const dayPerformance = new Map<number, { totalROI: number; count: number }>()
  history.forEach((entry) => {
    const existing = dayPerformance.get(entry.dayOfWeek) || {
      totalROI: 0,
      count: 0,
    }
    dayPerformance.set(entry.dayOfWeek, {
      totalROI: existing.totalROI + entry.actualROI,
      count: existing.count + 1,
    })
  })

  const bestDay = Array.from(dayPerformance.entries())
    .map(([day, data]) => ({
      day,
      avgROI: data.totalROI / data.count,
    }))
    .sort((a, b) => b.avgROI - a.avgROI)[0]

  if (bestDay) {
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]
    insights.push(`Best performing day: ${dayNames[bestDay.day]}`)
  }

  // Best performing time slot
  const timeSlotPerformance = new Map<
    string,
    { totalROI: number; count: number }
  >()
  history.forEach((entry) => {
    const existing = timeSlotPerformance.get(entry.timeSlot) || {
      totalROI: 0,
      count: 0,
    }
    timeSlotPerformance.set(entry.timeSlot, {
      totalROI: existing.totalROI + entry.actualROI,
      count: existing.count + 1,
    })
  })

  const bestTimeSlot = Array.from(timeSlotPerformance.entries())
    .map(([timeSlot, data]) => ({
      timeSlot,
      avgROI: data.totalROI / data.count,
    }))
    .sort((a, b) => b.avgROI - a.avgROI)[0]

  if (bestTimeSlot) {
    insights.push(`Optimal time: ${bestTimeSlot.timeSlot}`)
  }

  // Average traffic vs conversions
  const avgTraffic =
    history.reduce((sum, e) => sum + e.traffic, 0) / history.length
  const avgConversions =
    history.reduce((sum, e) => sum + e.conversions, 0) / history.length
  const conversionRate =
    avgTraffic > 0 ? (avgConversions / avgTraffic) * 100 : 0

  insights.push(`Average conversion rate: ${conversionRate.toFixed(2)}%`)

  // ROI trend
  const recentROI =
    history.slice(-10).reduce((sum, e) => sum + e.actualROI, 0) /
    Math.min(10, history.length)
  const overallROI =
    history.reduce((sum, e) => sum + e.actualROI, 0) / history.length

  if (recentROI > overallROI * 1.1) {
    insights.push("📈 Performance improving over time")
  } else if (recentROI < overallROI * 0.9) {
    insights.push("📉 Performance declining - consider adjusting strategy")
  } else {
    insights.push("➡️ Performance stable")
  }

  // Budget efficiency
  const _avgBid =
    history.reduce((sum, e) => sum + e.bidAmount, 0) / history.length
  const avgROIValue =
    history.reduce((sum, e) => sum + e.actualROI, 0) / history.length

  if (avgROIValue > 50) {
    insights.push("💰 High ROI - consider increasing budget")
  } else if (avgROIValue < 10) {
    insights.push("⚠️ Low ROI - review targeting or reduce bids")
  }

  return insights
}

/**
 * Process auction results and award slots
 */
export async function processAuctionResults({
  slotId,
  auctionDate,
}: {
  slotId: string
  auctionDate: Date
}) {
  try {
    console.log(`🎯 Processing auction results for slot ${slotId}`)

    // Get all pending bids for this slot
    const bids = await db.query.autonomousBids.findMany({
      where: and(
        eq(autonomousBids.slotId, slotId),
        eq(autonomousBids.status, "pending"),
      ),
      with: {
        campaign: true,
      },
    })

    if (bids.length === 0) {
      console.log(`⚠️ No bids for slot ${slotId}`)
      return { skipped: true, reason: "No bids" }
    }

    // Find highest bid
    const sortedBids = bids.sort((a, b) => b.bidAmount - a.bidAmount)
    const winningBid = sortedBids[0]

    if (!winningBid) {
      console.log(`⚠️ No valid winning bid for slot ${slotId}`)
      return { skipped: true, reason: "No valid winning bid" }
    }

    const losingBids = sortedBids.slice(1)

    console.log(
      `🏆 Winning bid: ${winningBid.bidAmount} credits from campaign ${winningBid.campaignId}`,
    )

    // Update winning bid
    await db
      .update(autonomousBids)
      .set({
        status: "won",
        competingBids: bids.length - 1,
      })
      .where(eq(autonomousBids.id, winningBid.id))

    // Update losing bids
    for (const bid of losingBids) {
      await db
        .update(autonomousBids)
        .set({
          status: "lost",
          competingBids: bids.length - 1,
          winningBid: winningBid.bidAmount,
        })
        .where(eq(autonomousBids.id, bid.id))
    }

    // Create slot rental
    const campaign = winningBid.campaign
    if (!campaign) {
      throw new Error("Campaign not found for winning bid")
    }

    const slot = await db.query.storeTimeSlots.findFirst({
      where: eq(storeTimeSlots.id, slotId),
    })

    if (!slot) {
      throw new Error("Slot not found")
    }

    const [rental] = await db
      .insert(slotRentals)
      .values({
        slotId,
        campaignId: winningBid.campaignId,
        bidId: winningBid.id,
        appId: campaign.appId,
        userId: campaign.userId || undefined,
        guestId: campaign.guestId || undefined,
        startTime: auctionDate,
        endTime: new Date(
          auctionDate.getTime() + slot.durationHours * 60 * 60 * 1000,
        ),
        durationHours: slot.durationHours,
        creditsCharged: winningBid.bidAmount,
        priceEur: winningBid.bidAmount * 0.01, // 1 credit = €0.01
        status: "scheduled",
        knowledgeBaseEnabled: true,
      })
      .returning()

    if (!rental) {
      throw new Error("Failed to create rental")
    }

    console.log(`✅ Created rental ${rental.id} for winning bid`)

    return {
      success: true,
      winningBid,
      rental,
      totalBids: bids.length,
    }
  } catch (error) {
    console.error(`❌ Failed to process auction results:`, error)
    captureException(error)
    return { error: String(error) }
  }
}
