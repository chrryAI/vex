import { after, NextResponse } from "next/server"
import getMember from "../../actions/getMember"
import { createTask, getTasks, updateTask } from "@repo/db"
import getGuest from "../../actions/getGuest"
import "../../../sentry.server.config"

export async function POST(request: Request) {
  const req = await request.json()
  const { title, total, order } = req

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const member = await getMember()

  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const tasks = await getTasks({
    userId: member?.id,
    guestId: guest?.id,
  })

  const task = await createTask({
    title,
    userId: member?.id,
    guestId: !member ? guest?.id : undefined,
    modifiedOn: new Date(),
    total: total ? total : [],
    order: order ? order : 0,
  })

  if (!task) {
    return NextResponse.json({ error: "Failed to create task" })
  }

  return NextResponse.json({ task })
}

export const PATCH = async (request: Request) => {
  const member = await getMember()

  const guest = !member ? await getGuest() : undefined

  if (!member && !guest) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const req = await request.json()
  const { selectedTasks, fingerprint } = req

  if (!Array.isArray(selectedTasks)) {
    return NextResponse.json({ error: "Invalid tasks", status: 400 })
  }

  const tasks = await getTasks({
    userId: member?.id,
    guestId: guest?.id,
  })

  for (const task of tasks.tasks) {
    const selected = selectedTasks.includes(task.id)
    if (selected !== task.selected) {
      await updateTask({
        ...task,
        selected,
        modifiedOn: new Date(),
      })
    }
  }

  return NextResponse.json({ selectedTasks })
}

export async function GET(request: Request) {
  const member = await getMember()

  const guest = !member ? await getGuest() : undefined

  if (!member && !guest) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const tasks = await getTasks({
    userId: member?.id,
    guestId: guest?.id,
  })

  return NextResponse.json(tasks)
}
