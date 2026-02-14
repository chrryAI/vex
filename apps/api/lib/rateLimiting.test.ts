import { describe, it, expect, vi, beforeEach } from "vitest"
import { checkAuthRateLimit } from "./rateLimiting"

// Hoist mocks so they can be used in vi.mock
const { mockProtect, mockIsDevelopment, mockIsE2E } = vi.hoisted(() => {
  return {
    mockProtect: vi.fn(),
    mockIsDevelopment: { value: false },
    mockIsE2E: { value: false },
  }
})

// Mock utils
vi.mock("@chrryai/chrry/utils", () => ({
  get isDevelopment() { return mockIsDevelopment.value },
  get isE2E() { return mockIsE2E.value },
  isOwner: vi.fn(),
}))

// Mock Arcjet
vi.mock("@arcjet/node", () => ({
  default: vi.fn(() => ({
    protect: mockProtect,
  })),
  slidingWindow: vi.fn(),
}))

describe("checkAuthRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDevelopment.value = false
    mockIsE2E.value = false
  })

  it("should bypass limits in development mode", async () => {
    mockIsDevelopment.value = true

    const req = new Request("http://localhost/api/auth/signin")
    const result = await checkAuthRateLimit(req)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(999)
    expect(mockProtect).not.toHaveBeenCalled()
  })

  it("should allow request when Arcjet approves", async () => {
    mockProtect.mockResolvedValueOnce({
      isDenied: () => false,
      results: [
        {
          reason: {
            isRateLimit: () => true,
            remaining: 5,
          },
        },
      ],
    })

    const req = new Request("http://localhost/api/auth/signin", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    })

    const result = await checkAuthRateLimit(req)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(5)
    expect(mockProtect).toHaveBeenCalled()
  })

  it("should block request when limit is exceeded", async () => {
    mockProtect.mockResolvedValueOnce({
      isDenied: () => true,
      results: [
        {
          reason: {
            isRateLimit: () => true,
            remaining: 0,
          },
        },
      ],
    })

    const req = new Request("http://localhost/api/auth/signin", {
      headers: { "x-forwarded-for": "5.6.7.8" },
    })

    const result = await checkAuthRateLimit(req)

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.errorMessage).toContain("Too many login attempts")
  })
})
