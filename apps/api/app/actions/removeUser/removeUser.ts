"use server"

import Stripe from "stripe"
import getMember from "../getMember"
import { deleteUser } from "@repo/db"

export default async function removeUser() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const member = await getMember()

  if (!member) {
    return {
      error: "Something went wrong, member not found.",
    }
  }

  const stripeSubscriptionId =
    member.subscription?.provider === "stripe"
      ? member.subscription.subscriptionId
      : null

  try {
    if (stripeSubscriptionId) {
      await stripe.subscriptions.cancel(stripeSubscriptionId)
    }
    await deleteUser(member.id)
    return {
      success: true,
    }
  } catch {
    return {
      error: "Something went wrong",
    }
  }
}
