import { NextResponse } from "next/server"
import { validate } from "uuid"
import { deleteCollaboration, getCollaborations, getThread } from "@repo/db"
import getMember from "../../../../actions/getMember"
import getGuest from "../../../../actions/getGuest"

export async function DELETE(request: Request) {
  // Extract thread ID from URL: /api/threads/[id]/collaborations
  const urlParts = request.url.split("/")
  const threadsIndex = urlParts.findIndex((part) => part === "threads")
  const id = threadsIndex !== -1 ? urlParts[threadsIndex + 1] : null

  if (!id) {
    return NextResponse.json(
      { error: "Thread not found", status: 404 },
      { status: 404 },
    )
  }

  if (!validate(id)) {
    return NextResponse.json(
      { error: "Thread not found", status: 404 },
      { status: 404 },
    )
  }

  const member = await getMember()
  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json(
      { error: "Unauthorized", status: 401 },
      { status: 401 },
    )
  }

  const thread = await getThread({ id: id! })

  if (!thread) {
    return NextResponse.json(
      { error: "Thread not found", status: 404 },
      { status: 404 },
    )
  }

  // Check if user is the thread owner (either member or guest)
  const isThreadOwner =
    (member && thread.userId === member.id) ||
    (guest && thread.guestId === guest.id)

  if (!isThreadOwner) {
    return NextResponse.json(
      { error: "Unauthorized", status: 401 },
      { status: 401 },
    )
  }

  const collaborations = await getCollaborations({ threadId: id })

  if (!collaborations.length) {
    return NextResponse.json(
      { error: "Collaboration not found", status: 404 },
      { status: 404 },
    )
  }

  await Promise.all(
    collaborations.map((c) => deleteCollaboration({ id: c.collaboration.id })),
  )

  return NextResponse.json({ thread })
}
