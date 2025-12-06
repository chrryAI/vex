import { NextRequest, NextResponse } from "next/server"
import getMember from "../../../actions/getMember"
import { google } from "googleapis"
import {
  createCalendarEvent,
  updateCalendarEvent,
  getCalendarEvents,
  db,
  getAccount,
  updateAccount,
} from "@repo/db"
import { eq } from "drizzle-orm"

// Get Google OAuth tokens for user
async function getGoogleTokens(userId: string) {
  const account = await getAccount({
    userId,
    provider: "google",
  })

  if (!account) {
    return null
  }

  return {
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expires_at: account.expires_at,
  }
}

// Refresh Google access token if expired
async function refreshGoogleToken(userId: string, refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_SECRET,
  )

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  })

  const { credentials } = await oauth2Client.refreshAccessToken()

  if (
    !credentials.access_token ||
    !credentials.refresh_token ||
    !credentials.expiry_date
  ) {
    return null
  }

  const account = await getAccount({
    userId,
    provider: "google",
  })

  if (!account) {
    return null
  }

  await updateAccount({
    ...account,
    access_token: credentials.access_token,
    expires_at: credentials.expiry_date
      ? Math.floor(credentials.expiry_date / 1000)
      : null,
  })

  return credentials.access_token
}

// Get valid Google access token (refresh if needed)
async function getValidGoogleToken(userId: string) {
  const tokens = await getGoogleTokens(userId)
  if (!tokens) return null

  const now = Math.floor(Date.now() / 1000)

  // Token expired or about to expire (within 5 minutes)
  if (tokens.expires_at && tokens.expires_at < now + 300) {
    if (!tokens.refresh_token) {
      return null
    }
    return await refreshGoogleToken(userId, tokens.refresh_token)
  }

  return tokens.access_token
}

// Import events from Google Calendar
export async function POST(request: NextRequest) {
  const member = await getMember()

  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const accessToken = await getValidGoogleToken(member.id)
    if (!accessToken) {
      return NextResponse.json(
        { error: "Google Calendar not connected" },
        { status: 400 },
      )
    }

    // Initialize Google Calendar API
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })
    const calendar = google.calendar({ version: "v3", auth: oauth2Client })

    // Get events from Google Calendar (next 30 days)
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(now.getDate() + 30)

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: thirtyDaysFromNow.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    })

    const googleEvents = response.data.items || []

    // Get existing Vex events to check for duplicates
    const existingEvents = await getCalendarEvents({
      userId: member.id,
      startTime: now,
      endTime: thirtyDaysFromNow,
    })

    const existingExternalIds = new Set(
      existingEvents
        .filter((e) => e.externalId)
        .map((e) => e.externalId as string),
    )

    // Import new events
    let importedCount = 0
    for (const googleEvent of googleEvents) {
      // Skip if already imported
      if (existingExternalIds.has(googleEvent.id!)) {
        continue
      }

      // Parse event times
      const start = googleEvent.start?.dateTime || googleEvent.start?.date
      const end = googleEvent.end?.dateTime || googleEvent.end?.date
      if (!start || !end) continue

      await createCalendarEvent({
        userId: member.id,
        title: googleEvent.summary || "Untitled Event",
        description: googleEvent.description || undefined,
        location: googleEvent.location || undefined,
        startTime: new Date(start),
        endTime: new Date(end),
        isAllDay: !!googleEvent.start?.date, // All-day if date (not dateTime)
        timezone: googleEvent.start?.timeZone || "UTC",
        color: "blue", // Default color
        status: "confirmed",
        visibility: "private",
        externalId: googleEvent.id!,
        externalSource: "google",
        lastSyncedAt: new Date(),
        attendees: [],
        reminders: [],
        isRecurring: false,
      })

      importedCount++
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      total: googleEvents.length,
    })
  } catch (error) {
    console.error("Error syncing Google Calendar:", error)
    return NextResponse.json(
      { error: "Failed to sync with Google Calendar" },
      { status: 500 },
    )
  }
}

// Export Vex event to Google Calendar
export async function PUT(request: NextRequest) {
  const member = await getMember()

  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { eventId } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 })
    }

    const accessToken = await getValidGoogleToken(member.id)
    if (!accessToken) {
      return NextResponse.json(
        { error: "Google Calendar not connected" },
        { status: 400 },
      )
    }

    // Get Vex event
    const vexEvents = await getCalendarEvents({
      id: eventId,
      userId: member.id,
    })

    if (!vexEvents || vexEvents.length === 0) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const vexEvent = vexEvents[0]

    if (!vexEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Initialize Google Calendar API
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })
    const calendar = google.calendar({ version: "v3", auth: oauth2Client })

    // Create event in Google Calendar
    const googleEvent = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: vexEvent.title,
        description: vexEvent.description || undefined,
        location: vexEvent.location || undefined,
        start: vexEvent.isAllDay
          ? { date: vexEvent.startTime.toISOString().split("T")[0] }
          : {
              dateTime: vexEvent.startTime.toISOString(),
              timeZone: vexEvent.timezone || "UTC",
            },
        end: vexEvent.isAllDay
          ? { date: vexEvent.endTime.toISOString().split("T")[0] }
          : {
              dateTime: vexEvent.endTime.toISOString(),
              timeZone: vexEvent.timezone || "UTC",
            },
      },
    })

    // Update Vex event with Google ID
    await updateCalendarEvent({
      ...vexEvent,
      externalId: googleEvent.data.id!,
      externalSource: "google",
      lastSyncedAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      googleEventId: googleEvent.data.id,
    })
  } catch (error) {
    console.error("Error exporting to Google Calendar:", error)
    return NextResponse.json(
      { error: "Failed to export to Google Calendar" },
      { status: 500 },
    )
  }
}
