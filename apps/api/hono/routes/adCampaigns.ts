import crypto from "node:crypto"
import { isDevelopment } from "@chrryai/chrry/utils"
import {
  and,
  appCampaigns,
  autonomousBids,
  db,
  desc,
  eq,
  gte,
  lte,
  type newAppCampaign,
  slotRentals,
  sql,
  storeTimeSlots,
} from "@repo/db"
import { guests, users } from "@repo/db/src/schema"
import { Hono } from "hono"
import { z } from "zod"
import { runautonomousBidding } from "../../lib/adExchange/autonomousBidding"
import {
  processAuctionResults,
  updateCampaignPerformance,
} from "../../lib/adExchange/campaignLearning"
import { captureException } from "../../lib/captureException"
import { getGuest, getMember } from "../lib/auth"

export const adCampaignsRoute = new Hono()

// GET /campaigns - List user's campaigns
adCampaignsRoute.get("/", async (c) => {
  try {
    const member = await getMember(c)
    const guest = member ? null : await getGuest(c)

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
    const guest = member ? null : await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const campaign = await db.query.appCampaigns.findFirst({
      where: eq(appCampaigns.id, id),
      with: {
        app: true,
      },
    })

    if (!campaign) {
      return c.json({ error: "Campaign not found" }, 404)
    }

    // Check ownership
    const ownerMatch =
      (member && campaign.userId === member.id) ||
      (guest && campaign.guestId === guest.id)
    if (!ownerMatch) {
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
    const guest = member ? null : await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const createCampaignSchema = z.object({
      appId: z.string().uuid(),
      name: z.string().min(1).max(100),
      totalCredits: z.number().int().positive(),
      optimizationGoal: z
        .enum(["traffic", "conversions", "knowledge", "balanced"])
        .optional()
        .default("balanced"),
      biddingStrategy: z
        .enum(["smart", "aggressive", "conservative", "custom"])
        .optional()
        .default("smart"),
      targetStores: z.array(z.string()).optional(),
      targetCategories: z.array(z.string()).optional(),
      excludeStores: z.array(z.string()).optional(),
      minTraffic: z.number().int().nonnegative().optional().default(100),
      maxPricePerSlot: z.number().nonnegative().optional(),
      preferredDays: z.array(z.number().int().min(0).max(6)).optional(),
      preferredHours: z.array(z.string()).optional(),
      avoidPrimeTime: z.boolean().optional().default(false),
      dailyBudget: z.number().nonnegative().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    })
    const parsed = createCampaignSchema.safeParse(await c.req.json())
    if (!parsed.success) {
      return c.json(
        { error: "Invalid payload", details: parsed.error.issues },
        400,
      )
    }
    const body = parsed.data

    // Create campaign
    const [campaign] = await db
      .insert(appCampaigns)
      .values({
        appId: body.appId,
        userId: member?.id,
        guestId: guest?.id,
        name: body.name,
        totalCredits: body.totalCredits,
        creditsRemaining: body.totalCredits,
        optimizationGoal: body.optimizationGoal,
        biddingStrategy: body.biddingStrategy,
        targetStores: body.targetStores,
        targetCategories: body.targetCategories,
        excludeStores: body.excludeStores,
        minTraffic: body.minTraffic,
        maxPricePerSlot: body.maxPricePerSlot,
        preferredDays: body.preferredDays,
        preferredHours: body.preferredHours,
        avoidPrimeTime: body.avoidPrimeTime,
        dailyBudget: body.dailyBudget,
        status: "active",
        metadata: body.metadata ?? null,
      } as newAppCampaign)
      .returning()

    if (isDevelopment && campaign)
      console.debug("campaign_created", {
        id: campaign.id,
        name: campaign.name,
      })

    if (!campaign) {
      return c.json({ error: "Failed to create campaign" }, 500)
    }

    // Schedule initial bidding asynchronously (non-blocking)
    setImmediate(() => {
      runautonomousBidding({ campaignId: campaign.id }).catch((error) => {
        console.error(
          `Failed to run autonomous bidding for campaign ${campaign.id}:`,
          error,
        )
        captureException(error)
      })
    })

    return c.json({
      campaign,
      message: "Campaign created, autonomous bidding scheduled",
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
    const guest = member ? null : await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const campaign = await db.query.appCampaigns.findFirst({
      where: eq(appCampaigns.id, id),
    })

    if (!campaign) {
      return c.json({ error: "Campaign not found" }, 404)
    }

    // Check ownership
    const ownerMatch =
      (member && campaign.userId === member.id) ||
      (guest && campaign.guestId === guest.id)
    if (!ownerMatch) {
      return c.json({ error: "Forbidden" }, 403)
    }

    const updateCampaignSchema = z
      .object({
        appId: z.string().uuid().optional(),
        name: z.string().min(1).max(100).optional(),
        totalCredits: z.number().int().positive().optional(),
        optimizationGoal: z
          .enum(["traffic", "conversions", "knowledge", "balanced"])
          .optional(),
        biddingStrategy: z
          .enum(["smart", "aggressive", "conservative", "custom"])
          .optional(),
        targetStores: z.array(z.string()).optional(),
        targetCategories: z.array(z.string()).optional(),
        excludeStores: z.array(z.string()).optional(),
        minTraffic: z.number().int().nonnegative().optional(),
        maxPricePerSlot: z.number().nonnegative().optional(),
        preferredDays: z.array(z.number().int().min(0).max(6)).optional(),
        preferredHours: z.array(z.string()).optional(),
        avoidPrimeTime: z.boolean().optional(),
        dailyBudget: z.number().nonnegative().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      })
      .partial()
    const parsed = updateCampaignSchema.safeParse(await c.req.json())
    if (!parsed.success) {
      return c.json(
        { error: "Invalid payload", details: parsed.error.issues },
        400,
      )
    }

    const [updated] = await db
      .update(appCampaigns)
      .set({
        ...parsed.data,
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
    const guest = member ? null : await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const campaign = await db.query.appCampaigns.findFirst({
      where: eq(appCampaigns.id, id),
    })

    if (!campaign) {
      return c.json({ error: "Campaign not found" }, 404)
    }

    // Check ownership
    const ownerMatch =
      (member && campaign.userId === member.id) ||
      (guest && campaign.guestId === guest.id)
    if (!ownerMatch) {
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
    const guest = member ? null : await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const campaign = await db.query.appCampaigns.findFirst({
      where: eq(appCampaigns.id, id),
    })

    if (!campaign) {
      return c.json({ error: "Campaign not found" }, 404)
    }

    // Check ownership
    const ownerMatch =
      (member && campaign.userId === member.id) ||
      (guest && campaign.guestId === guest.id)
    if (!ownerMatch) {
      return c.json({ error: "Forbidden" }, 403)
    }

    // Prevent resuming completed campaigns
    if (campaign.status === "completed") {
      return c.json({ error: "Cannot resume a completed campaign" }, 400)
    }

    const [updated] = await db
      .update(appCampaigns)
      .set({
        status: "active",
        updatedOn: new Date(),
      })
      .where(eq(appCampaigns.id, id))
      .returning()

    // Schedule bidding asynchronously (non-blocking)
    setImmediate(() => {
      runautonomousBidding({ campaignId: id }).catch((error) => {
        console.error(
          `Failed to run autonomous bidding for campaign ${id}:`,
          error,
        )
        captureException(error)
      })
    })

    return c.json({
      campaign: updated,
      message: "Campaign resumed, autonomous bidding scheduled",
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
    const guest = member ? null : await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const campaign = await db.query.appCampaigns.findFirst({
      where: eq(appCampaigns.id, id),
    })

    if (!campaign) {
      return c.json({ error: "Campaign not found" }, 404)
    }

    // Check ownership
    const ownerMatch =
      (member && campaign.userId === member.id) ||
      (guest && campaign.guestId === guest.id)
    if (!ownerMatch) {
      return c.json({ error: "Forbidden" }, 403)
    }

    // Schedule bidding asynchronously (non-blocking)
    setImmediate(() => {
      runautonomousBidding({ campaignId: id }).catch((error) => {
        console.error(
          `Failed to run autonomous bidding for campaign ${id}:`,
          error,
        )
        captureException(error)
      })
    })

    return c.json({
      message: "Autonomous bidding scheduled",
      campaignId: id,
    })
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

    // Authenticate the caller
    const member = await getMember(c)
    const guest = member ? null : await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    // Load the rental to check ownership
    const rental = await db.query.slotRentals.findFirst({
      where: eq(slotRentals.id, id),
    })

    if (!rental) {
      return c.json({ error: "Rental not found" }, 404)
    }

    // Authorize: ensure the authenticated user owns the rental or has admin/cron privileges
    const isOwner =
      (member && rental.userId === member.id) ||
      (guest && rental.guestId === guest.id)
    const isAdmin = member?.role === "admin"
    const authHeader = c.req.header("authorization") || ""
    const bearer = authHeader.replace(/^Bearer\s+/i, "")
    const cronSecret = process.env.CRON_SECRET || ""
    const isCron =
      !!cronSecret &&
      bearer.length === cronSecret.length &&
      crypto.timingSafeEqual(Buffer.from(bearer), Buffer.from(cronSecret))

    if (!isOwner && !isAdmin && !isCron) {
      return c.json({ error: "Forbidden" }, 403)
    }

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
    // Require admin user OR a valid cron secret bearer token
    const member = await getMember(c)
    const authHeader = c.req.header("authorization") || ""
    const bearer = authHeader.replace(/^Bearer\s+/i, "")
    const cronSecret = process.env.CRON_SECRET || ""
    const hasCronSecret =
      !!cronSecret &&
      bearer.length === cronSecret.length &&
      crypto.timingSafeEqual(Buffer.from(bearer), Buffer.from(cronSecret))

    if (!(member?.role === "admin" || hasCronSecret)) {
      return c.json({ error: "Forbidden" }, 403)
    }

    const auctionSchema = z.object({
      slotId: z.string().uuid(),
      auctionDate: z.string().refine(
        (dateStr) => {
          const date = new Date(dateStr)
          return !Number.isNaN(date.getTime())
        },
        { message: "Invalid date format" },
      ),
    })

    const parsed = auctionSchema.safeParse(await c.req.json())
    if (!parsed.success) {
      return c.json(
        { error: "Invalid payload", details: parsed.error.issues },
        400,
      )
    }

    const { slotId, auctionDate } = parsed.data

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
    const guest = member ? null : await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const body = await c.req.json()

    const rentSchema = z.object({
      appId: z.string().uuid(),
      startDate: z.string().refine((date) => !Number.isNaN(Date.parse(date)), {
        message: "Invalid start date",
      }),
    })

    const parsed = rentSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { error: "Invalid input", details: parsed.error.issues },
        400,
      )
    }

    const { appId, startDate } = parsed.data

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

    // Create rental with transaction to prevent race conditions
    const rentalStartTime = new Date(startDate)
    const rentalEndTime = new Date(
      rentalStartTime.getTime() + slot.durationHours * 60 * 60 * 1000,
    )

    // Use a transaction to ensure atomicity and prevent overbooking
    const rental = await db.transaction(async (tx) => {
      // Acquire row lock using SELECT FOR UPDATE to prevent concurrent modifications
      const lockedSlotResult = await tx.execute(
        sql`SELECT * FROM ${storeTimeSlots} WHERE ${storeTimeSlots.id} = ${slotId} FOR UPDATE`,
      )

      const rows = (lockedSlotResult as any).rows
      if (!rows || rows.length === 0) {
        throw new Error("Slot not found")
      }

      // Deduct credits atomically inside the transaction
      let debitOk = false
      if (member) {
        const res = await tx
          .update(users)
          .set({ credits: sql`${users.credits} - ${totalCredits}` })
          .where(and(eq(users.id, member.id), gte(users.credits, totalCredits)))
          .returning({ credits: users.credits })
        debitOk = res.length > 0
      } else if (guest) {
        const res = await tx
          .update(guests)
          .set({ credits: sql`${guests.credits} - ${totalCredits}` })
          .where(
            and(eq(guests.id, guest.id), gte(guests.credits, totalCredits)),
          )
          .returning({ credits: guests.credits })
        debitOk = res.length > 0
      }

      if (!debitOk) {
        throw new Error("Insufficient credits")
      }

      // Count existing overlapping rentals (excluding cancelled/completed)
      const overlappingRentals = await tx.query.slotRentals.findMany({
        where: and(
          eq(slotRentals.slotId, slotId),
          and(
            lte(slotRentals.startTime, rentalEndTime),
            gte(slotRentals.endTime, rentalStartTime),
          ),
        ),
      })

      const activeOverlapping = overlappingRentals.filter(
        (r) => r.status !== "cancelled" && r.status !== "completed",
      )

      const maxConcurrent = slot.maxConcurrentRentals || 1
      if (activeOverlapping.length >= maxConcurrent) {
        throw new Error(
          `Slot is fully booked (${activeOverlapping.length}/${maxConcurrent} rentals)`,
        )
      }

      // Create a campaign for this direct rental
      const [campaign] = await tx
        .insert(appCampaigns)
        .values({
          appId,
          userId: member?.id,
          guestId: guest?.id,
          name: `Direct Rental - ${new Date().toISOString()}`,
          totalCredits,
          creditsRemaining: 0,
          optimizationGoal: "balanced",
          biddingStrategy: "smart",
          status: "active",
          metadata: { directRental: true },
        } as newAppCampaign)
        .returning()

      if (!campaign) {
        throw new Error("Failed to create campaign")
      }

      // Insert the rental with the campaign ID
      const [newRental] = await tx
        .insert(slotRentals)
        .values({
          slotId,
          appId,
          campaignId: campaign.id,
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

      return newRental
    })

    if (!rental) {
      return c.json({ error: "Failed to rent slot" }, 500)
    }

    if (isDevelopment)
      console.debug("manual_rental_created", {
        id: rental?.id,
        credits: totalCredits,
      })

    return c.json({
      rental,
      creditsCharged: totalCredits,
      message: "Slot rented successfully",
    })
  } catch (error) {
    captureException(error)
    const errorMessage =
      error instanceof Error ? error.message : "Failed to rent slot"

    // Return 402 for insufficient credits
    if (errorMessage.includes("Insufficient credits")) {
      return c.json({ error: errorMessage }, 402)
    }

    return c.json({ error: errorMessage }, 500)
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
    if (Number.isNaN(requestedDate.getTime())) {
      return c.json({ error: "Invalid date parameter" }, 400)
    }

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

    // Filter out cancelled and completed rentals
    const activeRentals = existingRentals.filter(
      (r) => r.status !== "cancelled" && r.status !== "completed",
    )

    const isAvailable = activeRentals.length < (slot.maxConcurrentRentals || 1)

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
