import { NextRequest, NextResponse } from "next/server"
import {
  getAffiliateLink,
  updateAffiliateLink,
  createAffiliateClick,
  getAffiliateClick,
} from "@repo/db"
import getMember from "../../../actions/getMember/getMember"
import getGuest from "../../../actions/getGuest/getGuest"
import { getIp } from "../../../../lib"

export async function POST(request: NextRequest) {
  try {
    const member = await getMember()
    const guest = !member ? await getGuest() : null

    if (!member && !guest) {
      return NextResponse.json(
        { error: "No member or guest found" },
        { status: 400 },
      )
    }

    const { code } = await request.json()

    if (!code) {
      console.log("❌ Missing affiliate code")
      return NextResponse.json(
        { error: "Affiliate code is required" },
        { status: 400 },
      )
    }

    // Get affiliate link by code
    const affiliateLink = await getAffiliateLink({ code })

    if (!affiliateLink) {
      console.log("❌ Affiliate link not found:", code)
      return NextResponse.json(
        { error: "Affiliate link not found" },
        { status: 404 },
      )
    }

    // Check if link is active
    if (affiliateLink.status !== "active") {
      console.log("❌ Affiliate link is inactive:", code)
      return NextResponse.json(
        { error: "Affiliate link is inactive" },
        { status: 400 },
      )
    }

    // Check if user/guest already clicked this link
    const existingClick = await getAffiliateClick({
      affiliateLinkId: affiliateLink.id,
      userId: member?.id,
      guestId: guest?.id,
    })

    if (existingClick) {
      console.log("ℹ️ User/guest already clicked this link:", {
        code,
        userId: member?.id,
        guestId: guest?.id,
      })
      return NextResponse.json({
        success: true,
        message: "Click already tracked",
        alreadyTracked: true,
      })
    }

    // Get request metadata
    // Only track IP for guests (privacy: members have userId)
    const ipAddress = guest ? getIp(request) : null
    const userAgent = request.headers.get("user-agent")
    const referrer = request.headers.get("referer")

    // Create click record
    await createAffiliateClick({
      affiliateLinkId: affiliateLink.id,
      userId: member?.id,
      guestId: guest?.id,
      ipAddress,
      userAgent,
      referrer,
    })

    // Increment click count on affiliate link
    await updateAffiliateLink({
      ...affiliateLink,
      clicks: affiliateLink.clicks + 1,
      updatedOn: new Date(),
    })

    console.log("✅ Affiliate click tracked:", {
      code,
      userId: member?.id,
      guestId: guest?.id,
      clicks: affiliateLink.clicks + 1,
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("❌ Error tracking affiliate click:", error)
    return NextResponse.json(
      { error: "Failed to track click" },
      { status: 500 },
    )
  }
}
