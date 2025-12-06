import { NextResponse } from "next/server"
import { deleteMessage, getMessage, getThread, updateMessage } from "@repo/db"
import getMember from "../../../actions/getMember"
import { getIp } from "../../../../lib"
import getGuest from "../../../actions/getGuest"
import { validate } from "uuid"
import { isOwner } from "chrry/utils"
import { notifyOwnerAndCollaborations } from "../../../../lib/notify"
import { deleteFile } from "../../../../lib/minio"

export async function DELETE(request: Request) {
  const id = request.url.split("/").pop()
  if (!id) {
    return NextResponse.json({ error: "ID is required" })
  }

  const member = await getMember()

  const guest = !member ? await getGuest() : undefined

  if (!member && !guest) {
    return NextResponse.json({ error: "Invalid credentials" })
  }

  const existingMessage = await getMessage({ id })

  if (!existingMessage) {
    return NextResponse.json({ error: "Message not found" })
  }

  const thread = await getThread({
    id: existingMessage.thread.id,
  })

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" })
  }

  if (
    !isOwner(existingMessage.message, {
      userId: member?.id,
      guestId: guest?.id,
    })
  ) {
    if (
      !isOwner(existingMessage.thread, {
        userId: member?.id,
        guestId: guest?.id,
      })
    ) {
      return NextResponse.json({ error: "Unauthorized" })
    }
  }

  if (existingMessage.message.images) {
    for (const image of existingMessage.message.images) {
      await deleteFile(image.url)
    }
  }

  if (existingMessage.message.files) {
    for (const file of existingMessage.message.files) {
      if (file.url) {
        await deleteFile(file.url)
      }
    }
  }

  if (existingMessage.message.video) {
    for (const video of existingMessage.message.video) {
      await deleteFile(video.url)
    }
  }

  const message = await deleteMessage({ id })

  if (!message) {
    return NextResponse.json({ error: "Failed to delete message" })
  }

  notifyOwnerAndCollaborations({
    thread,
    payload: {
      type: "delete_message",
      data: {
        id,
      },
    },
  })

  return NextResponse.json({ message: "Message deleted successfully" })
}

export async function GET(request: Request) {
  const id = request.url.split("/").pop()
  if (!id) {
    return NextResponse.json({ error: "ID is required" })
  }

  const member = await getMember()
  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const message = await getMessage({
    id,
    userId: member?.id,
    guestId: guest?.id,
  })

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 })
  }

  return NextResponse.json(message)
}

export async function PATCH(request: Request) {
  const id = request.url.split("/").pop()
  if (!id) {
    return NextResponse.json({ error: "ID is required" })
  }

  const body = await request.json()
  let { like, clientId } = body

  if (clientId && !validate(clientId)) {
    return NextResponse.json({ error: "Invalid client ID" })
  }

  const member = await getMember()
  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Invalid credentials" })
  }

  const existingMessage = await getMessage({ id })

  if (!existingMessage) {
    return NextResponse.json({ error: "Message not found" })
  }

  const newReactions =
    like === undefined
      ? existingMessage.message.reactions
      : like === null
        ? existingMessage.message.reactions?.filter(
            (b) => b.userId !== member?.id && b.guestId !== guest?.id,
          ) || []
        : like === true
          ? existingMessage.message.reactions?.some(
              (b) =>
                (b.userId === member?.id || b.guestId === guest?.id) && b.like,
            )
            ? existingMessage.message.reactions
            : [
                ...(existingMessage.message.reactions?.filter(
                  (b) => b.userId !== member?.id && b.guestId !== guest?.id,
                ) || []),
                {
                  like: true,
                  dislike: false,
                  userId: member?.id,
                  guestId: guest?.id,
                  createdOn: new Date().toISOString(), // Better for serialization
                },
              ]
          : existingMessage.message.reactions?.some(
                (b) =>
                  (b.userId === member?.id || b.guestId === guest?.id) &&
                  b.dislike,
              )
            ? existingMessage.message.reactions
            : [
                ...(existingMessage.message.reactions?.filter(
                  (b) => b.userId !== member?.id && b.guestId !== guest?.id,
                ) || []),
                {
                  like: false,
                  dislike: true,
                  userId: member?.id,
                  guestId: guest?.id,
                  createdOn: new Date().toISOString(), // Better for serialization
                },
              ]

  //NO NEED UNLESS IT UPDATES THE OTHER PARTS OF MESSAGE
  // if (
  //   existingMessage?.user?.id !== member?.id &&
  //   (!guest || existingMessage?.guest?.id !== guest?.id)
  // ) {
  //   return NextResponse.json({ error: "Message not found" })
  // }

  const message = await updateMessage({
    ...existingMessage.message,
    reactions: newReactions,
    clientId: clientId ?? existingMessage.message.clientId,
  })

  if (!message) {
    return NextResponse.json({ error: "Failed to update message" })
  }

  return NextResponse.json({ message })
}
