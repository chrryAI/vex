import { NextRequest, NextResponse } from "next/server"
import {
  getAffiliateLink,
  createAffiliateLink,
  getAffiliateReferrals,
  getAffiliatePayouts,
} from "@repo/db"
import getMember from "../../actions/getMember"
import { CHRRY_URL, FRONTEND_URL } from "chrry/utils"

// GET - Get affiliate stats for current user
export async function GET(request: NextRequest) {
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
      return NextResponse.json({
        hasAffiliateLink: false,
        message: "No affiliate link found. Create one first.",
      })
    }

    // Get referrals for this affiliate link
    const referrals = await getAffiliateReferrals({
      affiliateLinkId: affiliateLink.id,
    })

    // Calculate stats
    const pendingReferrals = await getAffiliateReferrals({
      affiliateLinkId: affiliateLink.id,
      pageSize: 1,
      status: "pending",
    })
    const convertedReferrals = await getAffiliateReferrals({
      affiliateLinkId: affiliateLink.id,
      pageSize: 1,
      status: "converted",
    })
    const paidReferrals = await getAffiliateReferrals({
      affiliateLinkId: affiliateLink.id,
      pageSize: 1,
      status: "paid",
    })

    // Get payout requests
    const payouts = await getAffiliatePayouts({
      affiliateLinkId: affiliateLink.id,
      status: ["pending", "processing"],
      page: 1,
      pageSize: 1,
    })

    // Check for pending payout request
    const pendingPayout = payouts.result[0]

    return NextResponse.json({
      hasAffiliateLink: true,
      code: affiliateLink.code,
      affiliateLink: `${FRONTEND_URL}?ref=${affiliateLink.code}`,
      stats: {
        clicks: affiliateLink.clicks,
        conversions: affiliateLink.conversions,
        totalRevenue: affiliateLink.totalRevenue,
        commissionEarned: affiliateLink.commissionEarned,
        commissionPaid: affiliateLink.commissionPaid,
        commissionPending:
          affiliateLink.commissionEarned - affiliateLink.commissionPaid,
        commissionRate: affiliateLink.commissionRate,
        status: affiliateLink.status,
      },
      referrals: {
        total: referrals.totalCount,
        pending: pendingReferrals.totalCount,
        converted: convertedReferrals.totalCount,
        paid: paidReferrals.totalCount,
      },
      pendingPayout: pendingPayout
        ? {
            id: pendingPayout.id,
            amount: pendingPayout.amount,
            status: pendingPayout.status,
            requestedOn: pendingPayout.requestedOn,
          }
        : null,
      createdOn: affiliateLink.createdOn,
    })
  } catch (error) {
    console.error("❌ Error fetching affiliate stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch affiliate stats" },
      { status: 500 },
    )
  }
}

// POST - Create or get affiliate link
export async function POST(request: NextRequest) {
  try {
    const member = await getMember()

    if (!member) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user already has an affiliate link
    const existing = await getAffiliateLink({
      userId: member.id,
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Affiliate link already exists",
        affiliateLink: `${CHRRY_URL}?ref=${existing.code}`,
        code: existing.code,
        stats: {
          clicks: existing.clicks,
          conversions: existing.conversions,
          commissionEarned: existing.commissionEarned,
        },
      })
    }

    // Generate unique affiliate code
    const code = generateAffiliateCode(member.name || member.userName)

    // Create new affiliate link
    const newLink = await createAffiliateLink({
      userId: member.id,
      code: code,
    })

    console.log("✅ Affiliate link created:", {
      userId: member.id,
      code: code,
    })

    return NextResponse.json({
      success: true,
      message: "Affiliate link created successfully",
      affiliateLink: `${CHRRY_URL}?ref=${code}`,
      code: code,
      stats: {
        clicks: 0,
        conversions: 0,
        commissionEarned: 0,
      },
    })
  } catch (error) {
    console.error("❌ Error creating affiliate link:", error)
    return NextResponse.json(
      { error: "Failed to create affiliate link" },
      { status: 500 },
    )
  }
}

// Helper function to generate unique affiliate code
function generateAffiliateCode(name: string): string {
  // Create readable code from name + random string
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 8)

  const random = Math.random().toString(36).substring(2, 8)

  return `${cleanName}${random}`
}
