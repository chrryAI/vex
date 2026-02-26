import {
  deleteSubscription,
  getAffiliateLink,
  getAffiliateReferral,
  getSubscription,
  updateAffiliateLink,
} from "@repo/db"
import { Hono } from "hono"
import Stripe from "stripe"
import { captureException } from "../../lib/captureException"

export const stripeWebhook = new Hono()

// POST /stripeWebhook - Handle Stripe webhooks
stripeWebhook.post("/", async (c) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const signature = c.req.header("stripe-signature")
  const body = await c.req.text()

  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400)
  }

  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    captureException(err)
    console.error("Webhook signature verification failed:", err)
    return c.json({ error: "Webhook signature verification failed" }, 400)
  }

  switch (event.type) {
    case "invoice.payment_succeeded": {
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
    }

    case "customer.subscription.deleted": {
      const dbSubscription = await getSubscription({
        subscriptionId: event.data.object.id,
      })

      if (!dbSubscription) {
        return c.json({ error: "Subscription not found" }, 404)
      }

      try {
        await deleteSubscription({ id: dbSubscription.id })
        console.log("🔴 Subscription cancelled:", {
          subscriptionId: event.data.object.id,
          note: "Future affiliate commission payments will stop automatically",
        })
      } catch (error) {
        console.log(`Error while removing subscription`, {
          error,
          dbSubscription,
        })
        captureException(error)
      }
      break
    }
  }

  return c.json({ received: true })
})
