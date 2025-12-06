// /api/subscription/change-plan/route.ts
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getUser, updateGuest, updateSubscription, updateUser } from "@repo/db"
import getMember from "../../../actions/getMember"
import getGuest from "../../../actions/getGuest"
import {
  GUEST_CREDITS_PER_MONTH,
  MEMBER_CREDITS_PER_MONTH,
  PLUS_CREDITS_PER_MONTH,
  PRO_CREDITS_PER_MONTH,
} from "@repo/db/src/schema"

export async function POST(request: Request) {
  const { newPlan } = (await request.json()) as {
    newPlan: "plus" | "pro"
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const validTransitions = {
    plus: ["pro"],
    pro: ["plus"],
  }

  try {
    const user = await getMember({ full: true, skipCache: true })
    const guest = !user ? await getGuest({ skipCache: true }) : undefined
    const subscription = user?.subscription || guest?.subscription

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription" },
        { status: 400 },
      )
    }

    if (
      subscription &&
      !validTransitions[subscription.plan]?.includes(newPlan)
    ) {
      return NextResponse.json(
        { error: "Invalid plan transition" },
        { status: 400 },
      )
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
      return NextResponse.json(
        { error: "No subscription items found" },
        { status: 400 },
      )
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
    // Optional: cap total credits to prevent huge inflation
    const newPlanCredits = PLAN_CREDITS[newPlan] + extraCredits

    // Update
    if (user) {
      await updateUser({ ...user, credits: newPlanCredits })
    } else if (guest) {
      await updateGuest({ ...guest, credits: newPlanCredits })
    }

    // Keep their current credits if higher than the new plan
    const newCredits = Math.max(currentCredits, newPlanCredits)

    if (user) {
      await updateUser({ ...user, credits: newCredits })
    } else if (guest) {
      await updateGuest({ ...guest, credits: newCredits })
    }

    return NextResponse.json({
      success: true,
      plan: newPlan,
      prorationAmount: updatedSubscription.latest_invoice,
    })
  } catch (error) {
    console.error("Plan change error:", error)
    return NextResponse.json(
      { error: "Failed to change plan" },
      { status: 500 },
    )
  }
}
