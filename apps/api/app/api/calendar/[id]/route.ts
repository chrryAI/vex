import { NextRequest, NextResponse } from "next/server"
import getMember from "../../../actions/getMember"
import getGuest from "../../../actions/getGuest"
import {
  deleteCalendarEvent,
  getCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
} from "@repo/db"
import { updateCalendarEventSchema } from "chrry/utils/calendarValidation"
import superjson from "superjson"

export async function DELETE(request: NextRequest) {
  const id = request.url.split("/").pop()
  if (!id) {
    return NextResponse.json({ error: "ID is required" })
  }
  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const calendarEvent = await getCalendarEvents({
    id,
    userId: member?.id,
    guestId: guest?.id,
  })
  if (!calendarEvent) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  try {
    const event = await deleteCalendarEvent({ id })

    return NextResponse.json(event)
  } catch (error) {
    console.error("Error deleting calendar event:", error)
    return NextResponse.json(
      { error: "Failed to delete calendar event" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const id = request.url.split("/").pop()
  if (!id) {
    return NextResponse.json({ error: "ID is required" })
  }
  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const calendarEvent = await getCalendarEvents({
    id,
    userId: member?.id,
    guestId: guest?.id,
  })
  if (!calendarEvent) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  try {
    const body = await request.text()
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

      return NextResponse.json(
        {
          error: "Invalid update data",
          errors: errors,
        },
        { status: 400 },
      )
    }

    // First get the existing event to merge with updates
    const existingEvent = await getCalendarEvent({
      id,
      userId: member?.id,
      guestId: guest?.id,
    })

    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Verify ownership
    if (
      existingEvent.userId !== member?.id &&
      existingEvent.guestId !== guest?.id
    ) {
      return NextResponse.json(
        { error: "Unauthorized to update this event" },
        { status: 403 },
      )
    }

    const event = await updateCalendarEvent({
      ...existingEvent,
      ...validation.data,
      updatedOn: new Date(), // Ensure updatedOn is set
    })

    return NextResponse.json(event)
  } catch (error) {
    console.error("Error updating calendar event:", error)
    return NextResponse.json(
      { error: "Failed to update calendar event" },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const id = request.url.split("/").pop()
  if (!id) {
    return NextResponse.json({ error: "ID is required" })
  }
  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const calendarEvent = await getCalendarEvent({
    id,
    userId: member?.id,
    guestId: guest?.id,
  })
  if (!calendarEvent) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  return NextResponse.json(calendarEvent)
}
