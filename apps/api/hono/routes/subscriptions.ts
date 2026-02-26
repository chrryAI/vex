import {
  createSystemLog,
  deleteSubscription,
  getSubscription,
  isDevelopment,
  isE2E,
  updateGuest,
  updateSubscription,
  updateUser,
} from "@repo/db"
import {
  PLUS_CREDITS_PER_MONTH,
  PRO_CREDITS_PER_MONTH,
} from "@repo/db/src/schema"
import { Hono } from "hono"
import Stripe from "stripe"
import { captureException } from "../../lib/captureException"
import { getGuest, getMember } from "../lib/auth"

export const subscriptions = new Hono()

// DELETE /subscriptions - Cancel and delete subscription
subscriptions.delete("/", async (c) => {
  const member = await getMember(c)
  const guest = await getGuest(c)
  const stripe = new Stripe(
    member?.role === "admin"
      ? process.env.STRIPE_SECRET_KEY_TEST!
      : process.env.STRIPE_SECRET_KEY!,
  )
  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const subscription = await getSubscription({
      userId: member?.id,
      guestId: guest?.id,
    })

    if (!subscription) {
      return c.json({ error: "Subscription not found" }, 404)
    }

    if (subscription.provider === "stripe") {
      await stripe.subscriptions.cancel(subscription.subscriptionId)
    }

    await deleteSubscription({
      id: subscription.id,
    })

    console.log("Subscription deleted successfully")

    return c.json({
      success: true,
    })
  } catch (error) {
    createSystemLog({
      level: "error",
      message: "Error removing subscription",
      object: error,
      userId: member?.id,
      guestId: guest?.id,
    })
    captureException(error)
    console.error("Error removing subscription:", error)
    return c.json({ error: "Server error" }, 500)
  }
})

// POST /subscriptions/changePlan - Change subscription plan
subscriptions.post("/changePlan", async (c) => {
  const { newPlan } = (await c.req.json()) as {
    newPlan: "plus" | "pro"
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const validTransitions = {
    plus: ["pro"],
    pro: ["plus"],
  }

  try {
    const user = await getMember(c, { full: true, skipCache: true })
    const guest = !user ? await getGuest(c, { skipCache: true }) : undefined
    const subscription = user?.subscription || guest?.subscription

    if (!subscription) {
      return c.json({ error: "No active subscription" }, 400)
    }

    if (
      subscription &&
      !validTransitions[subscription.plan]?.includes(newPlan)
    ) {
      return c.json({ error: "Invalid plan transition" }, 400)
    }

    // Get the new price ID based on plan
    const newPriceId =
      newPlan === "plus"
        ? process.env.STRIPE_PRICE_PLUS_ID!
        : process.env.STRIPE_PRICE_PRO_ID!

    // Retrieve the Stripe subscription to get subscription items
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.subscriptionId,
      { expand: ["items"] },
    )

    if (!stripeSubscription.items.data[0]) {
      return c.json({ error: "No subscription items found" }, 400)
    }

    // Update the subscription
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.subscriptionId,
      {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: "create_prorations",
      },
    )

    // Update in your database
    await updateSubscription({
      ...subscription,
      plan: newPlan,
    })

    const PLAN_CREDITS = {
      plus: PLUS_CREDITS_PER_MONTH, // 2000
      pro: PRO_CREDITS_PER_MONTH, // 3000
    }

    const currentCredits = user?.credits ?? guest?.credits ?? 0

    // Determine base credits from old plan
    const oldPlanCredits =
      subscription.plan in PLAN_CREDITS ? PLAN_CREDITS[subscription.plan] : 0

    // Extra credits purchased above the old plan
    const extraCredits = Math.max(currentCredits - oldPlanCredits, 0)

    // New credits = new plan credits + extra credits
    const newPlanCredits = PLAN_CREDITS[newPlan] + extraCredits

    // Keep their current credits if higher than the new plan
    const newCredits = Math.max(currentCredits, newPlanCredits)

    if (user) {
      await updateUser({ ...user, credits: newCredits })
    } else if (guest) {
      await updateGuest({ ...guest, credits: newCredits })
    }

    return c.json({
      success: true,
      plan: newPlan,
      prorationAmount: updatedSubscription.latest_invoice,
    })
  } catch (error) {
    console.error("Plan change error:", error)
    return c.json({ error: "Failed to change plan" }, 500)
  }
})
