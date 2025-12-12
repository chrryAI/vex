import { Hono } from "hono"
import { getStores } from "@repo/db"
import { getGuest, getMember } from "../lib/auth"

export const stores = new Hono()

// GET /stores - Get stores for current user/guest
stores.get("/", async (c) => {
  try {
    const member = await getMember(c)
    const guest = !member ? await getGuest(c) : undefined

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const storesList = await getStores({
      userId: member?.id,
      guestId: guest?.id,
      page: 1,
      pageSize: 100,
    })

    return c.json(storesList)
  } catch (error) {
    console.error("Error fetching stores:", error)
    return c.json({ error: "Failed to fetch stores" }, 500)
  }
})
