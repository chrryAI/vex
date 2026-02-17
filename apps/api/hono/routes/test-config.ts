import { isE2E } from "@chrryai/chrry/utils"
import {
  TEST_GUEST_FINGERPRINTS,
  TEST_MEMBER_EMAILS,
  TEST_MEMBER_FINGERPRINTS,
  VEX_LIVE_FINGERPRINTS,
} from "@repo/db"
import { Hono } from "hono"

export const testConfig = new Hono()

/**
 * Get test configuration (fingerprints and emails)
 * Used by SSR server to determine test user status
 */
testConfig.get("/", async (c) => {
  const fpFromQuery = c.req.query("fp")
  if (!fpFromQuery) return c.json({})
  if (!isE2E) return c.json({})

  return c.json({
    TEST_MEMBER_FINGERPRINTS,
    TEST_GUEST_FINGERPRINTS,
    TEST_MEMBER_EMAILS,
    VEX_LIVE_FINGERPRINTS,
    TEST_FINGERPRINTS: TEST_MEMBER_FINGERPRINTS.concat(
      TEST_GUEST_FINGERPRINTS,
    ).concat(VEX_LIVE_FINGERPRINTS),
  })
})
