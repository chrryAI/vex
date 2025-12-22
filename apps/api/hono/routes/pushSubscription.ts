import { Hono } from "hono"
import {
  deletePushSubscription,
  getPushSubscription,
  createPushSubscription,
  NewCustomPushSubscription,
} from "@repo/db"
import { getGuest, getMember } from "../lib/auth"

export const pushSubscription = new Hono()

// POST /pushSubscription - Get push subscription by endpoint
pushSubscription.post("/", async (c) => {
  const { endpoint } = await c.req.json()

  const member = await getMember(c)
  const guest = !member ? await getGuest(c) : undefined

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const subscription = await getPushSubscription({
    userId: member?.id,
    guestId: guest?.id,
    endpoint,
  })

  if (!subscription) {
    return c.json({ error: "Subscription not found" }, 404)
  }

  return c.json({ subscription })
})

// DELETE /pushSubscription - Delete push subscription
pushSubscription.delete("/", async (c) => {
  const { endpoint } = await c.req.json()

  if (!endpoint) {
    return c.json({ error: "Endpoint is required" }, 400)
  }

  const member = await getMember(c)
  const guest = !member ? await getGuest(c) : undefined

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const subscription = await getPushSubscription({
    userId: member?.id,
    guestId: guest?.id,
    endpoint,
  })

  if (!subscription) {
    return c.json({ error: "Subscription not found" }, 404)
  }

  await deletePushSubscription({
    id: subscription.id,
  })

  return c.json({ success: true })
})

// New app for /pushSubscriptions (plural) - for creating subscriptions
export const pushSubscriptions = new Hono()

// POST /pushSubscriptions - Create a new push subscription
pushSubscriptions.post("/", async (c) => {
  const member = await getMember(c)
  const guest = !member ? await getGuest(c) : undefined

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const { endpoint, keys } = await c.req.json()

  if (!endpoint || !keys) {
    return c.json({ error: "Missing endpoint or keys" }, 400)
  }

  const subscription: NewCustomPushSubscription = {
    endpoint,
    keys,
    createdOn: new Date(),
    updatedOn: new Date(),
  }

  const createdSubscription = await createPushSubscription({
    userId: member?.id,
    guestId: guest?.id,
    subscription,
  })

  return c.json({ subscription: createdSubscription })
})
