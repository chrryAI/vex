import { createTimer, getTimer, updateTimer } from "@repo/db"
import { Hono } from "hono"
import { notify } from "../../lib/notify"
import { getGuest, getMember } from "../lib/auth"

export const timers = new Hono()

// GET /timers/:deviceId - Get or create timer for device
timers.get("/:deviceId", async (c) => {
  const deviceId = c.req.param("deviceId")

  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Member not found" }, 401)
  }

  if (!deviceId) {
    return c.json({ error: "Invalid deviceId" }, 400)
  }

  const fingerprint = member?.fingerprint || guest?.fingerprint

  if (!fingerprint) {
    return c.json({ error: "Invalid fingerprint" }, 400)
  }

  const timer =
    (await getTimer({
      userId: member?.id,
      guestId: guest?.id,
    })) ||
    (await createTimer({
      fingerprint,
      guestId: guest?.id,
      userId: member?.id,
    }))

  return c.json(timer)
})

// PATCH /timers/:deviceId - Update timer
timers.patch("/:deviceId", async (c) => {
  const deviceId = c.req.param("deviceId")

  if (!deviceId) {
    return c.json({ error: "Invalid id" }, 400)
  }

  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Member not found" }, 401)
  }

  const { count, preset1, preset2, preset3, isCountingDown, fingerprint } =
    await c.req.json()

  const timer = await getTimer({ userId: member?.id, guestId: guest?.id })

  if (!timer) {
    return c.json({ error: "Timer not found" }, 404)
  }

  const updatedTimer = await updateTimer({
    ...timer,
    count: count ?? timer.count,
    preset1: preset1 ?? timer.preset1,
    preset2: preset2 ?? timer.preset2,
    preset3: preset3 ?? timer.preset3,
    isCountingDown: isCountingDown ?? timer.isCountingDown,
    fingerprint: fingerprint ?? timer.fingerprint,
  })

  notify(member?.id || guest?.id!, {
    type: "timer",
    data: { ...updatedTimer, deviceId },
  })

  return c.json(updatedTimer)
})
