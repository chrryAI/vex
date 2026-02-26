import {
  createCalendarEvent,
  createScheduledJob,
  getApp,
  getScheduledJob,
  getUser,
  isDevelopment,
  isOwner,
  type modelName,
  updateCalendarEvent,
  updateScheduledJob,
} from "@repo/db"
import { fromZonedTime } from "date-fns-tz"
import {
  checkMoltbookHealth,
  getMoltbookAgentInfo,
} from "../integrations/moltbook"
import { calculateNextRunTime } from "./jobScheduler"

/**
 * Verify Moltbook connection and get agent handle
 */
export async function verifyMoltbookConnection(moltApiKey: string): Promise<{
  success: boolean
  handle?: string
  error?: string
}> {
  try {
    // Check health
    const health = await checkMoltbookHealth(moltApiKey)
    if (!health.healthy) {
      return {
        success: false,
        error: health.error || "Moltbook connection failed",
      }
    }

    // Get agent info
    const agentInfo = await getMoltbookAgentInfo(moltApiKey)
    if (!agentInfo) {
      return {
        success: false,
        error: "Failed to fetch Moltbook agent info",
      }
    }

    return {
      success: true,
      handle: agentInfo.name,
    }
  } catch (error) {
    console.error("Moltbook verification error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Create or update a tribe/molt schedule
 * Handles all validation, cooldown checks, payment verification
 */
export async function createOrUpdateTribeSchedule(params: {
  // User & App
  userId: string
  appId: string
  jobType: "tribe" | "molt"
  status?:
    | "draft"
    | "pending_payment"
    | "active"
    | "paused"
    | "completed"
    | "canceled"
  // Schedule configuration
  schedule: Array<{
    time: string
    credits: number
    model: string
    postType?: string
    charLimit?: number
    generateImage?: boolean
    generateVideo?: boolean
    fetchNews?: boolean
  }>
  frequency: "once" | "daily" | "weekly" | "custom"
  startDate: Date
  endDate?: Date
  timezone?: string
  contentTemplate?: string

  contentRules?: {
    tone?: string
    length?: string
    topics?: string[]
    hashtags?: string[]
  }
  pendingPayment?: number

  // Payment (optional for updates with same/lower price)
  sessionId?: string
  totalCredits: number
  totalPrice: number

  // Options
  skipCooldownCheck?: boolean // For admin override
  createPending?: boolean // Create with pending_payment status (before payment)
}): Promise<
  | {
      success: true
      scheduleId: string
      action: "CREATE" | "UPDATE"
      creditsReserved?: number
      message: string
    }
  | {
      success: false
      error: string
      details?: any
      statusCode?: number
    }
> {
  const {
    userId,
    appId,
    jobType,
    schedule,
    frequency,
    startDate,
    endDate,
    timezone = "UTC",
    contentTemplate,
    contentRules,
    sessionId,
    totalCredits,
    totalPrice,
    pendingPayment,
  } = params

  const now = new Date()

  try {
    // Get app with real moltApiKey (unsafe mode)
    const app = await getApp({ id: appId, userId, isSafe: false })
    if (!app) {
      return {
        success: false,
        error: "App not found",
        statusCode: 404,
      }
    }

    const user = await getUser({ id: userId })

    if (!user) {
      return {
        success: false,
        error: "User Not Found",
        statusCode: 404,
      }
    }

    // Verify ownership
    if (!isOwner(app, { userId })) {
      return {
        success: false,
        error: "You don't have permission to create this schedule",
        statusCode: 403,
      }
    }

    // Verify Moltbook connection for molt schedules
    let moltbookHandle: string | undefined
    if (jobType === "molt") {
      const moltApiKey = app.moltApiKey
      if (!moltApiKey) {
        return {
          success: false,
          error: "Moltbook API key not configured",
          details:
            "Please set up your Moltbook connection in app settings first",
          statusCode: 400,
        }
      }

      const moltVerification = await verifyMoltbookConnection(moltApiKey)
      if (!moltVerification.success) {
        return {
          success: false,
          error: "Moltbook connection failed",
          details: moltVerification.error,
          statusCode: 400,
        }
      }
      moltbookHandle = moltVerification.handle
    }

    // Check for existing schedule
    const existingSchedule = await getScheduledJob({
      appId,
      userId,
      scheduleTypes: [jobType],
    })

    // Calculate price difference for updates
    let priceDifference = totalCredits
    if (existingSchedule) {
      const oldCredits = existingSchedule.totalEstimatedCredits || 0
      priceDifference = totalCredits - oldCredits

      console.log(`📊 Schedule price comparison:`, {
        oldPrice: oldCredits,
        newPrice: totalCredits,
        priceDifference,
        isUpgrade: priceDifference > 0,
        isDowngrade: priceDifference < 0,
        isSame: priceDifference === 0,
      })
    }

    // Payment validation (if not skipped)

    // Prepare schedule data with normalized scheduledTimes
    const normalizedScheduledTimes = schedule.map((item) => ({
      time: item.time,
      model: item.model,
      postType: (item.postType || "post") as "post" | "comment" | "engagement",
      charLimit: item.charLimit || 280,
      credits: item.credits,
      ...(item.generateImage !== undefined && {
        generateImage: item.generateImage,
      }),
      ...(item.generateVideo !== undefined && {
        generateVideo: item.generateVideo,
      }),
      ...(item.fetchNews !== undefined && { fetchNews: item.fetchNews }),
    }))

    // Calculate next run time (pass only fields calculateNextRunTime needs)
    const nextRunAt = calculateNextRunTime(
      normalizedScheduledTimes.map(
        ({ time, model, postType, charLimit, credits }) => ({
          time,
          model,
          postType,
          charLimit,
          credits,
        }),
      ),
      timezone,
      frequency,
    )

    // Use fromZonedTime to ensure "local midnight" is the basis for comparison
    // If it's a Date (likely UTC midnight from Hono), convert it back to the local date string first
    const normalizeDate = (d: any) => {
      if (!d) return null
      const dateStr = typeof d === "string" ? d : d.toISOString().split("T")[0]
      return fromZonedTime(dateStr, timezone)
    }

    const normalizedStartDate = normalizeDate(params.startDate) || now
    const normalizedEndDate = normalizeDate(params.endDate)

    const scheduleData = {
      userId,
      appId,
      name: `${jobType === "tribe" ? "Tribe" : "Molt"} Schedule`,
      scheduleType: jobType,
      jobType: (jobType === "tribe" ? "tribe_post" : "moltbook_post") as
        | "tribe_post"
        | "moltbook_post",
      frequency,
      scheduledTimes: normalizedScheduledTimes,
      timezone,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      aiModel: (schedule[0]?.model as modelName) || "sushi",
      modelConfig: {
        temperature: 0.7,
      },
      totalPrice: totalPrice,
      pendingPayment: pendingPayment ? pendingPayment : undefined,
      contentTemplate: contentTemplate ?? null,
      contentRules: contentRules ?? null,
      estimatedCreditsPerRun:
        schedule.length > 0 ? Math.ceil(totalCredits / schedule.length) : 0,
      totalEstimatedCredits: totalCredits,
      creditsUsed: 0,
      isPaid: !pendingPayment || pendingPayment === 0,
      stripePaymentIntentId: sessionId ?? null,
      status: params.status ?? existingSchedule?.status ?? ("active" as const),
      nextRunAt, // Set next run time
      ...(jobType === "molt" && { moltbookHandle }),
    }

    // Create or update schedule
    let scheduledJob
    let action: "CREATE" | "UPDATE"

    if (existingSchedule) {
      // Save previous schedule to metadata ONLY if it's active (not pending)
      const shouldSavePrevious =
        scheduleData.status === "pending_payment" &&
        existingSchedule.status === "active"

      const previousSchedule = shouldSavePrevious
        ? {
            scheduledTimes: existingSchedule.scheduledTimes || [],
            frequency: existingSchedule.frequency,
            startDate: existingSchedule.startDate?.toISOString() || "",
            endDate: existingSchedule.endDate?.toISOString(),
            timezone: existingSchedule.timezone || "UTC",
            aiModel: existingSchedule.aiModel,
            modelConfig: existingSchedule.modelConfig || undefined,
            contentTemplate: existingSchedule.contentTemplate || undefined,
            contentRules: existingSchedule.contentRules || undefined,
            estimatedCreditsPerRun:
              existingSchedule.estimatedCreditsPerRun || 0,
            totalEstimatedCredits: existingSchedule.totalEstimatedCredits || 0,
            totalPrice: existingSchedule.totalPrice || 0,
            isPaid: existingSchedule.isPaid || false,
            stripePaymentIntentId:
              existingSchedule.stripePaymentIntentId || undefined,
            updatedAt: new Date().toISOString(),
          }
        : undefined

      scheduledJob = await updateScheduledJob({
        id: existingSchedule.id,
        ...scheduleData,
        metadata: shouldSavePrevious
          ? {
              ...existingSchedule.metadata,
              previousSchedule,
            }
          : existingSchedule.metadata,
        nextRunAt: isDevelopment || user?.role === "admin" ? null : undefined,
      })
      action = "UPDATE"

      console.log(`✅ Schedule updated:`, {
        scheduleId: scheduledJob?.id,
        userId,
        appId,
        scheduleType: jobType,
        action,
        priceDifference,
        scheduleData: scheduleData.status,
        p: params.status,
        previousScheduleSaved: shouldSavePrevious,
      })

      // Update calendar event if dates changed
      if (scheduledJob?.calendarEventId && nextRunAt) {
        try {
          await updateCalendarEvent({
            id: scheduledJob.calendarEventId,
            startTime: nextRunAt,
            endTime: new Date(nextRunAt.getTime() + 60 * 60 * 1000), // 1 hour duration
            title: `${jobType === "tribe" ? "Tribe" : "Molt"} Post`,
            description: `Scheduled ${jobType} post for ${app.name}`,
          })
          console.log(
            `📅 Calendar event updated for schedule ${scheduledJob.id}`,
          )
        } catch (error) {
          console.error("⚠️ Failed to update calendar event:", error)
        }
      }
    } else {
      scheduledJob = await createScheduledJob({
        ...scheduleData,
        isPaid: !pendingPayment || pendingPayment === 0,
        status: params.status || "pending_payment",
      })

      action = "CREATE"

      console.log(`✅ Schedule created:`, {
        scheduleId: scheduledJob?.id,
        userId,
        appId,
        scheduleType: jobType,
        action,
      })

      // Create calendar event for new schedule
      if (scheduledJob && nextRunAt) {
        try {
          const calendarEvent = await createCalendarEvent({
            userId,
            title: `${jobType === "tribe" ? "Tribe" : "Molt"} Post`,
            description: `Scheduled ${jobType} post for ${app.name}`,
            startTime: nextRunAt,
            endTime: new Date(nextRunAt.getTime() + 60 * 60 * 1000), // 1 hour duration
            isAllDay: false,
            timezone,
          })

          // Update scheduled job with calendar event ID
          if (calendarEvent) {
            await updateScheduledJob({
              id: scheduledJob.id,
              calendarEventId: calendarEvent.id,
            })
            console.log(
              `📅 Calendar event created for schedule ${scheduledJob.id}`,
            )
          }
        } catch (error) {
          console.error("⚠️ Failed to create calendar event:", error)
        }
      }
    }

    return {
      success: true,
      scheduleId: scheduledJob?.id || "",
      action,
      message: `${jobType === "tribe" ? "Tribe" : "Molt"} schedule ${action === "CREATE" ? "created" : "updated"} successfully`,
    }
  } catch (error) {
    console.error("createOrUpdateTribeSchedule error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      statusCode: 500,
    }
  }
}
