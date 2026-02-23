import { Hono } from "hono"
import Stripe from "stripe"
import { captureException } from "../../lib/captureException"
import { getMember } from "../lib/auth"

export const createSubscription = new Hono()

// POST /createSubscription - Create Stripe checkout session for subscription
createSubscription.post("/", async (c) => {
  const member = await getMember(c)

  const stripe = new Stripe(
    member?.role === "admin"
      ? process.env.STRIPE_SECRET_KEY_TEST!
      : process.env.STRIPE_SECRET_KEY!,
  )
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
      scheduledTaskId,
      customPrice, // For Tribe/Molt dynamic pricing (in EUR)
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
        | "molt"
        | "tribe"
      tier?:
        | "free"
        | "plus"
        | "pro"
        | "coder"
        | "architect"
        | "standard"
        | "sovereign"
      affiliateCode?: string
      customPrice?: number
    })

    const isCredits = ["credits", "molt", "tribe"].includes(plan)

    // Minimum price validation for custom pricing (Stripe minimum is €0.50, but we set €5 for safety)
    const MINIMUM_PRICE_EUR = 0
    if (customPrice !== undefined && customPrice < MINIMUM_PRICE_EUR) {
      const shortfall = MINIMUM_PRICE_EUR - customPrice
      return c.json(
        {
          error: `Minimum payment is €${MINIMUM_PRICE_EUR}. Please add €${shortfall.toFixed(2)} more to your configuration.`,
          minimumRequired: MINIMUM_PRICE_EUR,
          currentAmount: customPrice,
          shortfall,
        },
        400,
      )
    }

    // Determine Stripe price ID based on plan and tier
    const getPriceId = () => {
      if (plan === "molt")
        return member?.role === "admin"
          ? process.env.STRIPE_MOLT_TEST!
          : process.env.STRIPE_MOLT!
      if (plan === "tribe")
        return member?.role === "admin"
          ? process.env.STRIPE_TRIBE_TEST!
          : process.env.STRIPE_TRIBE!
      if (plan === "credits")
        return member?.role === "admin"
          ? process.env.STRIPE_PRICE_CREDITS_TEST!
          : process.env.STRIPE_PRICE_CREDITS_ID!
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

    // Build line items - use price_data for custom pricing, price ID otherwise
    const lineItems =
      customPrice !== undefined
        ? [
            {
              price_data: {
                currency: "eur",
                product_data: {
                  name:
                    plan === "tribe"
                      ? "Tribe Scheduled Posts"
                      : plan === "molt"
                        ? "Molt Credits"
                        : "Credits",
                  description:
                    plan === "tribe"
                      ? "Automated social media posting schedule"
                      : "AI credits for your account",
                },
                unit_amount: Math.round(customPrice * 100), // Convert EUR to cents
              },
              quantity: 1,
            },
          ]
        : [
            {
              price: priceId,
              quantity: 1,
            },
          ]

    const session = await stripe.checkout.sessions.create({
      mode: isCredits ? "payment" : "subscription",
      payment_method_types: ["card"],
      line_items: lineItems,
      customer_email: customerEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: isCredits
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
        scheduledTaskId,
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
