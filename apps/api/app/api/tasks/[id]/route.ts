import { NextResponse } from "next/server"
import { deleteTask, getTask, getTasks, updateTask } from "@repo/db"
import getMember from "../../../actions/getMember"
import getGuest from "../../../actions/getGuest"
import captureException from "../../../../lib/captureException"

export async function PATCH(request: Request) {
  const { title, total, order, reorder } = await request.json()

  const id = request.url.split("/").pop()?.split("?")[0]

  if (!id) {
    return NextResponse.json({ error: "Task ID is required" })
  }

  const sanitizedTotal = Array.isArray(total)
    ? total.filter(
        (item) =>
          typeof item.date === "string" && !isNaN(Date.parse(item.date)),
      )
    : []

  const member = await getMember()

  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Invalid credentials" })
  }

  const tasks = await getTasks({
    userId: member?.id,
    guestId: guest?.id,
  })

  const existingTask = await getTask({ id })

  if (!existingTask) {
    return NextResponse.json({ error: "Task not found" })
  }

  if (
    !(existingTask.userId === member?.id || existingTask.guestId === guest?.id)
  ) {
    return NextResponse.json({ error: "Unauthorized" })
  }

  // Handle reordering of tasks if reorder flag is true and order has changed
  if (reorder === true) {
    try {
      // Get all tasks sorted by their current order
      const allTasks = [...tasks.tasks].sort((a, b) => {
        // Handle null orders by placing them at the end
        if (a.order === null) return 1
        if (b.order === null) return -1
        return (a.order || 0) - (b.order || 0)
      })

      // Find the current position of the task being updated
      const oldIndex = allTasks.findIndex((t) => t.id === id)
      if (oldIndex === -1) {
        return NextResponse.json(
          { error: "Task not found in ordered list" },
          { status: 404 },
        )
      }

      // Create a new array with the task moved to the new position
      const newTasks = [...allTasks]
      const [movedTask] = newTasks.splice(oldIndex, 1)

      // Check if movedTask exists before proceeding
      if (!movedTask) {
        return NextResponse.json(
          { error: "Failed to move task" },
          { status: 500 },
        )
      }

      newTasks.splice(order, 0, movedTask)

      // Update all tasks with their new order
      for (let i = 0; i < newTasks.length; i++) {
        const taskToUpdate = newTasks[i]
        if (taskToUpdate) {
          await updateTask({
            ...taskToUpdate,
            order: i,
          })
        }
      }

      // Return success response for reordering
      return NextResponse.json({
        success: true,
        message: "Tasks reordered successfully",
      })
    } catch (error) {
      captureException(error)
      console.error("Error reordering tasks:", error)
      return NextResponse.json(
        { error: "Failed to reorder tasks" },
        { status: 500 },
      )
    }
  }

  // If not reordering, proceed with normal task update
  const task = await updateTask({
    ...existingTask,
    title,
    userId: member?.id || null,
    guestId: guest?.id || null,
    modifiedOn: new Date(),
    total:
      sanitizedTotal.length > 0 ? sanitizedTotal : existingTask.total || [],
    order: order ?? existingTask.order,
  })

  if (!task) {
    return NextResponse.json({ error: "Failed to update task" })
  }

  return NextResponse.json(task)
}

export async function DELETE(request: Request) {
  const id = request.url.split("/").pop()
  if (!id) {
    return NextResponse.json({ error: "Task ID is required" })
  }
  const member = await getMember()
  const guest = await getGuest()
  if (!member && !guest) {
    return NextResponse.json({ error: "Invalid credentials" })
  }
  const existingTask = await getTask({ id })
  if (!existingTask) {
    return NextResponse.json({ error: "Task not found" })
  }
  if (
    !(existingTask.userId === member?.id || existingTask.guestId === guest?.id)
  ) {
    return NextResponse.json({ error: "Unauthorized" })
  }
  const task = await deleteTask({ id })
  if (!task) {
    return NextResponse.json({ error: "Failed to delete task" })
  }
  return NextResponse.json({ message: "Task deleted successfully" })
}
