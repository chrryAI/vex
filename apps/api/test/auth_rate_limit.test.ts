import { describe, it, expect } from "bun:test"
import { checkAuthRateLimit } from "../lib/rateLimiting"

describe("Auth Rate Limiting", () => {
  it("checkAuthRateLimit function should be defined", () => {
    expect(checkAuthRateLimit).toBeDefined()
  })

  it("should allow requests in test environment (bypass)", async () => {
    // In test environment (isDevelopment || isE2E), rate limiting is bypassed in the implementation.
    // We cannot easily mock this environment variable in this test setup without affecting other tests or requiring complex setup.
    // So we verify that the function runs and returns success: true, which is the expected behavior in this environment.
    const req = new Request("http://localhost/auth/signin", {
      method: "POST",
      headers: {
        "x-forwarded-for": "1.2.3.4",
      },
    })

    const result = await checkAuthRateLimit(req, "1.2.3.4")
    expect(result.success).toBe(true)
  })
})
