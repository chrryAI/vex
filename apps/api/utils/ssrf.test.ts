import { describe, it, expect } from "bun:test"
import { validateUrl } from "./ssrf"

describe("validateUrl", () => {
  it("should allow public URLs", async () => {
    // We use a well-known public domain that is unlikely to fail DNS
    await expect(validateUrl("https://www.google.com")).resolves.toBeUndefined()
  })

  it("should reject private IPs", async () => {
    // These are not explicitly allowed even in dev (only localhost/127.0.0.1 are allowed in dev)
    await expect(validateUrl("http://10.0.0.1")).rejects.toThrow(
      "Access to private IP",
    )
    await expect(validateUrl("http://192.168.1.1")).rejects.toThrow(
      "Access to private IP",
    )
    await expect(validateUrl("http://169.254.169.254")).rejects.toThrow(
      "Access to private IP",
    )
  })

  it("should allow localhost in dev/test environment", async () => {
    // Assumes isProduction is false in this test environment
    await expect(validateUrl("http://localhost")).resolves.toBeUndefined()
    await expect(validateUrl("http://127.0.0.1")).resolves.toBeUndefined()
  })

  it("should reject invalid protocols", async () => {
    await expect(validateUrl("ftp://example.com")).rejects.toThrow(
      "Invalid protocol",
    )
    await expect(validateUrl("file:///etc/passwd")).rejects.toThrow(
      "Invalid protocol",
    )
  })

  it("should reject invalid URLs", async () => {
    await expect(validateUrl("not-a-url")).rejects.toThrow("Invalid URL format")
  })
})
