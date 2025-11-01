import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { NextRequest, NextResponse } from "next/server"
import {
  createCalendarEventSchema,
  getCalendarEventsSchema,
} from "chrry/utils/calendarValidation"
import { createCalendarEvent, getCalendarEvents } from "@repo/db"

import superjson from "superjson"
import { notify, notifyOwnerAndCollaborations } from "../../../lib/notify"

export async function GET(request: NextRequest) {
  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Validate query parameters
  const queryParams = Object.fromEntries(request.nextUrl.searchParams)
  const validation = getCalendarEventsSchema.safeParse(queryParams)

  if (!validation.success) {
    const errors = validation.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }))

    return NextResponse.json(
      { error: "Invalid query parameters", errors },
      { status: 400 },
    )
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

  return NextResponse.json({ events })
}

export async function POST(request: NextRequest) {
  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.text()

    const parsed = superjson.parse(body)

    // Validate request body
    const validation = createCalendarEventSchema.safeParse(parsed)

    if (!validation.success) {
      const errors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }))

      return NextResponse.json(
        { error: "Invalid event data", errors },
        { status: 400 },
      )
    }

    const event = await createCalendarEvent({
      ...validation.data,
      userId: member?.id,
      guestId: guest?.id,
    })
    if (!event) {
      return NextResponse.json(
        { error: "Failed to create calendar event" },
        { status: 500 },
      )
    }

    notify(event.userId || event.guestId || "", {
      type: "calendar_event",
      data: {
        event,
      },
    })

    return NextResponse.json(event)
  } catch (error) {
    console.error("Error creating calendar event:", error)
    return NextResponse.json(
      { error: "Failed to create calendar event" },
      { status: 500 },
    )
  }
}
