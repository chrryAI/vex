import { Hono } from "hono"
import { createTask, getTasks, updateTask, getTask, deleteTask } from "@repo/db"
import { getMember, getGuest } from "../lib/auth"
import captureException from "../../lib/captureException"

export const tasks = new Hono()

// POST /tasks - Create a new task
tasks.post("/", async (c) => {
  const { title, total, order } = await c.req.json()

  if (!title) {
    return c.json({ error: "Title is required" }, 400)
  }

  const member = await getMember(c)
  const guest = !member ? await getGuest(c) : undefined

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const task = await createTask({
    title,
    userId: member?.id,
    guestId: !member ? guest?.id : undefined,
    modifiedOn: new Date(),
    total: total ? total : [],
    order: order ? order : 0,
  })

  if (!task) {
    return c.json({ error: "Failed to create task" }, 500)
  }

  return c.json({ task })
})

// PATCH /tasks - Update multiple tasks (bulk selection)
tasks.patch("/", async (c) => {
  const member = await getMember(c)
  const guest = !member ? await getGuest(c) : undefined

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const { selectedTasks } = await c.req.json()

  if (!Array.isArray(selectedTasks)) {
    return c.json({ error: "Invalid tasks" }, 400)
  }

  const tasksData = await getTasks({
    userId: member?.id,
    guestId: guest?.id,
  })

  for (const task of tasksData.tasks) {
    const selected = selectedTasks.includes(task.id)
    if (selected !== task.selected) {
      await updateTask({
        ...task,
        selected,
        modifiedOn: new Date(),
      })
    }
  }

  return c.json({ selectedTasks })
})

// GET /tasks - Get all tasks for user/guest
tasks.get("/", async (c) => {
  const member = await getMember(c)
  const guest = !member ? await getGuest(c) : undefined

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const tasksData = await getTasks({
    userId: member?.id,
    guestId: guest?.id,
    pageSize: 15,
  })

  return c.json(tasksData)
})

// PATCH /tasks/:id - Update a specific task
tasks.patch("/:id", async (c) => {
  const { title, total, order, reorder } = await c.req.json()
  const id = c.req.param("id")

  if (!id) {
    return c.json({ error: "Task ID is required" }, 400)
  }

  const sanitizedTotal = Array.isArray(total)
    ? total.filter(
        (item) =>
          typeof item.date === "string" && !isNaN(Date.parse(item.date)),
      )
    : []

  const member = await getMember(c)
  const guest = !member ? await getGuest(c) : undefined

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const tasksData = await getTasks({
    userId: member?.id,
    guestId: guest?.id,
  })

  const existingTask = await getTask({
    id,
    userId: member?.id,
    guestId: guest?.id,
  })

  if (!existingTask) {
    return c.json({ error: "Task not found" }, 404)
  }

  // Handle reordering of tasks if reorder flag is true
  if (reorder) {
    try {
      // Get all tasks sorted by their current order
      const allTasks = [...tasksData.tasks].sort((a, b) => {
        // Handle null orders by placing them at the end
        if (a.order === null) return 1
        if (b.order === null) return -1
        return (a.order || 0) - (b.order || 0)
      })

      // Find the current position of the task being updated
      const oldIndex = allTasks.findIndex((t) => t.id === id)
      if (oldIndex === -1) {
        return c.json({ error: "Task not found in ordered list" }, 404)
      }

      // Create a new array with the task moved to the new position
      const newTasks = [...allTasks]
      const [movedTask] = newTasks.splice(oldIndex, 1)

      // Check if movedTask exists before proceeding
      if (!movedTask) {
        return c.json({ error: "Failed to move task" }, 500)
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
      return c.json({
        success: true,
        message: "Tasks reordered successfully",
      })
    } catch (error) {
      captureException(error)
      console.error("Error reordering tasks:", error)
      return c.json({ error: "Failed to reorder tasks" }, 500)
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
    return c.json({ error: "Failed to update task" }, 500)
  }

  return c.json(task)
})

// DELETE /tasks/:id - Delete a specific task
tasks.delete("/:id", async (c) => {
  const id = c.req.param("id")

  if (!id) {
    return c.json({ error: "Task ID is required" }, 400)
  }

  const member = await getMember(c)
  const guest = !member ? await getGuest(c) : undefined

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const existingTask = await getTask({
    id,
    userId: member?.id,
    guestId: guest?.id,
  })

  if (!existingTask) {
    return c.json({ error: "Task not found" }, 404)
  }

  const task = await deleteTask({ id })

  if (!task) {
    return c.json({ error: "Failed to delete task" }, 500)
  }

  return c.json({ message: "Task deleted successfully" })
})
