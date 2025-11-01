import {
  deleteSubscription,
  getSubscription,
  getAffiliateReferrals,
  updateAffiliateLink,
  getAffiliateLink,
  getAffiliateReferral,
} from "@repo/db"
import { headers } from "next/headers"
import Stripe from "stripe"
import { NextResponse } from "next/server"
import captureException from "../../../lib/captureException"

async function handleStripeWebhook(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const body = await request.text() // Retrieve the raw body
  const sig = (await headers()).get("stripe-signature") as string

  let event: Stripe.Event

  try {
    // Construct the Stripe event with the raw body
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    captureException(err)
    console.error("Webhook signature verification failed:", err)
    return { error: "Webhook signature verification failed" }
  }

  switch (event.type) {
    case "invoice.payment_succeeded":
      // Handle monthly subscription renewals for affiliate commission
      const invoice = event.data.object as Stripe.Invoice

      // Skip if this is the first payment (already handled in verifyPayment)
      if (invoice.billing_reason === "subscription_create") {
        break
      }

      // Only process recurring payments
      if (invoice.billing_reason === "subscription_cycle") {
        try {
          // Extract subscription ID (can be string or object)
          // Use type assertion to access subscription field
          const invoiceWithSub = invoice as any
          const subscriptionId = invoiceWithSub.subscription
            ? typeof invoiceWithSub.subscription === "string"
              ? invoiceWithSub.subscription
              : invoiceWithSub.subscription.id
            : null

          if (!subscriptionId) {
            console.log("⚠️ No subscription ID in invoice")
            break
          }

          // Find our subscription record
          const subscription = await getSubscription({
            subscriptionId: subscriptionId,
          })

          if (!subscription) {
            console.log("⚠️ Subscription not found:", subscriptionId)
            break
          }

          // Check if this subscription came from an affiliate
          const referral = await getAffiliateReferral({
            affiliateLinkId: subscription.id,
          })

          if (!referral) {
            break
          }

          // Get affiliate link
          const affiliateLink = await getAffiliateLink({
            id: referral.affiliateLinkId,
          })

          if (!affiliateLink || affiliateLink.status !== "active") {
            console.log("⚠️ Affiliate link not active")
            break
          }

          // Calculate monthly commission
          const monthlyPrice = invoice.amount_paid // in cents
          const monthlyCommission = Math.floor(
            monthlyPrice * (affiliateLink.commissionRate / 100),
          )

          // Update affiliate stats
          await updateAffiliateLink({
            ...affiliateLink,
            totalRevenue: affiliateLink.totalRevenue + monthlyPrice,
            commissionEarned:
              affiliateLink.commissionEarned + monthlyCommission,
            updatedOn: new Date(),
          })

          console.log("💰 Monthly commission added:", {
            affiliateId: affiliateLink.id,
            subscriptionId: subscription.id,
            monthlyCommission: monthlyCommission / 100,
            totalEarned:
              (affiliateLink.commissionEarned + monthlyCommission) / 100,
          })
        } catch (error) {
          console.error("❌ Error processing affiliate renewal:", error)
          captureException(error)
        }
      }
      break

    case "customer.subscription.deleted":
      const dbSubscription = await getSubscription({
        subscriptionId: event.data.object.id,
      })

      if (!dbSubscription) {
        return { error: "Subscription not found" }
      }

      try {
        dbSubscription && (await deleteSubscription({ id: dbSubscription.id }))
        console.log("🔴 Subscription cancelled:", {
          subscriptionId: event.data.object.id,
          note: "Future affiliate commission payments will stop automatically",
        })
      } catch (error) {
        console.log(`Error while removing subscription`, {
          error,
          dbSubscription,
        })
      }
      break
  }

  return { received: true }
}

export async function POST(request: Request) {
  const result = await handleStripeWebhook(request)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ received: true })
}
