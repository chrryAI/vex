import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"

// Mock dependencies for rate limiting check
vi.mock("@chrryai/chrry/utils", () => ({
  isDevelopment: false,
  isE2E: false,
  isOwner: () => false,
  isValidUsername: () => true, // used by authRoutes
  API_URL: "http://localhost",
}))

// Mock rate limiting function for route tests
vi.mock("../lib/rateLimiting", () => ({
  checkAuthRateLimit: vi.fn(),
  checkRateLimit: vi.fn(),
  checkGenerationRateLimit: vi.fn(),
}))

// Mock DB to prevent connection attempts
vi.mock("@repo/db", () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  getStore: vi.fn(),
  eq: vi.fn(),
  and: vi.fn(),
  gt: vi.fn(),
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [null]) })) })) })),
    insert: vi.fn(() => ({ values: vi.fn() })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
  },
  authExchangeCodes: {},
}))

import { checkAuthRateLimit } from "../lib/rateLimiting"
// Import routes AFTER mocking
import authRoutes from "../hono/routes/auth"

describe("Auth Route Rate Limiting Integration", () => {
  const app = new Hono()
  app.route("/auth", authRoutes)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 429 when rate limit is exceeded on /signin/password", async () => {
    // Mock checkAuthRateLimit to fail
    vi.mocked(checkAuthRateLimit).mockResolvedValue({ success: false, remaining: 0 })

    const res = await app.request("/auth/signin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "password" })
    })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body).toEqual({ error: "Too many attempts. Please try again later." })
    expect(checkAuthRateLimit).toHaveBeenCalled()
  })

  it("should return 429 when rate limit is exceeded on /signup/password", async () => {
    // Mock checkAuthRateLimit to fail
    vi.mocked(checkAuthRateLimit).mockResolvedValue({ success: false, remaining: 0 })

    const res = await app.request("/auth/signup/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "password", name: "Test" })
    })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body).toEqual({ error: "Too many attempts. Please try again later." })
    expect(checkAuthRateLimit).toHaveBeenCalled()
  })

  it("should proceed when rate limit is not exceeded", async () => {
    // Mock checkAuthRateLimit to succeed
    vi.mocked(checkAuthRateLimit).mockResolvedValue({ success: true, remaining: 5 })

    const res = await app.request("/auth/signin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "password" })
    })

    expect(res.status).not.toBe(429)
    expect(checkAuthRateLimit).toHaveBeenCalled()
  })
})
