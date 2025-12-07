import { NextRequest, NextResponse } from "next/server"
import getMember from "../../../actions/getMember"
import { getAccount } from "@repo/db"

export async function GET(request: NextRequest) {
  const member = await getMember()

  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has Google account linked
    const account = await getAccount({
      userId: member.id,
      provider: "google",
    })

    if (!account) {
      return NextResponse.json({
        connected: false,
        hasCalendarScope: false,
        hasRefreshToken: false,
      })
    }

    // Check if account has calendar scope
    const hasCalendarScope = account.scope
      ?.split(/\s+/)
      .includes("https://www.googleapis.com/auth/calendar")

    return NextResponse.json({
      connected: true,
      hasCalendarScope: hasCalendarScope || false,
      hasRefreshToken: !!account.refresh_token,
      hasAccessToken: !!account.access_token,
      expiresAt: account.expires_at,
    })
  } catch (error) {
    console.error("Error checking Google Calendar status:", error)
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 },
    )
  }
}
