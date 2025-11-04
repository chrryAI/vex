import { after, NextResponse } from "next/server"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import {
  createMood,
  createTaskLog,
  getMoods,
  getTask,
  getTaskLogs,
  getUser,
} from "@repo/db"
import sanitizeHtml from "sanitize-html"
import { utcToday } from "chrry/utils"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const hasMood = url.searchParams.get("hasMood")
  const pageSize = url.searchParams.get("pageSize")
  const member = await getMember()

  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const taskLogs = await getTaskLogs({
    pageSize: parseInt(pageSize || "100"),
    userId: member?.id,
    guestId: guest?.id,
    hasMood: hasMood ? Boolean(hasMood) : undefined,
  })

  return NextResponse.json(taskLogs)
}

export async function POST(request: Request) {
  const member = await getMember()

  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { content, mood, taskId, ...rest } = await request.json()

  const language = rest.language || "en"

  if (!taskId) {
    return NextResponse.json(
      { error: "Invalid task log data" },
      { status: 400 },
    )
  }

  const task = await getTask({ id: taskId })

  if (!task) {
    return NextResponse.json(
      { error: "Invalid task log data" },
      { status: 400 },
    )
  }

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

  const taskLog = await createTaskLog({
    content: sanitizeHtml(content),
    mood,
    userId: member?.id,
    guestId: guest?.id,
    taskId: taskId,
  })

  if (!taskLog) {
    return NextResponse.json({ error: "Failed to create task log" })
  }

  // Create mood entry if mood is provided
  if (mood) {
    await createMood({
      type: mood,
      userId: member?.id,
      taskLogId: taskLog.id,
      guestId: guest?.id,
    })
  }

  return NextResponse.json(taskLog)
}
