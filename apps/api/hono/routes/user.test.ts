import { describe, expect, it, vi } from "vitest"

// Mock dependencies
vi.mock("node:dns/promises", () => ({
  resolve4: async (hostname: string) => {
    if (hostname === "private.local") return ["127.0.0.1"]
    return ["1.1.1.1"]
  },
  resolve6: async () => [],
}))

vi.mock("@chrryai/chrry/utils", () => ({
  isValidUsername: () => true,
}))

vi.mock("@chrryai/chrry/utils/url", () => ({
  protectedRoutes: [],
}))

vi.mock("@repo/db", () => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  getStore: vi.fn(),
  updateStore: vi.fn(),
}))

vi.mock("../../lib/captureException", () => ({
  default: vi.fn(),
}))

vi.mock("../../lib/graph/graphService", () => ({
  clearGraphDataForUser: vi.fn(),
}))

vi.mock("../../lib/minio", () => ({
  deleteFile: vi.fn(),
  upload: vi.fn(),
}))

vi.mock("../../lib/security", () => ({
  scanFileForMalware: vi.fn(),
}))

vi.mock("../lib/auth", () => ({
  getMember: vi.fn().mockResolvedValue({
    id: "user-123",
    userName: "testuser",
  }),
}))

// Import the route
import { user } from "./user"

describe("PATCH /user", () => {
  it("should reject image URLs resolving to private IPs", async () => {
    const req = new Request("http://localhost/", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: "http://private.local/image.png",
      }),
    })

    const res = await user.fetch(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Invalid image URL")
  })

  it("should accept valid image URLs", async () => {
    const req = new Request("http://localhost/", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: "http://public.com/image.png",
      }),
    })

    const res = await user.fetch(req)
    // It will try to update user next, but that might fail or succeed depending on other mocks.
    // We just want to ensure it didn't fail with "Invalid image URL"

    if (res.status === 400) {
      const body = await res.json()
      expect(body.error).not.toBe("Invalid image URL")
    } else {
      expect(res.status).not.toBe(400)
    }
  })
})
