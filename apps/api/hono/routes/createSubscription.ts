import { Hono } from "hono"
import Stripe from "stripe"
import { captureException } from "@sentry/node"

export const createSubscription = new Hono()

// POST /createSubscription - Create Stripe checkout session for subscription
createSubscription.post("/", async (c) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  try {
    const {
      customerEmail,
      successUrl,
      cancelUrl,
      userId,
      guestId,
      plan = "plus",
      tier,
      affiliateCode,
    } = (await c.req.json()) ||
    ({} as {
      customerEmail: string
      successUrl: string
      cancelUrl: string
      userId: string
      guestId: string
      plan:
        | "plus"
        | "pro"
        | "credits"
        | "grape"
        | "pear"
        | "coder"
        | "watermelon"
      tier?:
        | "free"
        | "plus"
        | "pro"
        | "coder"
        | "architect"
        | "standard"
        | "sovereign"
      affiliateCode?: string
    })

    // Determine Stripe price ID based on plan and tier
    const getPriceId = () => {
      if (plan === "credits") return process.env.STRIPE_PRICE_CREDITS_ID!
      if (plan === "plus") return process.env.STRIPE_PRICE_PLUS_ID!
      if (plan === "pro") return process.env.STRIPE_PRICE_PRO_ID!

      // Premium plans with tiers
      if (plan === "grape") {
        if (tier === "plus") return process.env.STRIPE_PRICE_GRAPE_PLUS_ID!
        if (tier === "pro") return process.env.STRIPE_PRICE_GRAPE_PRO_ID!
      }
      if (plan === "pear") {
        if (tier === "plus") return process.env.STRIPE_PRICE_PEAR_PLUS_ID!
        if (tier === "pro") return process.env.STRIPE_PRICE_PEAR_PRO_ID!
      }
      if (plan === "coder") {
        if (tier === "coder") return process.env.STRIPE_PRICE_SUSHI_CODER_ID!
        if (tier === "architect")
          return process.env.STRIPE_PRICE_SUSHI_ARCHITECT_ID!
      }
      if (plan === "watermelon") {
        if (tier === "standard")
          return process.env.STRIPE_PRICE_WATERMELON_STANDARD_ID!
        if (tier === "sovereign")
          return process.env.STRIPE_PRICE_WATERMELON_SOVEREIGN_ID!
      }

      // Default to plus if no match
      return process.env.STRIPE_PRICE_PLUS_ID!
    }

    const priceId = getPriceId()

    const session = await stripe.checkout.sessions.create({
      mode: plan === "credits" ? "payment" : "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: customerEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data:
        plan === "credits"
          ? undefined
          : {
              trial_period_days: 5,
            },
      automatic_tax: {
        enabled: true,
      },
      metadata: {
        userId,
        guestId,
        plan,
        ...(tier && { tier }),
        ...(affiliateCode && { affiliateCode }),
      },
    })

    return c.json({
      sessionId: session.id,
      checkoutUrl: session.url,
      userId,
    })
  } catch (err: any) {
    captureException(err)
    console.error("Stripe error:", err)
    return c.json({ error: err.message }, 500)
  }
})
