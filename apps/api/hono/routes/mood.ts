import { Hono } from "hono"
import { createMood, getLastMood, updateMood } from "@repo/db"
import { getGuest, getMember } from "../lib/auth"

export const mood = new Hono()

// POST /mood - Create or update today's mood
mood.post("/", async (c) => {
  const { type, ...rest } = await c.req.json()

  const guest = await getGuest(c)
  const member = await getMember(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  if (!type) {
    return c.json({ error: "Invalid request" }, 400)
  }

  let moodData = await getLastMood(member?.id, guest?.id)

  // Check if last mood was created today
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const isToday = moodData && new Date(moodData.createdOn) >= today

  if (moodData && isToday) {
    // Update today's mood
    const updatedMood = await updateMood({
      ...moodData,
      type,
      updatedOn: new Date(),
    })

    moodData = updatedMood
  } else {
    // Create new mood (first mood today or no mood exists)
    moodData = await createMood({
      type,
      userId: member?.id,
      guestId: guest?.id,
    })
  }

  return c.json(moodData)
})

// GET /mood - Get last mood
mood.get("/", async (c) => {
  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const moodData = await getLastMood(member?.id, guest?.id)

  return c.json(moodData || {})
})
