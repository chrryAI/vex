import { Hono } from "hono"
import { getMember, getGuest } from "../lib/auth"
import { isE2E } from "@chrryai/chrry/utils"
import cleanupTest from "../../lib/cleanupTest"
import { TEST_GUEST_FINGERPRINTS, TEST_MEMBER_EMAILS } from "@repo/db"

export const clear = new Hono()

// POST /clear - Clear test data (E2E only)
clear.post("/", async (c) => {
  if (!isE2E) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  if (member && TEST_MEMBER_EMAILS.includes(member?.email)) {
    await cleanupTest()
    return c.json({ success: true })
  }

  if (guest && TEST_GUEST_FINGERPRINTS.includes(guest?.fingerprint)) {
    await cleanupTest()
    return c.json({ success: true })
  }

  return c.json({ error: "Unauthorized" }, 401)
})
