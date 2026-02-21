import { getGuest, updateGuest } from "@repo/db"
import { Hono } from "hono"
import { captureException } from "../../lib/captureException"
import { getGuest as getGuestAction } from "../lib/auth"

export const guest = new Hono()

// PATCH /guest - Update guest profile
guest.patch("/", async (c) => {
  const guestData = await getGuestAction(c, {
    skipCache: true,
  })

  const {
    favouriteAgent,
    characterProfilesEnabled,
    city,
    country,
    memoriesEnabled,
  } = await c.req.json()

  if (!guestData) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    await updateGuest({
      ...guestData,
      favouriteAgent: favouriteAgent ?? guestData.favouriteAgent,
      characterProfilesEnabled:
        characterProfilesEnabled ?? guestData.characterProfilesEnabled,
      memoriesEnabled: memoriesEnabled ?? guestData.memoriesEnabled,
      city: city ?? guestData.city,
      country: country ?? guestData.country,
    })

    const updatedGuest = await getGuest({
      id: guestData.id,
      skipCache: true,
    })

    return c.json(updatedGuest)
  } catch (error) {
    captureException(error)
    console.error("Error updating guest:", error)
    return c.json({ error: "Server error" }, 500)
  }
})

// GET /guest - Get guest profile
guest.get("/", async (c) => {
  const guestData = await getGuestAction(c, {
    skipCache: true,
  })

  if (!guestData) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  return c.json(guestData)
})
