import { Hono } from "hono"
import { isE2E } from "@chrryai/chrry/utils"
export const testConfig = new Hono()

/**
 * Get test configuration (fingerprints and emails)
 * Used by SSR server to determine test user status
 */
testConfig.get("/", async (c) => {
  const fpFromQuery = c.req.query("fp")
  if (!fpFromQuery) return c.json({})
  if (!isE2E) return c.json({})

  const TEST_MEMBER_FINGERPRINTS =
    process.env.TEST_MEMBER_FINGERPRINTS?.split(",").filter(Boolean) || []
  const TEST_GUEST_FINGERPRINTS =
    process.env.TEST_GUEST_FINGERPRINTS?.split(",").filter(Boolean) || []
  const TEST_MEMBER_EMAILS =
    process.env.TEST_MEMBER_EMAILS?.split(",").filter(Boolean) || []

  if (
    !TEST_MEMBER_FINGERPRINTS.concat(TEST_GUEST_FINGERPRINTS).includes(
      fpFromQuery,
    )
  ) {
    return c.json({})
  }

  return c.json({
    TEST_MEMBER_FINGERPRINTS,
    TEST_GUEST_FINGERPRINTS,
    TEST_MEMBER_EMAILS,
  })
})
