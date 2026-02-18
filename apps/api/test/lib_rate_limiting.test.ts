import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock dependencies
vi.mock("@chrryai/chrry/utils", () => ({
  isDevelopment: false,
  isE2E: false,
  isOwner: () => false,
}))

const { protectMock } = vi.hoisted(() => {
  return { protectMock: vi.fn() }
})

vi.mock("@arcjet/node", () => ({
  default: () => ({
    protect: protectMock,
  }),
  slidingWindow: () => ({}),
}))

import { checkAuthRateLimit, checkGenerationRateLimit, checkRateLimit } from "../lib/rateLimiting"

describe("checkAuthRateLimit Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return success when arcjet allows", async () => {
    protectMock.mockResolvedValue({
      isDenied: () => false,
      results: [{ reason: { isRateLimit: () => true, remaining: 5 } }],
    })

    const req = new Request("http://localhost/auth/signin", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
    })

    const result = await checkAuthRateLimit(req, "1.2.3.4")

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(5)
    expect(protectMock).toHaveBeenCalled()
  })

  it("should return failure when arcjet denies", async () => {
    protectMock.mockResolvedValue({
      isDenied: () => true,
      results: [{ reason: { isRateLimit: () => true, remaining: 0 } }],
    })

    const req = new Request("http://localhost/auth/signin", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
    })

    const result = await checkAuthRateLimit(req, "1.2.3.4")

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })
})

describe("checkRateLimit Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should enforce limits for anonymous users", async () => {
    protectMock.mockResolvedValue({
      isDenied: () => false,
      results: [{ reason: { isRateLimit: () => true, remaining: 10 } }],
    })

    const req = new Request("http://localhost/api/chat", { method: "POST" })
    const result = await checkRateLimit(req, {})

    expect(result.success).toBe(true)
    expect(result.isAuthenticated).toBe(false)
    expect(protectMock).toHaveBeenCalledWith(expect.anything(), { userId: "anonymous" })
  })

  it("should enforce limits for guests", async () => {
    protectMock.mockResolvedValue({
      isDenied: () => false,
      results: [{ reason: { isRateLimit: () => true, remaining: 20 } }],
    })

    const req = new Request("http://localhost/api/chat", { method: "POST" })
    const guest = { id: "guest-123" } as any
    const result = await checkRateLimit(req, { guest })

    expect(result.success).toBe(true)
    expect(result.isAuthenticated).toBe(true)
    expect(protectMock).toHaveBeenCalledWith(expect.anything(), { userId: "guest-123" })
  })

  it("should enforce limits for members (free)", async () => {
    protectMock.mockResolvedValue({
      isDenied: () => false,
      results: [{ reason: { isRateLimit: () => true, remaining: 30 } }],
    })

    const req = new Request("http://localhost/api/chat", { method: "POST" })
    const member = { id: "user-123" } as any
    const result = await checkRateLimit(req, { member })

    expect(result.success).toBe(true)
    expect(result.isAuthenticated).toBe(true)
    expect(protectMock).toHaveBeenCalledWith(expect.anything(), { userId: "user-123" })
  })

  it("should enforce limits for pro members", async () => {
    protectMock.mockResolvedValue({
      isDenied: () => false,
      results: [{ reason: { isRateLimit: () => true, remaining: 100 } }],
    })

    const req = new Request("http://localhost/api/chat", { method: "POST" })
    const member = { id: "user-123", subscription: { plan: "pro" } } as any
    const result = await checkRateLimit(req, { member })

    expect(result.success).toBe(true)
    expect(result.isAuthenticated).toBe(true)
    // Verify it uses the pro instance (we can't easily check which instance, but we check protect is called)
    expect(protectMock).toHaveBeenCalled()
  })
})

describe("checkGenerationRateLimit Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should check both hourly and per-thread limits", async () => {
    // Mock protect to handle multiple calls (hourly and thread)
    protectMock.mockResolvedValue({
      isDenied: () => false,
      results: [{ reason: { isRateLimit: () => true, remaining: 5 } }],
    })

    const req = new Request("http://localhost/api/generate", { method: "POST" })
    const member = { id: "user-123" } as any
    const threadId = "thread-abc"

    const result = await checkGenerationRateLimit(req, { member, threadId })

    expect(result.success).toBe(true)
    expect(protectMock).toHaveBeenCalledTimes(2) // Once for hourly, once for thread
  })

  it("should return failure if any limit is denied", async () => {
    // Mock protect to deny one of the calls
    protectMock
      .mockResolvedValueOnce({
        isDenied: () => false, // Hourly allowed
        results: [{ reason: { isRateLimit: () => true, remaining: 5 } }],
      })
      .mockResolvedValueOnce({
        isDenied: () => true, // Thread denied
        results: [{ reason: { isRateLimit: () => true, remaining: 0 } }],
      })

    const req = new Request("http://localhost/api/generate", { method: "POST" })
    const member = { id: "user-123" } as any
    const threadId = "thread-abc"

    const result = await checkGenerationRateLimit(req, { member, threadId })

    expect(result.success).toBe(false)
    expect(result.errorMessage).toContain("regenerated this title")
  })
})
