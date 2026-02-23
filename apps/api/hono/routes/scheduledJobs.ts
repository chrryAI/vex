import { tribeScheduleSchema } from "@chrryai/chrry/schemas/tribeScheduleSchema"
import { isOwner } from "@chrryai/chrry/utils"
import {
  deleteScheduledJob,
  getApp,
  getApp as getAppDb,
  getScheduledJob,
  getScheduledJobs,
} from "@repo/db"
import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { validate } from "uuid"
import { captureException } from "../../lib/captureException"
import { createOrUpdateTribeSchedule } from "../../lib/scheduledJobs/tribeScheduleManager"
import { getGuest, getMember } from "../lib/auth"

export const scheduledJobs = new Hono()

// GET /apps - Intelligent app resolution (no ID)

// GET /apps/:id/scheduledJobs - Get scheduled jobs for an app (MUST be before /:id catch-all)
scheduledJobs.get("/", async (c) => {
  const appId = c.req.query("appId")

  if (!appId || (appId && !validate(appId))) {
    return c.json({ error: "Invalid app ID" }, { status: 400 })
  }
  const member = await getMember(c, {
    skipCache: true,
  })
  const guest = await getGuest(c, {
    skipCache: true,
  })
  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get existing app
  const existingApp = await getAppDb({
    id: appId,
    userId: member?.id,
    guestId: guest?.id,
    skipCache: true,
  })

  if (!existingApp) {
    return c.json({ error: "App not found" }, { status: 404 })
  }

  // Verify ownership
  if (!isOwner(existingApp, { userId: member?.id, guestId: guest?.id })) {
    return c.json({ error: "Forbidden" }, { status: 403 })
  }

  const scheduledJobs = await getScheduledJobs({
    appId,
    userId: member?.id,
    // scheduleTypes: ["molt", "tribe"],
  })

  return c.json({ scheduledJobs })
})

scheduledJobs.post("/", async (c) => {
  try {
    const rawBody = await c.req.json()

    // Preprocess incoming payload: convert date strings to Date objects
    const bodyForValidation: any = { ...rawBody }
    if (
      bodyForValidation.startDate &&
      typeof bodyForValidation.startDate === "string"
    ) {
      bodyForValidation.startDate = new Date(bodyForValidation.startDate)
    }
    if (
      bodyForValidation.endDate &&
      typeof bodyForValidation.endDate === "string"
    ) {
      bodyForValidation.endDate = new Date(bodyForValidation.endDate)
    }

    // Validate and sanitize input with Zod
    const validationResult = tribeScheduleSchema.safeParse(bodyForValidation)

    if (!validationResult.success) {
      console.error("❌ Validation failed:", validationResult.error.format())
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.format(),
        },
        { status: 400 },
      )
    }

    // Use sanitized and validated data
    const {
      sessionId: _sessionId,
      appId,
      schedule,
      frequency,
      startDate,
      endDate,
      totalCredits,
      totalPrice,
      contentTemplate,
      contentRules,
      timezone,
    } = validationResult.data

    const jobType = ["tribe", "molt"].includes(bodyForValidation.jobType)
      ? bodyForValidation.jobType
      : "tribe"

    const createPending = bodyForValidation.createPending === true

    const member = await getMember(c)
    const userId = member?.id

    if (!userId) {
      return c.json({ error: "Authentication required" }, 401)
    }

    if (!appId) {
      return c.json({ error: "App ID is required" }, 400)
    }

    if (createPending) {
      // 🔒 SECURITY: Calculate price on backend
      // Use lib function with skipPaymentValidation and createPending flag
      const result = await createOrUpdateTribeSchedule({
        userId: userId,
        appId,
        jobType: jobType as "tribe" | "molt",
        schedule,
        frequency: frequency as "once" | "daily" | "weekly" | "custom",
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        timezone,
        contentTemplate,
        contentRules,
        pendingPayment: Math.round(totalPrice), // In dev: no payment needed
        totalCredits: totalCredits,
        totalPrice: Math.round(totalPrice), // Already in cents from frontend
        // status: isDevelopment ? "active" : undefined, // In dev: activate immediately
        createPending: true, // In dev: skip pending_payment status
      })

      if (!result.success) {
        return c.json(
          { error: result.error, details: result.details },
          (result.statusCode as ContentfulStatusCode) || 500,
        )
      }

      return c.json({
        success: true,
        scheduleId: result.scheduleId,
        message: "Pending schedule created",
        creditsEstimated: result.creditsReserved,
      })
    } else {
      try {
        const existingSchedule = await getScheduledJob({
          appId,
          userId: userId,
          scheduleTypes: [jobType],
        })

        if (!existingSchedule) {
          return c.json({ error: "Schedule not found" }, 404)
        }

        // Check cooldown
        const _lastUpdated =
          existingSchedule.updatedOn || existingSchedule.createdOn

        let priceDifference = totalPrice // in cents
        const oldPrice = existingSchedule.totalPrice || 0 // in cents
        priceDifference = totalPrice - oldPrice // price diff in cents

        console.log(`📊 Schedule price comparison:`, {
          oldPrice,
          newPrice: totalPrice,
          priceDifference,
          isUpgrade: priceDifference > 0,
          isDowngrade: priceDifference < 0,
          isSame: priceDifference === 0,
        })

        const PRICE_TOLERANCE = 1 // 1 cent tolerance (integer cents)

        const result = await createOrUpdateTribeSchedule({
          userId: userId,
          appId,
          jobType: jobType as "tribe" | "molt",
          schedule,
          frequency: frequency as "once" | "daily" | "weekly" | "custom",
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : undefined,
          timezone,
          contentTemplate,
          contentRules,
          totalCredits,
          pendingPayment:
            priceDifference > PRICE_TOLERANCE ? Math.round(priceDifference) : 0, // Already in cents
          totalPrice: Math.round(totalPrice), // Already in cents from frontend
          status:
            priceDifference > PRICE_TOLERANCE
              ? "pending_payment"
              : existingSchedule.status,
        })

        if (!result.success) {
          return c.json(
            { error: result.error, details: result.details },
            (result.statusCode as ContentfulStatusCode) || 500,
          )
        }

        console.log(`✅ Schedule updated without payment:`, {
          scheduleId: result.scheduleId,
          newCredits: totalCredits,
        })

        return c.json({
          success: true,
          scheduleId: result.scheduleId,
          message: result.message,
          priceDifference,
        })
      } catch (error) {
        console.error("❌ Failed to retrieve Stripe session:", error)
        return c.json({ error: "Invalid payment session" }, 400)
      }
    }
  } catch (err: any) {
    captureException(err)
    console.error("Create/Update Tribe schedule error:", err)
    return c.json(
      { error: err.message || "Failed to create/update Tribe schedule" },
      500,
    )
  }
})

// POST /scheduledJobs/:id/revert - Revert to previous schedule
scheduledJobs.post("/:id/revert", async (c) => {
  const jobId = c.req.param("id")

  if (!jobId || !validate(jobId)) {
    return c.json({ error: "Invalid job ID" }, { status: 400 })
  }

  const member = await getMember(c, { skipCache: true })

  if (!member) {
    return c.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get the scheduled job
  const job = await getScheduledJob({
    id: jobId,
    userId: member.id,
    scheduleTypes: ["tribe", "molt"],
  })

  if (!job) {
    return c.json({ error: "Job not found or unauthorized" }, { status: 404 })
  }

  const app = job?.appId
    ? await getApp({
        id: job.appId,
      })
    : undefined

  if (!app) {
    return c.json({ error: "App not found or unauthorized" }, { status: 404 })
  }

  // Verify ownership
  if (job.userId !== member.id) {
    return c.json({ error: "Forbidden" }, { status: 403 })
  }

  // Check if previous schedule exists in metadata
  const previousSchedule = job.metadata?.previousSchedule
  if (!previousSchedule) {
    return c.json(
      { error: "No previous schedule found to revert to" },
      { status: 404 },
    )
  }

  try {
    // Restore complete previous schedule configuration
    const result = await createOrUpdateTribeSchedule({
      userId: member.id,
      appId: app.id,
      jobType: job.scheduleType as "tribe" | "molt",
      schedule: previousSchedule.scheduledTimes,
      frequency: previousSchedule.frequency,
      startDate: new Date(previousSchedule.startDate),
      endDate: previousSchedule.endDate
        ? new Date(previousSchedule.endDate)
        : undefined,
      timezone: previousSchedule.timezone,
      contentTemplate: previousSchedule.contentTemplate,
      contentRules: previousSchedule.contentRules,
      totalCredits: previousSchedule.totalEstimatedCredits,
      totalPrice: previousSchedule.totalPrice,
      sessionId: previousSchedule.stripePaymentIntentId,
      status: previousSchedule.isPaid ? "active" : "pending_payment",
      skipCooldownCheck: true, // Allow immediate revert
    })

    if (!result.success) {
      return c.json({ error: result.error }, 500)
    }

    return c.json({
      success: true,
      message: "Schedule reverted to previous version",
      scheduleId: result.scheduleId,
    })
  } catch (error) {
    captureException(error)
    console.error("Revert schedule error:", error)
    return c.json({ error: "Failed to revert schedule" }, 500)
  }
})

// DELETE /scheduledJobs/:id - Delete a scheduled job
scheduledJobs.delete("/:id", async (c) => {
  const jobId = c.req.param("id")

  if (!jobId || !validate(jobId)) {
    return c.json({ error: "Invalid job ID" }, { status: 400 })
  }

  const member = await getMember(c, {
    skipCache: true,
  })

  if (!member) {
    return c.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get the scheduled job to verify ownership
  const job = await getScheduledJob({
    id: jobId,
    userId: member.id,
    scheduleTypes: ["tribe", "molt"],
  })

  if (!job) {
    return c.json({ error: "Job not found or unauthorized" }, { status: 404 })
  }

  // Verify user owns this job
  if (job.userId !== member.id) {
    return c.json({ error: "Forbidden" }, { status: 403 })
  }

  // Delete the job
  const deleted = await deleteScheduledJob(jobId)

  if (!deleted) {
    return c.json({ error: "Failed to delete job" }, { status: 500 })
  }

  return c.json({ success: true, message: "Job deleted successfully" })
})

// GET /apps/:id - Get single app by ID
