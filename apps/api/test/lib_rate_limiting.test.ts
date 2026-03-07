import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock dependencies
vi.mock("@chrryai/chrry/utils", () => ({
  isDevelopment: false,
  isE2E: false,
  isOwner: () => false,
}))

const { zaddMock, zcardMock, expireMock, execMock, pipelineMock } = vi.hoisted(
  () => {
    const zaddMock = vi.fn().mockReturnThis()
    const zcardMock = vi.fn().mockReturnThis()
    const expireMock = vi.fn().mockReturnThis()
    const execMock = vi.fn().mockResolvedValue([null, null, 5])
    const pipelineMock = vi.fn().mockReturnValue({
      zadd: zaddMock,
      zcard: zcardMock,
      expire: expireMock,
      exec: execMock,
    })
    return {
      zaddMock,
      zcardMock,
      expireMock,
      execMock,
      pipelineMock,
    }
  },
)

vi.mock("ioredis", () => {
  class RedisMock {
    on = vi.fn()
    pipeline = pipelineMock
  }
  return { default: RedisMock }
})

import {
  checkAuthRateLimit,
  checkGenerationRateLimit,
  checkRateLimit,
} from "../lib/rateLimiting"

describe("checkAuthRateLimit Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return success when redis allows", async () => {
    execMock.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 2],
      [null, 1],
    ])

    const req = new Request("http://localhost/auth/signin", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
    })

    const result = await checkAuthRateLimit(req, "1.2.3.4")

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(3)
    expect(pipelineMock).toHaveBeenCalled()
  })

  it("should return failure when redis denies", async () => {
    execMock.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 6],
      [null, 1],
    ])

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
    execMock.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 10],
      [null, 1],
    ])

    const req = new Request("http://localhost/api/chat", { method: "POST" })
    const result = await checkRateLimit(req, {})

    expect(result.success).toBe(true)
    expect(result.isAuthenticated).toBe(false)
    expect(pipelineMock).toHaveBeenCalled()
  })

  it("should enforce limits for guests", async () => {
    execMock.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 20],
      [null, 1],
    ])

    const req = new Request("http://localhost/api/chat", { method: "POST" })
    const guest = { id: "guest-123" } as any
    const result = await checkRateLimit(req, { guest })

    expect(result.success).toBe(true)
    expect(result.isAuthenticated).toBe(true)
  })

  it("should enforce limits for members (free)", async () => {
    execMock.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 30],
      [null, 1],
    ])

    const req = new Request("http://localhost/api/chat", { method: "POST" })
    const member = { id: "user-123" } as any
    const result = await checkRateLimit(req, { member })

    expect(result.success).toBe(true)
    expect(result.isAuthenticated).toBe(true)
  })

  it("should enforce limits for pro members", async () => {
    execMock.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 100],
      [null, 1],
    ])

    const req = new Request("http://localhost/api/chat", { method: "POST" })
    const member = { id: "user-123", subscription: { plan: "pro" } } as any
    const result = await checkRateLimit(req, { member })

    expect(result.success).toBe(true)
    expect(result.isAuthenticated).toBe(true)
  })
})

describe("checkGenerationRateLimit Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should check both hourly and per-thread limits", async () => {
    execMock.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 2],
      [null, 1],
    ])

    const req = new Request("http://localhost/api/generate", { method: "POST" })
    const member = { id: "user-123" } as any
    const threadId = "thread-abc"

    const result = await checkGenerationRateLimit(req, { member, threadId })

    expect(result.success).toBe(true)
    expect(pipelineMock).toHaveBeenCalledTimes(2)
  })

  it("should return failure if any limit is denied", async () => {
    execMock
      .mockResolvedValueOnce([
        [null, 0],
        [null, 1],
        [null, 5],
        [null, 1],
      ]) // Hourly allowed
      .mockResolvedValueOnce([
        [null, 0],
        [null, 1],
        [null, 11],
        [null, 1],
      ]) // Thread denied

    const req = new Request("http://localhost/api/generate", { method: "POST" })
    const member = { id: "user-123" } as any
    const threadId = "thread-abc"

    const result = await checkGenerationRateLimit(req, { member, threadId })

    expect(result.success).toBe(false)
    expect(result.errorMessage).toContain("regenerated this title")
  })
})
