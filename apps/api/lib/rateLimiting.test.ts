import { beforeEach, describe, expect, it, vi } from "vitest"
import { checkAuthRateLimit } from "./rateLimiting"

// Hoist mocks
const { mockIsDevelopment, mockIsE2E, mockSlidingWindow } = vi.hoisted(() => {
  return {
    mockIsDevelopment: { value: false },
    mockIsE2E: { value: false },
    mockSlidingWindow: vi
      .fn()
      .mockResolvedValue({ success: true, remaining: 5 }),
  }
})

// Mock utils
vi.mock("@chrryai/chrry/utils", () => ({
  get isDevelopment() {
    return mockIsDevelopment.value
  },
  get isE2E() {
    return mockIsE2E.value
  },
  isOwner: vi.fn(),
}))

// Mock ioredis — replace the Redis class so no real connection is attempted
vi.mock("ioredis", () => {
  const pipeline = {
    zremrangebyscore: () => pipeline,
    zadd: () => pipeline,
    zcard: () => pipeline,
    expire: () => pipeline,
    exec: mockSlidingWindow,
  }
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      pipeline: () => pipeline,
    })),
  }
})

describe("checkAuthRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDevelopment.value = false
    mockIsE2E.value = false
    mockSlidingWindow.mockResolvedValue([
      [null, 0], // zremrangebyscore
      [null, 1], // zadd
      [null, 1], // zcard (count = 1, under limit)
      [null, 1], // expire
    ])
  })

  it("should bypass limits in development mode", async () => {
    mockIsDevelopment.value = true

    const req = new Request("http://localhost/api/auth/signin")
    const result = await checkAuthRateLimit(req, "127.0.0.1")

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(999)
  })

  it("should allow request when under the rate limit", async () => {
    const req = new Request("http://localhost/api/auth/signin", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    })

    const result = await checkAuthRateLimit(req, "1.2.3.4")

    expect(result.success).toBe(true)
  })

  it("should block request when limit is exceeded", async () => {
    mockSlidingWindow.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 6], // zcard = 6, over AUTH_LIMIT (5)
      [null, 1],
    ])

    const req = new Request("http://localhost/api/auth/signin", {
      headers: { "x-forwarded-for": "5.6.7.8" },
    })

    const result = await checkAuthRateLimit(req, "5.6.7.8")

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.errorMessage).toContain("Too many login attempts")
  })
})
