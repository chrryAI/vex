import { Hono } from "hono"

export const testConfig = new Hono()

/**
 * Get test configuration (fingerprints and emails)
 * Used by SSR server to determine test user status
 */
testConfig.get("/", async (c) => {
  const TEST_MEMBER_FINGERPRINTS =
    process.env.TEST_MEMBER_FINGERPRINTS?.split(",").filter(Boolean) || []
  const TEST_GUEST_FINGERPRINTS =
    process.env.TEST_GUEST_FINGERPRINTS?.split(",").filter(Boolean) || []
  const TEST_MEMBER_EMAILS =
    process.env.TEST_MEMBER_EMAILS?.split(",").filter(Boolean) || []

  return c.json({
    TEST_MEMBER_FINGERPRINTS,
    TEST_GUEST_FINGERPRINTS,
    TEST_MEMBER_EMAILS,
  })
})
