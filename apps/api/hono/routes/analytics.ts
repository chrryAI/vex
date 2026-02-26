import { db, isE2E, realtimeAnalytics } from "@repo/db"
import { Hono } from "hono"
import { captureException } from "../../lib/captureException"
import { getGuest, getMember } from "../lib/auth"

type Variables = {
  auth: {
    member?: { id: string } | null
    guest?: { id: string } | null
  }
}

const analytics = new Hono<{ Variables: Variables }>()

// Server-side throttle map to prevent spam
const throttleMap = new Map<string, number>()
const THROTTLE_MS = 500 // 500ms

// POST /analytics/track - Store real-time analytics for AI context
analytics.post("/grape", async (c) => {
  try {
    // Auth handled by middleware - read from context
    const member = await getMember(c)
    const guest = await getGuest(c)

    const isMemoriesEnabled = member?.memoriesEnabled || guest?.memoriesEnabled

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    if (!isMemoriesEnabled) {
      return c.json({ error: "Memories are not enabled" }, 401)
    }

    const { name, url, props, timestamp } = await c.req.json()

    // Validate required fields
    if (!name || !timestamp) {
      captureException(new Error("Missing required fields"))
      return c.json({ error: "Missing required fields" }, 400)
    }

    // Server-side throttle: Check if same event was tracked recently
    const userId = member?.id || guest?.id
    const throttleKey = `${userId}:${name}`
    const now = Date.now()
    const lastTracked = throttleMap.get(throttleKey)

    if (!isE2E && lastTracked && now - lastTracked < THROTTLE_MS) {
      // Silently ignore duplicate event (return success to avoid frontend errors)
      return c.json({ success: true, throttled: true })
    }

    // Update throttle map
    throttleMap.set(throttleKey, now)

    // Clean up old entries (older than 1 minute)
    for (const [key, time] of throttleMap.entries()) {
      if (now - time > 60000) {
        throttleMap.delete(key)
      }
    }

    // Store event for real-time AI context
    await db.insert(realtimeAnalytics).values({
      userId: member?.id,
      guestId: guest?.id,
      appSlug: props?.appSlug || null, // Extract appSlug from event props
      eventName: name,
      eventUrl: url || null,
      eventProps: props || {},
      createdOn: new Date(timestamp),
    })

    return c.json({ success: true })
  } catch (error) {
    captureException(error)
    console.error("❌ Analytics track error:", error)
    return c.json({ error: "Internal server error" }, 500)
  }
})

export default analytics
