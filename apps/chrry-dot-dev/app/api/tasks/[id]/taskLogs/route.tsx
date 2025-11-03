import { NextResponse } from "next/server"
import { getTask, getTaskLogs } from "@repo/db"
import getMember from "../../../../actions/getMember"
import getGuest from "../../../../actions/getGuest"

function getTaskIdFromUrl(urlString: string) {
  const url = new URL(urlString)
  const parts = url.pathname.split("/")
  // Example parts: ["", "api", "tasks", "fd06ae65-...", "taskLogs"]
  const tasksIndex = parts.indexOf("tasks")
  if (tasksIndex !== -1 && parts.length > tasksIndex + 1) {
    return parts[tasksIndex + 1]
  }
  return null
}

export async function GET(request: Request) {
  const url = new URL(request.url)

  const taskId = getTaskIdFromUrl(request.url)

  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" })
  }

  const member = await getMember()

  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const task = await getTask({ id: taskId })

  if (!task) {
    return NextResponse.json({ error: "Task not found" })
  }

  if (task.userId !== member?.id && task.guestId !== guest?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pageSize = url.searchParams.get("pageSize")

  const taskLogs = await getTaskLogs({
    userId: member?.id,
    guestId: guest?.id,
    pageSize: pageSize ? parseInt(pageSize) : 100,
    taskId: taskId ?? undefined,
  })

  return NextResponse.json(taskLogs)
}
