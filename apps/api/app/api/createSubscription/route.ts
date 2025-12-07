import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { captureException } from "@sentry/nextjs"
import { isE2E } from "chrry/utils"

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  try {
    const {
      customerEmail,
      successUrl,
      cancelUrl,
      userId,
      guestId,
      plan = "plus",
      affiliateCode,
    } = (await request.json()) ||
    ({} as {
      customerEmail: string
      successUrl: string
      cancelUrl: string
      userId: string
      guestId: string
      plan: "plus" | "pro" | "credits"
      affiliateCode?: string
    })

    const session = await stripe.checkout.sessions.create({
      mode: plan === "credits" ? "payment" : "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price:
            plan === "credits"
              ? process.env.STRIPE_PRICE_CREDITS_ID!
              : plan === "plus"
                ? process.env.STRIPE_PRICE_PLUS_ID!
                : process.env.STRIPE_PRICE_PRO_ID!,
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
        enabled: true, // Add this line
      },
      metadata: {
        userId,
        guestId,
        plan,
        ...(affiliateCode && { affiliateCode }),
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      checkoutUrl: session.url,
      userId,
    })
  } catch (err: any) {
    captureException(err)
    console.error("Stripe error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
