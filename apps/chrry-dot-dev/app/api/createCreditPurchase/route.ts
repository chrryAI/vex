import { NextResponse } from "next/server"
import Stripe from "stripe"

import captureException from "../../../lib/captureException"

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  try {
    const {
      customerEmail,
      successUrl,
      cancelUrl,
      creditAmount,
      userId,
      guestId,
      affiliateCode,
    } = await request.json()

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
        enabled: true, // Add this line
      },
      metadata: {
        userId,
        guestId,
        plan: "credits",
        ...(affiliateCode && { affiliateCode }),
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      checkoutUrl: session.url,
    })
  } catch (err: any) {
    captureException(err)
    console.error("Stripe error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
