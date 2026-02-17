import { createMood, getLastMood, getMoods, updateMood } from "@repo/db"
import { Hono } from "hono"
import { getGuest, getMember } from "../lib/auth"

export const mood = new Hono()

// POST /mood - Create or update today's mood
mood.post("/", async (c) => {
  const { type, ..._ } = await c.req.json()

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

// New app for /moods (plural) - for getting all moods
export const moods = new Hono()

// GET /moods - Get all moods for user/guest
moods.get("/", async (c) => {
  const member = await getMember(c)
  const guest = member ? undefined : await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const moodsData = await getMoods({
    userId: member?.id,
    guestId: guest?.id,
    pageSize: 5000,
  })

  return c.json(moodsData)
})
