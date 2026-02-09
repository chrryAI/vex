import { Hono } from "hono"
import Stripe from "stripe"
import {
  getApp,
  getCreditTransactions,
  isOwner,
  getScheduledJob,
  createScheduledJob,
  updateScheduledJob,
  updateCreditTransaction,
} from "@repo/db"
import { getMember } from "../lib/auth"
import captureException from "../../lib/captureException"
import { tribeScheduleSchema } from "@chrryAI/chrry/schemas/tribeScheduleSchema"
import { calculateCreditsFromDB } from "../../lib/scheduledJobs/creditCalculator"

export const createTribeSchedule = new Hono()

// POST /createTribeSchedule - Create or update Tribe schedule after payment verification
createTribeSchedule.post("/", async (c) => {
  try {
    const rawBody = await c.req.json()

    // Validate and sanitize input with Zod
    const validationResult = tribeScheduleSchema.safeParse(rawBody)

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
      sessionId,
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

    const member = await getMember(c)
    const effectiveUserId = member?.id

    if (!effectiveUserId) {
      return c.json({ error: "Authentication required" }, 401)
    }

    const app = await getApp({ id: appId, userId: effectiveUserId })

    // 🔒 SECURITY: Validate Stripe session
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    let stripeSession: Stripe.Checkout.Session

    try {
      stripeSession = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["line_items"],
      })
    } catch (error) {
      console.error("❌ Failed to retrieve Stripe session:", error)
      return c.json({ error: "Invalid payment session" }, 400)
    }

    // Verify payment was completed
    if (stripeSession.payment_status !== "paid") {
      return c.json({ error: "Payment not completed" }, 400)
    }

    // 🔒 SECURITY: Calculate price on backend using same calculator as UI
    const CREDITS_PRICE = 5.0 // EUR per 1000 credits
    const calculatedResult = await calculateCreditsFromDB({
      frequency: frequency as "daily" | "weekly" | "monthly",
      scheduledTimes: schedule.map((slot) => ({
        hour: parseInt(slot.time.split(":")[0] || "0"),
        minute: parseInt(slot.time.split(":")[1] || "0"),
        postType: slot.postType,
        model: slot.model,
        charLimit: slot.charLimit,
      })),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      creditsPrice: CREDITS_PRICE,
    })

    // Verify UI-provided price matches backend calculation
    if (Math.abs(calculatedResult.totalPrice - totalPrice) > 0.01) {
      console.error("❌ Price calculation mismatch:", {
        uiPrice: totalPrice,
        backendPrice: calculatedResult.totalPrice,
        uiCredits: totalCredits,
        backendCredits: calculatedResult.totalCredits,
      })
      return c.json(
        {
          error: "Price calculation mismatch",
          uiPrice: totalPrice,
          backendPrice: calculatedResult.totalPrice,
        },
        400,
      )
    }

    // Verify payment amount matches calculated price (convert cents to EUR)
    const paidAmount = (stripeSession.amount_total || 0) / 100
    const expectedAmount = calculatedResult.totalPrice

    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      console.error("❌ Payment amount mismatch:", {
        paid: paidAmount,
        expected: expectedAmount,
      })
      return c.json(
        {
          error: "Payment amount mismatch",
          paid: paidAmount,
          expected: expectedAmount,
        },
        400,
      )
    }

    console.log("✅ Price validation passed:", {
      paidAmount,
      calculatedPrice: calculatedResult.totalPrice,
      totalCredits: calculatedResult.totalCredits,
    })

    // Verify payment by checking creditTransactions with sessionId
    const creditTransactions = await getCreditTransactions({ sessionId })

    if (!creditTransactions || creditTransactions.length === 0) {
      return c.json(
        { error: "Payment not found. Please complete payment first." },
        404,
      )
    }

    const creditTransaction = creditTransactions[0]

    if (
      creditTransaction?.type !== "tribe" &&
      creditTransaction?.type !== "molt"
    ) {
      return c.json({ error: "Invalid payment type" }, 400)
    }

    // Verify the payment belongs to the user
    if (effectiveUserId && creditTransaction.userId !== effectiveUserId) {
      return c.json({ error: "Payment does not belong to this user" }, 403)
    }

    // Verify app ownership if appId provided
    if (appId) {
      if (
        !isOwner(app, {
          userId: effectiveUserId,
        })
      ) {
        return c.json({ error: "App not found" }, 404)
      }

      if (
        !isOwner(app, {
          userId: effectiveUserId,
        })
      ) {
        return c.json(
          { error: "You don't have permission to create this schedule" },
          403,
        )
      }
    }

    // Check if schedule already exists for this app
    const existingSchedules = await getScheduledJob({
      appId,
      userId: effectiveUserId,
      scheduleTypes: [creditTransaction.type],
    })

    const existingSchedule = existingSchedules?.[0]

    // Check price difference if updating existing schedule
    if (existingSchedule) {
      const oldPrice = existingSchedule.totalEstimatedCredits
      const newPrice = totalCredits
      const priceDifference = newPrice - oldPrice

      if (priceDifference > 0) {
        // New schedule is MORE expensive - require payment for difference
        // Get all credit transactions for this schedule to calculate total paid
        const scheduleTransactions = await getCreditTransactions({
          scheduleId: existingSchedule.id,
          type: creditTransaction.type as "tribe" | "molt",
        })

        // Calculate total credits already paid for this schedule
        const totalPaidForSchedule = scheduleTransactions.reduce(
          (sum, tx) => sum + tx.amount,
          0,
        )

        // Add current payment
        const totalPaidIncludingNew =
          totalPaidForSchedule + (sessionId ? creditTransaction.amount : 0)

        // Check if total payment covers the new price
        if (totalPaidIncludingNew < newPrice) {
          const stillNeeded = newPrice - totalPaidIncludingNew
          return c.json(
            {
              error: `Additional payment required. You need ${stillNeeded} more credits.`,
              totalPaid: totalPaidIncludingNew,
              oldPrice,
              newPrice,
              priceDifference,
              stillNeeded,
            },
            400,
          )
        }
        console.log(
          `💰 Schedule upgrade: +${priceDifference} credits (${oldPrice} → ${newPrice}), total paid: ${totalPaidIncludingNew}`,
        )
      } else if (priceDifference < 0) {
        // New schedule is CHEAPER - refund difference to user
        const refundAmount = Math.abs(priceDifference)
        console.log(
          `💸 Schedule downgrade: -${refundAmount} credits will be refunded (${oldPrice} → ${newPrice})`,
        )
        // TODO: Refund credits to user balance
        // await updateUser({ id: effectiveUserId, credits: user.credits + refundAmount })
      } else {
        // Same price - free update
        console.log(`🔄 Schedule update: same price (${oldPrice} credits)`)
      }
    }

    const scheduleData = {
      userId: effectiveUserId,
      appId,
      name: `${creditTransaction.type === "tribe" ? "Tribe" : "Molt"} Schedule`,
      scheduleType: creditTransaction.type as "tribe" | "molt",
      jobType: (creditTransaction.type === "tribe"
        ? "tribe_post"
        : "moltbook_post") as "tribe_post" | "moltbook_post",
      frequency: frequency as "once" | "daily" | "weekly" | "custom",
      scheduledTimes: schedule.map((slot) => slot.time),
      timezone: timezone || "UTC",
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      aiModel: schedule[0]?.model || "sushi",
      modelConfig: {
        temperature: 0.7,
      },
      contentTemplate,
      contentRules,
      estimatedCreditsPerRun: Math.ceil(totalCredits / schedule.length),
      totalEstimatedCredits: totalCredits,
      creditsUsed: 0,
      isPaid: true,
      stripePaymentIntentId: sessionId,
      status: "active" as const,
    }

    let scheduledJob

    if (existingSchedule) {
      // UPDATE existing schedule with new payment
      scheduledJob = await updateScheduledJob({
        id: existingSchedule.id,
        data: scheduleData,
      })

      console.log("✅ Tribe/Molt schedule updated successfully:", {
        scheduleId: scheduledJob?.id,
        userId: effectiveUserId,
        appId,
        scheduleType: creditTransaction.type,
        frequency,
        scheduledTimes: schedule.length,
        totalCredits,
        creditsReserved: creditTransaction.amount,
        action: "UPDATE",
      })
    } else {
      // CREATE new schedule
      scheduledJob = await createScheduledJob(scheduleData)

      console.log("✅ Tribe/Molt schedule created successfully:", {
        scheduleId: scheduledJob?.id,
        userId: effectiveUserId,
        appId,
        scheduleType: creditTransaction.type,
        frequency,
        scheduledTimes: schedule.length,
        totalCredits,
        creditsReserved: creditTransaction.amount,
        action: "CREATE",
      })
    }

    // Link creditTransaction to schedule
    if (scheduledJob?.id) {
      await updateCreditTransaction({
        id: creditTransaction.id,
        scheduleId: scheduledJob.id,
        userId: creditTransaction.userId,
        guestId: creditTransaction.guestId,
        amount: creditTransaction.amount,
        balanceBefore: creditTransaction.balanceBefore,
        balanceAfter: creditTransaction.balanceAfter,
        description: creditTransaction.description,
        subscriptionId: creditTransaction.subscriptionId,
        sessionId: creditTransaction.sessionId,
        type: creditTransaction.type,
        metadata: creditTransaction.metadata,
        createdOn: creditTransaction.createdOn,
      })
    }

    return c.json({
      success: true,
      scheduleId: scheduledJob?.id,
      message: `${creditTransaction.type === "tribe" ? "Tribe" : "Molt"} schedule ${existingSchedule ? "updated" : "created"} successfully`,
      creditsReserved: creditTransaction.amount,
      scheduledTimes: schedule.length,
      action: existingSchedule ? "UPDATE" : "CREATE",
    })
  } catch (err: any) {
    captureException(err)
    console.error("Create/Update Tribe schedule error:", err)
    return c.json(
      { error: err.message || "Failed to create/update Tribe schedule" },
      500,
    )
  }
})
