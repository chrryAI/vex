import { deleteSubscription, getSubscription } from "@repo/db"
import { NextResponse } from "next/server"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import captureException from "../../../lib/captureException"
import log from "../../actions/log"
import Stripe from "stripe"

export async function DELETE() {
  const member = await getMember()
  const guest = await getGuest()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const subscription = await getSubscription({
      userId: member?.id,
      guestId: guest?.id,
    })

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 },
      )
    }

    if (subscription.provider === "stripe") {
      await stripe.subscriptions.cancel(subscription.subscriptionId)
    }

    await deleteSubscription({
      id: subscription.id,
    })

    console.log("Subscription deleted successfully")

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    log({
      level: "error",
      message: "Error removing subscription",
      object: error,
      userId: member?.id,
      guestId: guest?.id,
    })
    captureException(error)
    console.error("Error removing subscription:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
