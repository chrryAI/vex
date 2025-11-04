import { NextResponse } from "next/server"
import { deleteTaskLog, getTaskLog, updateTaskLog } from "@repo/db"
import getMember from "../../../actions/getMember"
import getGuest from "../../../actions/getGuest"
import sanitizeHtml from "sanitize-html"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const pathParts = url.pathname.split("/")
  let id = pathParts[pathParts.length - 1]

  if (!id) {
    return NextResponse.json({ error: "Order ID required" }, { status: 400 })
  }

  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const taskLog = await getTaskLog({ id })

  if (!taskLog) {
    return NextResponse.json({ error: "Task log not found" }, { status: 404 })
  }

  if (taskLog.userId !== member?.id && taskLog.guestId !== guest?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(taskLog)
}

export async function PATCH(request: Request) {
  const url = new URL(request.url)
  const pathParts = url.pathname.split("/")
  let id = pathParts[pathParts.length - 1]

  if (!id) {
    return NextResponse.json({ error: "Order ID required" }, { status: 400 })
  }

  const { content, mood } = await request.json()

  if (
    !content ||
    (mood &&
      !["happy", "sad", "angry", "astonished", "inlove", "thinking"].includes(
        mood,
      ))
  ) {
    return NextResponse.json(
      { error: "Invalid task log data" },
      { status: 400 },
    )
  }

  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const taskLog = await getTaskLog({ id })

  if (!taskLog) {
    return NextResponse.json({ error: "Task log not found" }, { status: 404 })
  }

  if (taskLog.userId !== member?.id && taskLog.guestId !== guest?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await updateTaskLog({
    ...taskLog,
    content: sanitizeHtml(content),
    mood,
    userId: member?.id || null,
    guestId: guest?.id || null,
    taskId: taskLog.taskId,
  })

  return NextResponse.json(await getTaskLog({ id }))
}

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const pathParts = url.pathname.split("/")
  let id = pathParts[pathParts.length - 1]

  if (!id) {
    return NextResponse.json({ error: "Task log ID required" }, { status: 400 })
  }

  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const taskLog = await getTaskLog({ id })

  if (!taskLog) {
    return NextResponse.json({ error: "Task log not found" }, { status: 404 })
  }

  if (taskLog.userId !== member?.id && taskLog.guestId !== guest?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await deleteTaskLog({ id })

  return NextResponse.json({ message: "Task log deleted" })
}
