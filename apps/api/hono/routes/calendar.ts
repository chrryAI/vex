import { Hono } from "hono"
import { getMember, getGuest } from "../lib/auth"
import {
  createCalendarEventSchema,
  getCalendarEventsSchema,
  updateCalendarEventSchema,
} from "chrry/utils/calendarValidation"
import {
  createCalendarEvent,
  getCalendarEvents,
  getCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getAccount,
  updateAccount,
} from "@repo/db"
import superjson from "superjson"
import { notify } from "../../lib/notify"
import { google } from "googleapis"

export const calendar = new Hono()

// GET /calendar - Get calendar events
calendar.get("/", async (c) => {
  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  // Validate query parameters
  const queryParams = Object.fromEntries(new URL(c.req.url).searchParams)
  const validation = getCalendarEventsSchema.safeParse(queryParams)

  if (!validation.success) {
    const errors = validation.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }))

    return c.json({ error: "Invalid query parameters", errors }, 400)
  }

  const { startDate, endDate } = validation.data
  const startTime = startDate ? new Date(startDate) : undefined
  const endTime = endDate ? new Date(endDate) : undefined

  const now = new Date()
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )

  todayUTC.setHours(0, 0, 0, 0)

  const thisMonthUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth()),
  )

  const events = await getCalendarEvents({
    userId: member?.id,
    guestId: guest?.id,
    startTime: startTime || todayUTC,
    endTime:
      endTime ||
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)), // End of current month
  })

  return c.json({ events })
})

// POST /calendar - Create calendar event
calendar.post("/", async (c) => {
  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.text()
    const parsed = superjson.parse(body)

    // Validate request body
    const validation = createCalendarEventSchema.safeParse(parsed)

    if (!validation.success) {
      const errors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }))

      return c.json({ error: "Invalid event data", errors }, 400)
    }

    const event = await createCalendarEvent({
      ...validation.data,
      userId: member?.id,
      guestId: guest?.id,
    })

    if (!event) {
      return c.json({ error: "Failed to create calendar event" }, 500)
    }

    notify(event.userId || event.guestId || "", {
      type: "calendar_event",
      data: {
        event,
      },
    })

    return c.json(event)
  } catch (error) {
    console.error("Error creating calendar event:", error)
    return c.json({ error: "Failed to create calendar event" }, 500)
  }
})

// GET /calendar/status - Check Google Calendar connection status
calendar.get("/status", async (c) => {
  const member = await getMember(c)

  if (!member) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    // Check if user has Google account linked
    const account = await getAccount({
      userId: member.id,
      provider: "google",
    })

    if (!account) {
      return c.json({
        connected: false,
        hasCalendarScope: false,
        hasRefreshToken: false,
      })
    }

    // Check if account has calendar scope
    const authorizedCalendarScope = "https://www.googleapis.com/auth/calendar"
    const hasCalendarScope =
      !!account.scope &&
      account.scope
        .split(/\s+/)
        .map((scope) => scope.trim())
        .some((scope) => scope === authorizedCalendarScope)

    return c.json({
      connected: true,
      hasCalendarScope: hasCalendarScope || false,
      hasRefreshToken: !!account.refresh_token,
      hasAccessToken: !!account.access_token,
      expiresAt: account.expires_at,
    })
  } catch (error) {
    console.error("Error checking Google Calendar status:", error)
    return c.json({ error: "Failed to check connection status" }, 500)
  }
})

// Helper functions for Google Calendar sync
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

// POST /calendar/googleSync - Import events from Google Calendar
calendar.post("/googleSync", async (c) => {
  const member = await getMember(c)

  if (!member) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const accessToken = await getValidGoogleToken(member.id)
    if (!accessToken) {
      return c.json({ error: "Google Calendar not connected" }, 400)
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

    return c.json({
      success: true,
      imported: importedCount,
      total: googleEvents.length,
    })
  } catch (error) {
    console.error("Error syncing Google Calendar:", error)
    return c.json({ error: "Failed to sync with Google Calendar" }, 500)
  }
})

// PUT /calendar/googleSync - Export Vex event to Google Calendar
calendar.put("/googleSync", async (c) => {
  const member = await getMember(c)

  if (!member) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const { eventId } = await c.req.json()

    if (!eventId) {
      return c.json({ error: "Event ID required" }, 400)
    }

    const accessToken = await getValidGoogleToken(member.id)
    if (!accessToken) {
      return c.json({ error: "Google Calendar not connected" }, 400)
    }

    // Get Vex event
    const vexEvents = await getCalendarEvents({
      id: eventId,
      userId: member.id,
    })

    if (!vexEvents || vexEvents.length === 0) {
      return c.json({ error: "Event not found" }, 404)
    }

    const vexEvent = vexEvents[0]

    if (!vexEvent) {
      return c.json({ error: "Event not found" }, 404)
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

    return c.json({
      success: true,
      googleEventId: googleEvent.data.id,
    })
  } catch (error) {
    console.error("Error exporting to Google Calendar:", error)
    return c.json({ error: "Failed to export to Google Calendar" }, 500)
  }
})

// GET /calendar/:id - Get single calendar event
calendar.get("/:id", async (c) => {
  const id = c.req.param("id")
  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const calendarEvent = await getCalendarEvent({
    id,
    userId: member?.id,
    guestId: guest?.id,
  })

  if (!calendarEvent) {
    return c.json({ error: "Event not found" }, 404)
  }

  return c.json(calendarEvent)
})

// PATCH /calendar/:id - Update calendar event
calendar.patch("/:id", async (c) => {
  const id = c.req.param("id")
  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const calendarEvent = await getCalendarEvents({
    id,
    userId: member?.id,
    guestId: guest?.id,
  })

  if (!calendarEvent) {
    return c.json({ error: "Event not found" }, 404)
  }

  try {
    const body = await c.req.text()
    const parsed = superjson.parse(body)

    // Validate request body
    const validation = updateCalendarEventSchema.safeParse(parsed)

    if (!validation.success) {
      console.error("Validation error:", validation.error.issues)

      // Format validation errors for client
      const errors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }))

      return c.json(
        {
          error: "Invalid update data",
          errors: errors,
        },
        400,
      )
    }

    // First get the existing event to merge with updates
    const existingEvent = await getCalendarEvent({
      id,
      userId: member?.id,
      guestId: guest?.id,
    })

    if (!existingEvent) {
      return c.json({ error: "Event not found" }, 404)
    }

    // Verify ownership
    if (
      existingEvent.userId !== member?.id &&
      existingEvent.guestId !== guest?.id
    ) {
      return c.json({ error: "Unauthorized to update this event" }, 403)
    }

    const event = await updateCalendarEvent({
      ...existingEvent,
      ...validation.data,
      updatedOn: new Date(), // Ensure updatedOn is set
    })

    return c.json(event)
  } catch (error) {
    console.error("Error updating calendar event:", error)
    return c.json({ error: "Failed to update calendar event" }, 500)
  }
})

// DELETE /calendar/:id - Delete calendar event
calendar.delete("/:id", async (c) => {
  const id = c.req.param("id")
  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const calendarEvent = await getCalendarEvents({
    id,
    userId: member?.id,
    guestId: guest?.id,
  })

  if (!calendarEvent) {
    return c.json({ error: "Event not found" }, 404)
  }

  try {
    const event = await deleteCalendarEvent({ id })

    return c.json(event)
  } catch (error) {
    console.error("Error deleting calendar event:", error)
    return c.json({ error: "Failed to delete calendar event" }, 500)
  }
})
