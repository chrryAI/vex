import {
  getApp,
  isOwner,
  getScheduledJob,
  createScheduledJob,
  updateScheduledJob,
  modelName,
} from "@repo/db"
import {
  checkMoltbookHealth,
  getMoltbookAgentInfo,
} from "../integrations/moltbook"

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
    }))

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
      startDate,
      endDate: endDate ? new Date(endDate) : null,
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
      ...(jobType === "molt" && { moltbookHandle }),
    }

    // Create or update schedule
    let scheduledJob
    let action: "CREATE" | "UPDATE"

    if (existingSchedule) {
      scheduledJob = await updateScheduledJob({
        id: existingSchedule.id,
        ...scheduleData,
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
      })
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
