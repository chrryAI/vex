import { NextRequest, NextResponse } from "next/server"
import {
  getAffiliateLink,
  createAffiliatePayout,
  getAffiliatePayouts,
} from "@repo/db"
import getMember from "../../../actions/getMember"

// POST - Request payout
export async function POST(request: NextRequest) {
  try {
    const member = await getMember()

    if (!member) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's affiliate link
    const affiliateLink = await getAffiliateLink({
      userId: member.id,
    })

    if (!affiliateLink) {
      return NextResponse.json(
        { error: "No affiliate link found" },
        { status: 404 },
      )
    }

    // Calculate pending commission
    const pending =
      affiliateLink.commissionEarned - affiliateLink.commissionPaid

    // Check minimum payout (€50 = 5000 cents)
    if (pending < 5000) {
      return NextResponse.json(
        {
          error: "Minimum payout is €50",
          pending: pending / 100,
          minimum: 50,
        },
        { status: 400 },
      )
    }

    // Check for existing pending payout request
    const existingPayouts = await getAffiliatePayouts({
      affiliateLinkId: affiliateLink.id,
      status: ["pending", "processing"],
      page: 1,
      pageSize: 1,
    })

    const hasPendingPayout = existingPayouts.result[0]

    if (hasPendingPayout) {
      return NextResponse.json(
        {
          error: "You already have a pending payout request",
          message: "Please wait for your current payout to be processed",
        },
        { status: 400 },
      )
    }

    // Create payout request
    const payout = await createAffiliatePayout({
      affiliateLinkId: affiliateLink.id,
      userId: member.id,
      amount: pending,
      status: "pending",
      requestedOn: new Date(),
      notes: "Payout requested by user",
    })

    if (!payout) {
      return NextResponse.json(
        { error: "Failed to create payout request" },
        { status: 500 },
      )
    }

    // TODO: Send notification to admin
    // TODO: Process payment via Stripe Connect or PayPal
    // For now, mark as pending for manual processing

    console.log("💰 Payout requested:", {
      affiliateId: affiliateLink.id,
      amount: pending / 100,
      payoutId: payout.id,
    })

    return NextResponse.json({
      success: true,
      message: "Payout request submitted",
      payout: {
        id: payout.id,
        amount: pending / 100,
        status: "pending",
        requestedOn: payout.requestedOn,
      },
    })
  } catch (error) {
    console.error("❌ Error requesting payout:", error)
    return NextResponse.json(
      { error: "Failed to request payout" },
      { status: 500 },
    )
  }
}
