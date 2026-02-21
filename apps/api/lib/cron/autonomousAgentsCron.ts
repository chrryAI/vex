import { appCampaigns, db, eq, slotRentals, storeTimeSlots } from "@repo/db"
import { runautonomousBidding } from "../adExchange/autonomousBidding"
import { captureException } from "../captureException"

/**
 * AUTONOMOUS AI AGENTS CRON JOB
 *
 * Runs every hour - AI agents analyze stores, check threads, and auto-bid on slots
 *
 * This is the REVOLUTIONARY part:
 * - Apps don't manually bid
 * - AI agents autonomously analyze market
 * - They query stores, check traffic, read threads
 * - Place intelligent bids based on analysis
 * - Learn from results and optimize
 *
 * This creates MARKET DYNAMICS:
 * - AI bids show store owners their slot value
 * - Store owners adjust manual rental prices accordingly
 * - App owners see their market value from bid competition
 * - PRICE DISCOVERY happens naturally! 📈
 */
export async function runAutonomousAgentsCron() {
  try {
    console.log("🤖 Starting autonomous AI agents cron job...")
    console.log("📊 AI agents will analyze stores and place bids autonomously")

    // Get all active campaigns with auto-bidding enabled
    const activeCampaigns = await db.query.appCampaigns.findMany({
      where: eq(appCampaigns.status, "active"),
      with: {
        app: true,
      },
    })

    console.log(`📊 Found ${activeCampaigns.length} active campaigns`)

    if (activeCampaigns.length === 0) {
      return {
        success: true,
        message: "No active campaigns",
        processed: 0,
      }
    }

    const results = []
    let successCount = 0
    let errorCount = 0
    let totalBidsPlaced = 0
    let totalCreditsAllocated = 0

    // Run autonomous bidding for each campaign
    for (const campaign of activeCampaigns) {
      try {
        console.log(
          `🤖 Running autonomous bidding for campaign: ${campaign.name}`,
        )
        console.log(`   App: ${campaign.app?.name || campaign.appId}`)
        console.log(`   Budget remaining: ${campaign.creditsRemaining} credits`)
        console.log(`   Strategy: ${campaign.biddingStrategy}`)
        console.log(`   Goal: ${campaign.optimizationGoal}`)

        const result = await runautonomousBidding({
          campaignId: campaign.id,
        })

        if (result.success) {
          successCount++
          totalBidsPlaced += result.bidsPlaced || 0
          totalCreditsAllocated += result.creditsAllocated || 0

          console.log(
            `   ✅ Success: ${result.bidsPlaced} bids placed, ${result.creditsAllocated} credits allocated`,
          )
        } else if (result.skipped) {
          console.log(`   ⏭️  Skipped: ${result.reason}`)
        } else {
          errorCount++
          console.error(`   ❌ Error: ${result.error}`)
        }

        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          result,
        })
      } catch (error) {
        errorCount++
        console.error(
          `❌ Failed to run bidding for campaign ${campaign.id}:`,
          error,
        )
        captureException(error)

        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          error: String(error),
        })
      }
    }

    console.log(`
🎯 Autonomous AI Agents Cron Job Complete!
   ✅ Successful campaigns: ${successCount}
   ❌ Failed campaigns: ${errorCount}
   📊 Total bids placed: ${totalBidsPlaced}
   💰 Total credits allocated: ${totalCreditsAllocated}
    `)

    return {
      success: true,
      processed: activeCampaigns.length,
      successCount,
      errorCount,
      totalBidsPlaced,
      totalCreditsAllocated,
      results,
    }
  } catch (error) {
    console.error("❌ Autonomous agents cron job failed:", error)
    captureException(error)
    return {
      success: false,
      error: String(error),
    }
  }
}

/**
 * Update slot traffic analytics
 * Runs daily to update average traffic for each slot
 * This data is used by AI agents to make bidding decisions
 */
export async function updateSlotAnalytics() {
  try {
    console.log("📊 Updating slot traffic analytics...")

    // Get all active slots
    const slots = await db.query.storeTimeSlots.findMany({
      where: eq(storeTimeSlots.isActive, true),
      with: {
        store: true,
      },
    })

    console.log(`📊 Found ${slots.length} active slots to analyze`)

    let updatedCount = 0

    for (const slot of slots) {
      try {
        // Get recent rentals for this slot
        const recentRentals = await db.query.slotRentals.findMany({
          where: eq(slotRentals.slotId, slot.id),
          orderBy: (slotRentals, { desc }) => [desc(slotRentals.completedOn)],
          limit: 10, // Last 10 rentals
        })

        if (recentRentals.length === 0) {
          continue
        }

        // Calculate average traffic from recent rentals
        const totalTraffic = recentRentals.reduce(
          (sum, rental) => sum + (rental.trafficGenerated || 0),
          0,
        )
        const avgTraffic = Math.round(totalTraffic / recentRentals.length)

        // Calculate average conversions
        const totalConversions = recentRentals.reduce(
          (sum, rental) => sum + (rental.conversions || 0),
          0,
        )
        const avgConversions = Math.round(
          totalConversions / recentRentals.length,
        )

        // Update slot analytics
        await db
          .update(storeTimeSlots)
          .set({
            averageTraffic: avgTraffic,
            averageConversions: avgConversions,
            totalRentals: (slot.totalRentals || 0) + recentRentals.length,
            updatedOn: new Date(),
          })
          .where(eq(storeTimeSlots.id, slot.id))

        updatedCount++

        console.log(
          `   ✅ Updated slot ${slot.id}: avg traffic ${avgTraffic}, avg conversions ${avgConversions}`,
        )
      } catch (error) {
        console.error(`   ❌ Failed to update slot ${slot.id}:`, error)
      }
    }

    console.log(`✅ Updated analytics for ${updatedCount} slots`)

    return {
      success: true,
      updatedCount,
    }
  } catch (error) {
    console.error("❌ Failed to update slot analytics:", error)
    captureException(error)
    return {
      success: false,
      error: String(error),
    }
  }
}
