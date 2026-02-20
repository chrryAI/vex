import { isE2E } from "@chrryai/chrry/utils"
import {
  TEST_GUEST_FINGERPRINTS,
  TEST_MEMBER_EMAILS,
  TEST_MEMBER_FINGERPRINTS,
  VEX_LIVE_FINGERPRINTS,
} from "@repo/db"
import { Hono } from "hono"
import cleanupTest from "../../lib/cleanupTest"
import { getGuest, getMember } from "../lib/auth"
import { corsMiddleware } from "../middleware/cors"

export const clear = new Hono()

// Apply CORS middleware to this route
clear.use("*", corsMiddleware)

// POST /clear - Clear test data (E2E only)
clear.post("/", async (c) => {
  if (!isE2E) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  // Add anti-cache headers to prevent caching and reduce CSRF surface
  c.header("Cache-Control", "no-store")

  const allFingerprints = TEST_GUEST_FINGERPRINTS.concat(
    TEST_MEMBER_FINGERPRINTS,
  ).concat(VEX_LIVE_FINGERPRINTS)

  const member = await getMember(c)
  const guest = await getGuest(c)

  const fingerprint = guest?.fingerprint || member?.fingerprint

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const CAN_CLEAR =
    (member?.email && TEST_MEMBER_EMAILS.includes(member.email)) ||
    (fingerprint && allFingerprints.includes(fingerprint))

  if (CAN_CLEAR) {
    await cleanupTest()
    return c.json({ success: true })
  }

  return c.json({ error: "Unauthorized" }, 401)
})
