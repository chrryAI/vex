import { isDevelopment, isE2E } from "@repo/db"
import { Hono } from "hono"
import Stripe from "stripe"
import { captureException } from "../../lib/captureException"
import { getMember } from "../lib/auth"

export const createCreditPurchase = new Hono()

// POST /createCreditPurchase - Create Stripe checkout session for credit purchase
createCreditPurchase.post("/", async (c) => {
  const user = await getMember(c)
  const stripe = new Stripe(
    user?.role === "admin" && !isE2E && !isDevelopment
      ? process.env.STRIPE_SECRET_KEY_TEST!
      : process.env.STRIPE_SECRET_KEY!,
  )

  try {
    const {
      customerEmail,
      successUrl,
      cancelUrl,
      creditAmount,
      userId,
      guestId,
      affiliateCode,
    } = await c.req.json()

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_CREDIT_ID!, // Different from subscription price
          quantity: creditAmount,
        },
      ],
      customer_email: customerEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      automatic_tax: {
        enabled: true,
      },
      metadata: {
        userId,
        guestId,
        plan: "credits",
        ...(affiliateCode && { affiliateCode }),
      },
    })

    return c.json({
      sessionId: session.id,
      checkoutUrl: session.url,
    })
  } catch (err: any) {
    captureException(err)
    console.error("Stripe error:", err)
    return c.json({ error: err.message }, 500)
  }
})
