import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock dependencies to prevent side effects and module loading errors
vi.mock("@repo/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    query: { apps: { findFirst: vi.fn() } },
  },
  authExchangeCodes: {},
  createUser: vi.fn(),
  getUser: vi.fn(),
  getStore: vi.fn(),
  eq: vi.fn(),
  and: vi.fn(),
  gt: vi.fn(),
}))

vi.mock("../../lib/rateLimiting", () => ({
  checkAuthRateLimit: vi.fn(),
}))

vi.mock("@chrryai/chrry/utils", () => ({
  API_URL: "http://localhost:3000",
  isValidUsername: vi.fn(),
}))

// Mock other external modules
vi.mock("bcrypt", () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}))

vi.mock("jsonwebtoken", () => ({
  sign: vi.fn(),
  verify: vi.fn(),
}))

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid"),
}))

vi.mock("hono", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual as any,
    Hono: class MockHono {
      post() {}
      get() {}
      route() {}
    }
  }
})

vi.mock("hono/cookie", () => ({
  deleteCookie: vi.fn(),
  getCookie: vi.fn(),
  setCookie: vi.fn(),
}))

describe("Auth Configuration Security", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("should throw error in production if NEXTAUTH_SECRET is missing", async () => {
    process.env.NODE_ENV = "production"
    delete process.env.NEXTAUTH_SECRET

    await expect(async () => {
      await import("./auth")
    }).rejects.toThrow("❌ NEXTAUTH_SECRET is not set in production environment")
  })

  it("should NOT throw error in production if NEXTAUTH_SECRET is present", async () => {
    process.env.NODE_ENV = "production"
    process.env.NEXTAUTH_SECRET = "secure-secret-key"

    await expect(async () => {
      await import("./auth")
    }).not.toThrow()
  })

  it("should NOT throw error in development if NEXTAUTH_SECRET is missing", async () => {
    process.env.NODE_ENV = "development"
    delete process.env.NEXTAUTH_SECRET

    await expect(async () => {
      await import("./auth")
    }).not.toThrow()
  })
})
