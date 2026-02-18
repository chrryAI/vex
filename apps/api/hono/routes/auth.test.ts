import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import authRoutes from "./auth"

// Hoisted mocks for dependencies
const { mockCheckAuthRateLimit } = vi.hoisted(() => {
  return {
    mockCheckAuthRateLimit: vi.fn(),
  }
})

// Mock rateLimiting.ts
vi.mock("../../lib/rateLimiting", () => ({
  checkAuthRateLimit: mockCheckAuthRateLimit,
}))

// Mock @repo/db
vi.mock("@repo/db", () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  getStore: vi.fn(),
  eq: vi.fn(),
  and: vi.fn(),
  gt: vi.fn(),
  db: {
    insert: vi.fn(() => ({ values: vi.fn() })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn() })) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => [{ token: "mock-token" }]),
        })),
      })),
    })),
  },
  authExchangeCodes: {},
}))

// Mock @chrryai/chrry/utils
vi.mock("@chrryai/chrry/utils", () => ({
  API_URL: "http://localhost:3000",
  isValidUsername: vi.fn(),
}))

// Mock jsonwebtoken
vi.mock("jsonwebtoken", () => ({
  sign: vi.fn(),
  verify: vi.fn(),
}))

// Mock bcrypt
vi.mock("bcrypt", () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}))

describe("Auth Routes Rate Limiting", () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
    app.route("/", authRoutes)
  })

  it("should return 429 when signup rate limit is exceeded", async () => {
    mockCheckAuthRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      errorMessage: "Too many login attempts",
    })

    const res = await app.request("/signup/password", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      }),
      headers: { "Content-Type": "application/json" },
    })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body).toEqual({
      error: "Too many attempts. Please try again later.",
    })
    expect(mockCheckAuthRateLimit).toHaveBeenCalled()
  })

  it("should return 429 when signin rate limit is exceeded", async () => {
    mockCheckAuthRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      errorMessage: "Too many login attempts",
    })

    const res = await app.request("/signin/password", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
    })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body).toEqual({
      error: "Too many attempts. Please try again later.",
    })
    expect(mockCheckAuthRateLimit).toHaveBeenCalled()
  })
})
