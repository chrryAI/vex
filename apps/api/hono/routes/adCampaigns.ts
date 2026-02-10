import { Hono } from "hono"
import { db, eq, and, desc } from "@repo/db"
import {
  appCampaigns,
  autonomousBids,
  slotRentals,
  storeTimeSlots,
  type NewappCampaign,
} from "@repo/db"
import { getMember, getGuest } from "../lib/auth"
import { runautonomousBidding } from "../../lib/adExchange/autonomousBidding"
import {
  updateCampaignPerformance,
  processAuctionResults,
} from "../../lib/adExchange/campaignLearning"
import captureException from "../../lib/captureException"

export const adCampaignsRoute = new Hono()

// GET /campaigns - List user's campaigns
adCampaignsRoute.get("/", async (c) => {
  try {
    const member = await getMember(c)
    const guest = await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const campaigns = await db.query.appCampaigns.findMany({
      where: member
        ? eq(appCampaigns.userId, member.id)
        : eq(appCampaigns.guestId, guest!.id),
      with: {
        app: true,
      },
      orderBy: [desc(appCampaigns.createdOn)],
    })

    return c.json({ campaigns })
  } catch (error) {
    captureException(error)
    return c.json({ error: "Failed to fetch campaigns" }, 500)
  }
})

// GET /campaigns/:id - Get campaign details
adCampaignsRoute.get("/:id", async (c) => {
  try {
    const id = c.req.param("id")
    const member = await getMember(c)
    const guest = await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const campaign = await db.query.adCampaigns.findFirst({
      where: eq(adCampaigns.id, id),
      with: {
        app: true,
      },
    })

    if (!campaign) {
      return c.json({ error: "Campaign not found" }, 404)
    }

    // Check ownership
    if (
      (member && campaign.userId !== member.id) ||
      (guest && campaign.guestId !== guest.id)
    ) {
      return c.json({ error: "Forbidden" }, 403)
    }

    // Get campaign bids
    const bids = await db.query.autonomousBids.findMany({
      where: eq(autonomousBids.campaignId, id),
      orderBy: [desc(autonomousBids.createdOn)],
      limit: 50,
    })

    // Get campaign rentals
    const rentals = await db.query.slotRentals.findMany({
      where: eq(slotRentals.campaignId, id),
      with: {
        slot: {
          with: {
            store: true,
          },
        },
      },
      orderBy: [desc(slotRentals.createdOn)],
      limit: 50,
    })

    return c.json({
      campaign,
      bids,
      rentals,
    })
  } catch (error) {
    captureException(error)
    return c.json({ error: "Failed to fetch campaign" }, 500)
  }
})

// POST /campaigns - Create new campaign
adCampaignsRoute.post("/", async (c) => {
  try {
    const member = await getMember(c)
    const guest = await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const body = await c.req.json()

    const {
      appId,
      name,
      totalCredits,
      optimizationGoal = "balanced",
      biddingStrategy = "smart",
      targetStores,
      targetCategories,
      excludeStores,
      minTraffic = 100,
      maxPricePerSlot,
      preferredDays,
      preferredHours,
      avoidPrimeTime = false,
      dailyBudget,
    } = body

    if (!appId || !name || !totalCredits) {
      return c.json(
        { error: "Missing required fields: appId, name, totalCredits" },
        400,
      )
    }

    // Create campaign
    const [campaign] = await db
      .insert(appCampaigns)
      .values({
        appId,
        userId: member?.id,
        guestId: guest?.id,
        name,
        totalCredits,
        creditsRemaining: totalCredits,
        optimizationGoal,
        biddingStrategy,
        targetStores,
        targetCategories,
        excludeStores,
        minTraffic,
        maxPricePerSlot,
        preferredDays,
        preferredHours,
        avoidPrimeTime,
        dailyBudget,
        status: "active",
        metadata: jsonb("metadata"),
      } as NewappCampaign)
      .returning()

    console.log(`✅ Created campaign ${campaign.id}: ${campaign.name}`)

    // Run initial bidding
    const biddingResult = await runautonomousBidding({
      campaignId: campaign.id,
    })

    return c.json({
      campaign,
      biddingResult,
    })
  } catch (error) {
    captureException(error)
    return c.json({ error: "Failed to create campaign" }, 500)
  }
})

// PATCH /campaigns/:id - Update campaign
adCampaignsRoute.patch("/:id", async (c) => {
  try {
    const id = c.req.param("id")
    const member = await getMember(c)
    const guest = await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const campaign = await db.query.adCampaigns.findFirst({
      where: eq(adCampaigns.id, id),
    })

    if (!campaign) {
      return c.json({ error: "Campaign not found" }, 404)
    }

    // Check ownership
    if (
      (member && campaign.userId !== member.id) ||
      (guest && campaign.guestId !== guest.id)
    ) {
      return c.json({ error: "Forbidden" }, 403)
    }

    const body = await c.req.json()

    const [updated] = await db
      .update(appCampaigns)
      .set({
        ...body,
        updatedOn: new Date(),
      })
      .where(eq(appCampaigns.id, id))
      .returning()

    return c.json({ campaign: updated })
  } catch (error) {
    captureException(error)
    return c.json({ error: "Failed to update campaign" }, 500)
  }
})

// POST /campaigns/:id/pause - Pause campaign
adCampaignsRoute.post("/:id/pause", async (c) => {
  try {
    const id = c.req.param("id")
    const member = await getMember(c)
    const guest = await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const campaign = await db.query.adCampaigns.findFirst({
      where: eq(adCampaigns.id, id),
    })

    if (!campaign) {
      return c.json({ error: "Campaign not found" }, 404)
    }

    // Check ownership
    if (
      (member && campaign.userId !== member.id) ||
      (guest && campaign.guestId !== guest.id)
    ) {
      return c.json({ error: "Forbidden" }, 403)
    }

    const [updated] = await db
      .update(appCampaigns)
      .set({
        status: "paused",
        updatedOn: new Date(),
      })
      .where(eq(appCampaigns.id, id))
      .returning()

    return c.json({ campaign: updated })
  } catch (error) {
    captureException(error)
    return c.json({ error: "Failed to pause campaign" }, 500)
  }
})

// POST /campaigns/:id/resume - Resume campaign
adCampaignsRoute.post("/:id/resume", async (c) => {
  try {
    const id = c.req.param("id")
    const member = await getMember(c)
    const guest = await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const campaign = await db.query.adCampaigns.findFirst({
      where: eq(adCampaigns.id, id),
    })

    if (!campaign) {
      return c.json({ error: "Campaign not found" }, 404)
    }

    // Check ownership
    if (
      (member && campaign.userId !== member.id) ||
      (guest && campaign.guestId !== guest.id)
    ) {
      return c.json({ error: "Forbidden" }, 403)
    }

    const [updated] = await db
      .update(appCampaigns)
      .set({
        status: "active",
        updatedOn: new Date(),
      })
      .where(eq(appCampaigns.id, id))
      .returning()

    // Run bidding
    const biddingResult = await runautonomousBidding({
      campaignId: id,
    })

    return c.json({
      campaign: updated,
      biddingResult,
    })
  } catch (error) {
    captureException(error)
    return c.json({ error: "Failed to resume campaign" }, 500)
  }
})

// POST /campaigns/:id/run-bidding - Manually trigger bidding
adCampaignsRoute.post("/:id/run-bidding", async (c) => {
  try {
    const id = c.req.param("id")
    const member = await getMember(c)
    const guest = await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const campaign = await db.query.adCampaigns.findFirst({
      where: eq(adCampaigns.id, id),
    })

    if (!campaign) {
      return c.json({ error: "Campaign not found" }, 404)
    }

    // Check ownership
    if (
      (member && campaign.userId !== member.id) ||
      (guest && campaign.guestId !== guest.id)
    ) {
      return c.json({ error: "Forbidden" }, 403)
    }

    const result = await runautonomousBidding({
      campaignId: id,
    })

    return c.json(result)
  } catch (error) {
    captureException(error)
    return c.json({ error: "Failed to run bidding" }, 500)
  }
})

// GET /slots - Get available time slots
adCampaignsRoute.get("/slots/available", async (c) => {
  try {
    const slots = await db.query.storeTimeSlots.findMany({
      where: eq(storeTimeSlots.isActive, true),
      with: {
        store: true,
      },
      orderBy: [desc(storeTimeSlots.averageTraffic)],
      limit: 100,
    })

    return c.json({ slots })
  } catch (error) {
    captureException(error)
    return c.json({ error: "Failed to fetch slots" }, 500)
  }
})

// POST /rentals/:id/complete - Mark rental as completed and update performance
adCampaignsRoute.post("/rentals/:id/complete", async (c) => {
  try {
    const id = c.req.param("id")

    const result = await updateCampaignPerformance({
      rentalId: id,
    })

    return c.json(result)
  } catch (error) {
    captureException(error)
    return c.json({ error: "Failed to complete rental" }, 500)
  }
})

// POST /auctions/process - Process auction results (admin/cron)
adCampaignsRoute.post("/auctions/process", async (c) => {
  try {
    const body = await c.req.json()
    const { slotId, auctionDate } = body

    if (!slotId || !auctionDate) {
      return c.json({ error: "Missing slotId or auctionDate" }, 400)
    }

    const result = await processAuctionResults({
      slotId,
      auctionDate: new Date(auctionDate),
    })

    return c.json(result)
  } catch (error) {
    captureException(error)
    return c.json({ error: "Failed to process auction" }, 500)
  }
})

// ============================================================================
// MANUAL RENTAL SYSTEM - Humans directly rent slots (no bidding)
// ============================================================================

// POST /slots/:id/rent - Directly rent a slot by paying credits
adCampaignsRoute.post("/slots/:id/rent", async (c) => {
  try {
    const slotId = c.req.param("id")
    const member = await getMember(c)
    const guest = await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const body = await c.req.json()
    const { appId, startDate } = body

    if (!appId || !startDate) {
      return c.json({ error: "Missing appId or startDate" }, 400)
    }

    // Get slot details
    const slot = await db.query.storeTimeSlots.findFirst({
      where: eq(storeTimeSlots.id, slotId),
      with: {
        store: true,
      },
    })

    if (!slot) {
      return c.json({ error: "Slot not found" }, 404)
    }

    if (!slot.isActive) {
      return c.json({ error: "Slot is not active" }, 400)
    }

    // Calculate total cost
    const totalCredits = slot.creditsPerHour * slot.durationHours

    // TODO: Check user has enough credits
    // For now, assume they do

    // Create rental
    const rentalStartTime = new Date(startDate)
    const rentalEndTime = new Date(
      rentalStartTime.getTime() + slot.durationHours * 60 * 60 * 1000,
    )

    const [rental] = await db
      .insert(slotRentals)
      .values({
        slotId,
        appId,
        userId: member?.id,
        guestId: guest?.id,
        startTime: rentalStartTime,
        endTime: rentalEndTime,
        durationHours: slot.durationHours,
        creditsCharged: totalCredits,
        priceEur: totalCredits * 0.01, // 1 credit = €0.01
        status: "scheduled",
        knowledgeBaseEnabled: true,
      })
      .returning()

    // TODO: Deduct credits from user account

    console.log(
      `✅ Manual rental created: ${rental.id} for ${totalCredits} credits`,
    )

    return c.json({
      rental,
      creditsCharged: totalCredits,
      message: "Slot rented successfully",
    })
  } catch (error) {
    captureException(error)
    return c.json({ error: "Failed to rent slot" }, 500)
  }
})

// GET /slots/:id/availability - Check if slot is available for a date
adCampaignsRoute.get("/slots/:id/availability", async (c) => {
  try {
    const slotId = c.req.param("id")
    const dateParam = c.req.query("date")

    if (!dateParam) {
      return c.json({ error: "Missing date parameter" }, 400)
    }

    const requestedDate = new Date(dateParam)

    // Get slot
    const slot = await db.query.storeTimeSlots.findFirst({
      where: eq(storeTimeSlots.id, slotId),
    })

    if (!slot) {
      return c.json({ error: "Slot not found" }, 404)
    }

    // Check if there are existing rentals for this slot at this time
    const rentalEndTime = new Date(
      requestedDate.getTime() + slot.durationHours * 60 * 60 * 1000,
    )

    const existingRentals = await db.query.slotRentals.findMany({
      where: and(
        eq(slotRentals.slotId, slotId),
        // Check for overlapping rentals
        and(
          lte(slotRentals.startTime, rentalEndTime),
          gte(slotRentals.endTime, requestedDate),
        ),
      ),
    })

    const isAvailable =
      existingRentals.length < (slot.maxConcurrentRentals || 1)

    return c.json({
      available: isAvailable,
      slot,
      existingRentals: existingRentals.length,
      maxConcurrent: slot.maxConcurrentRentals || 1,
    })
  } catch (error) {
    captureException(error)
    return c.json({ error: "Failed to check availability" }, 500)
  }
})
