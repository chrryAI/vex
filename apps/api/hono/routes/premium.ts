import {
  cancelPremiumSubscription,
  createPremiumSubscription,
  getPremiumSubscription,
  hasPremiumAccess,
  logStripeRevenue,
  updatePremiumSubscription,
} from "@repo/db"
import { Hono } from "hono"
import Stripe from "stripe"
import { sendWebPush } from "../../lib/sendWebPush"
import { getMember } from "../lib/auth"

// Type helper for Stripe webhook subscription data
interface StripeSubscriptionWebhook extends Stripe.Subscription {
  current_period_start: number
  current_period_end: number
}

// Type helper for Stripe webhook invoice data
interface StripeInvoiceWebhook extends Stripe.Invoice {
  subscription: string | Stripe.Subscription | null
}

const app = new Hono()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const FRONTEND_URL = process.env.FRONTEND_URL || "https://chrry.ai"

// Price ID mapping
const PRICE_IDS = {
  grape_analytics: {
    public: process.env.STRIPE_GRAPE_PUBLIC_PRICE!,
    private: process.env.STRIPE_GRAPE_PRIVATE_PRICE!,
  },
  pear_feedback: {
    public: process.env.STRIPE_PEAR_PUBLIC_PRICE!,
    private: process.env.STRIPE_PEAR_PRIVATE_PRICE!,
  },
  debugger: {
    shared: process.env.STRIPE_DEBUGGER_SHARED_PRICE!,
    private: process.env.STRIPE_DEBUGGER_PRIVATE_PRICE!,
  },
  white_label: {
    standard: process.env.STRIPE_WHITE_LABEL_PRICE!,
  },
}

// Create checkout session
app.post("/subscribe", async (c) => {
  try {
    const user = await getMember(c)

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const userId = user.id
    const userEmail = user.email

    const { productType, tier, metadata } = await c.req.json()

    // Validate product type and tier
    if (!PRICE_IDS[productType as keyof typeof PRICE_IDS]) {
      return c.json({ error: "Invalid product type" }, 400)
    }

    const priceId =
      PRICE_IDS[productType as keyof typeof PRICE_IDS][
        tier as keyof (typeof PRICE_IDS)[keyof typeof PRICE_IDS]
      ]

    if (!priceId) {
      return c.json({ error: "Invalid tier for product" }, 400)
    }

    // Create Stripe checkout session
    const sessionMetadata = {
      userId,
      productType,
      tier,
      ...metadata,
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer_email: userEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${FRONTEND_URL}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/premium/cancel`,
      metadata: sessionMetadata,
      // 🍷 Propagate metadata to subscription and invoices (performance optimization)
      subscription_data: {
        metadata: sessionMetadata,
      },
    })

    return c.json({ url: checkoutSession.url })
  } catch (error) {
    console.error("Error creating checkout session:", error)
    return c.json({ error: "Failed to create checkout session" }, 500)
  }
})

// Get user's premium subscriptions
app.get("/subscriptions", async (c) => {
  try {
    const user = await getMember(c)
    const userId = user?.id

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const subscriptions = await getPremiumSubscription(userId)

    return c.json({ subscriptions })
  } catch (error) {
    console.error("Error fetching subscriptions:", error)
    return c.json({ error: "Failed to fetch subscriptions" }, 500)
  }
})

// Check premium access
app.get("/access/:productType", async (c) => {
  try {
    const user = await getMember(c)
    const userId = user?.id

    if (!userId) {
      return c.json({ hasAccess: false })
    }

    const productType = c.req.param("productType") as
      | "grape_analytics"
      | "pear_feedback"
      | "white_label"

    const hasAccess = await hasPremiumAccess(userId, productType)

    return c.json({ hasAccess })
  } catch (error) {
    console.error("Error checking premium access:", error)
    return c.json({ hasAccess: false })
  }
})

// Cancel subscription
app.post("/cancel/:subscriptionId", async (c) => {
  try {
    const user = await getMember(c)
    const userId = user?.id

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const stripeSubscriptionId = c.req.param("subscriptionId")

    // Verify ownership
    const subscription = await getPremiumSubscription(userId)
    if (
      !subscription ||
      (Array.isArray(subscription)
        ? !subscription.find(
            (s) => s.stripeSubscriptionId === stripeSubscriptionId,
          )
        : subscription.stripeSubscriptionId !== stripeSubscriptionId)
    ) {
      return c.json({ error: "Subscription not found" }, 404)
    }

    // Cancel in Stripe
    await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    // Update in database
    await updatePremiumSubscription(stripeSubscriptionId, {
      cancelAtPeriodEnd: true,
    })

    return c.json({ success: true })
  } catch (error) {
    console.error("Error canceling subscription:", error)
    return c.json({ error: "Failed to cancel subscription" }, 500)
  }
})

// Stripe webhook handler
app.post("/webhooks/stripe", async (c) => {
  try {
    const sig = c.req.header("stripe-signature")
    const body = await c.req.text()

    if (!sig) {
      return c.json({ error: "No signature" }, 400)
    }

    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )

    console.log(`🎫 Stripe webhook: ${event.type}`)

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const subscription = (await stripe.subscriptions.retrieve(
          session.subscription as string,
        )) as unknown as StripeSubscriptionWebhook

        const metadata = session.metadata!
        const userId = metadata.userId
        const productType = metadata.productType
        const tier = metadata.tier

        if (!userId) {
          return c.json({ error: "Unauthorized" }, 401)
        }

        if (!productType || !tier) {
          return c.json({ error: "Invalid product type or tier" }, 400)
        }

        if (!subscription?.items?.data[0]?.price?.id) {
          return c.json({ error: "Invalid price ID" }, 400)
        }

        if (!subscription?.items?.data[0]?.price?.product) {
          return c.json({ error: "Invalid product ID" }, 400)
        }

        if (!subscription?.customer) {
          return c.json({ error: "Invalid customer ID" }, 400)
        }

        // Create subscription in database
        await createPremiumSubscription({
          userId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription?.items?.data[0]?.price?.id,
          stripeProductId: subscription?.items?.data[0]?.price
            ?.product as string,
          stripeCustomerId: subscription?.customer as string,
          productType: productType as any,
          tier: tier as any,
          status: subscription.status as any,
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000,
          ),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          metadata: {
            appId: metadata.appId,
            storeId: metadata.storeId,
            customDomain: metadata.customDomain,
          },
        })

        console.log(
          `✅ Premium subscription created: ${productType} (${tier}) for user ${userId}`,
        )
        break
      }

      case "customer.subscription.updated": {
        const subscriptionData = event.data.object as StripeSubscriptionWebhook

        await updatePremiumSubscription(subscriptionData.id, {
          status: subscriptionData.status as any,
          currentPeriodStart: new Date(
            subscriptionData.current_period_start * 1000,
          ),
          currentPeriodEnd: new Date(
            subscriptionData.current_period_end * 1000,
          ),
          cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
        })

        console.log(`✅ Premium subscription updated: ${subscriptionData.id}`)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as StripeSubscriptionWebhook

        await cancelPremiumSubscription(subscription.id)

        console.log(`✅ Premium subscription canceled: ${subscription.id}`)
        break
      }

      case "invoice.paid": {
        const invoice = event.data.object as StripeInvoiceWebhook
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id

        if (
          subscriptionId &&
          invoice.amount_paid &&
          invoice.customer &&
          invoice.id
        ) {
          try {
            // 🍷 Performance optimization: Try to get metadata from subscription object first
            // (metadata propagates from checkout session via subscription_data)
            let metadata =
              typeof invoice.subscription !== "string"
                ? invoice.subscription?.metadata
                : undefined

            // Fallback: Retrieve subscription if metadata not available
            if (
              !metadata?.userId ||
              !metadata?.productType ||
              !metadata?.tier
            ) {
              console.log(
                "⚠️ Metadata not found on invoice, retrieving subscription...",
              )
              const subscription =
                await stripe.subscriptions.retrieve(subscriptionId)
              metadata = subscription.metadata
            }

            if (metadata?.userId && metadata?.productType && metadata?.tier) {
              // 🍷 Log revenue to Vault
              const revenueResult = await logStripeRevenue({
                userId: metadata.userId,
                grossAmount: invoice.amount_paid, // Already in cents
                currency: invoice.currency.toUpperCase(),
                productType: metadata.productType as any,
                tier: metadata.tier,
                stripeInvoiceId: invoice.id,
                metadata: {
                  appId: metadata.appId || undefined,
                  storeId: metadata.storeId || undefined,
                  customDomain: metadata.customDomain || undefined,
                },
              })

              console.log(
                `🍷 Revenue logged: ${(invoice.amount_paid / 100).toFixed(2)} ${invoice.currency.toUpperCase()} for ${metadata.productType} (${metadata.tier})`,
              )

              // 🔔 Send "Kasa Doldu!" notification for significant revenue (€50+)
              if (invoice.amount_paid >= 5000) {
                try {
                  const productNames: Record<string, string> = {
                    grape_analytics: "Grape Analytics",
                    pear_feedback: "Pear Feedback",
                    debugger: "Debugger",
                    white_label: "White Label",
                  }

                  const productName =
                    productNames[metadata.productType] || metadata.productType

                  await sendWebPush({
                    c,
                    userId: metadata.userId,
                    payload: {
                      title: "💰 Kasa Doldu!",
                      body: `${productName} (${metadata.tier}): €${(invoice.amount_paid / 100).toFixed(2)} | Net: €${(revenueResult.netRevenue / 100).toFixed(2)}`,
                      icon: "/icon-128.png",
                      data: {
                        url: `${FRONTEND_URL}/vault`,
                      },
                    },
                  })

                  console.log(
                    `🔔 "Kasa Doldu!" notification sent for €${(invoice.amount_paid / 100).toFixed(2)}`,
                  )
                } catch (notifError) {
                  console.error(
                    "❌ Error sending revenue notification:",
                    notifError,
                  )
                  // Don't fail webhook if notification fails
                }
              }
            }
          } catch (error) {
            console.error("❌ Error logging revenue:", error)
            // Don't fail the webhook if revenue logging fails
          }
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as StripeInvoiceWebhook
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id

        if (subscriptionId) {
          await updatePremiumSubscription(subscriptionId, {
            status: "past_due",
          })

          console.log(`⚠️ Payment failed for subscription: ${subscriptionId}`)
        }
        break
      }
    }

    return c.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return c.json({ error: "Webhook handler failed" }, 400)
  }
})

export default app
