import { NextResponse } from "next/server"
import getMember from "../../../actions/getMember"
import getGuest from "../../../actions/getGuest"
import {
  deleteCollaboration,
  getCollaboration,
  getThread,
  updateCollaboration,
} from "@repo/db"
import { collaborationStatus } from "@repo/db/src/schema"

export async function PATCH(request: Request) {
  const id = request.url.split("/").pop()?.split("?")[0]

  if (!id) {
    return NextResponse.json(
      { error: "Collaboration not found", status: 404 },
      { status: 404 },
    )
  }

  const { status } = (await request.json()) as {
    status: collaborationStatus | undefined
  }

  if (!["active", "revoked", "rejected", "pending"].includes(status ?? "")) {
    return NextResponse.json(
      { error: "Invalid status", status: 400 },
      { status: 400 },
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

  const collab = await getCollaboration({ id })

  if (!collab) {
    return NextResponse.json(
      { error: "Collaboration not found", status: 404 },
      { status: 404 },
    )
  }

  const thread = await getThread({ id: collab.threadId })

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

  const isCollaborator = thread.collaborations?.some(
    (collaboration) => collaboration.user.id === member?.id,
  )

  if (!isThreadOwner && !isCollaborator) {
    console.log("Unauthorized - not thread owner")
    return NextResponse.json(
      { error: "Unauthorized", status: 401 },
      { status: 401 },
    )
  }

  if (status === "revoked") {
    await deleteCollaboration({ id })
    return NextResponse.json({ collaboration: null })
  }

  const updatedCollab = await updateCollaboration({
    ...collab,
    status: status ?? collab.status,
  })

  return NextResponse.json({ collaboration: updatedCollab })
}
