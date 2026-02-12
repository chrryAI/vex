import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock dependencies
vi.mock("@chrryai/chrry/utils", () => ({
  isDevelopment: false,
  isE2E: false,
  isOwner: () => false
}))

const { protectMock } = vi.hoisted(() => {
  return { protectMock: vi.fn() }
})

vi.mock("@arcjet/node", () => ({
  default: () => ({
    protect: protectMock
  }),
  slidingWindow: () => ({})
}))

import { checkAuthRateLimit } from "../lib/rateLimiting"

describe("checkAuthRateLimit Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return success when arcjet allows", async () => {
    protectMock.mockResolvedValue({
      isDenied: () => false,
      results: [{ reason: { isRateLimit: () => true, remaining: 5 } }]
    })

    const req = new Request("http://localhost/auth/signin", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" }
    })

    const result = await checkAuthRateLimit(req, "1.2.3.4")

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(5)
    expect(protectMock).toHaveBeenCalled()
  })

  it("should return failure when arcjet denies", async () => {
    protectMock.mockResolvedValue({
      isDenied: () => true,
      results: [{ reason: { isRateLimit: () => true, remaining: 0 } }]
    })

    const req = new Request("http://localhost/auth/signin", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" }
    })

    const result = await checkAuthRateLimit(req, "1.2.3.4")

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })
})
