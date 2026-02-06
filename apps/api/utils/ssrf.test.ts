import { describe, it, expect } from "bun:test"
import { validateUrl, getSafeUrl } from "./ssrf"

describe("validateUrl / getSafeUrl", () => {
  it("should allow public URLs", async () => {
    // We use a well-known public domain that is unlikely to fail DNS
    const result = await getSafeUrl("https://www.google.com")
    expect(result.safeUrl).toBe("https://www.google.com")
    expect(result.originalHost).toBe("www.google.com")
  })

  it("should reject private IPs", async () => {
    // These are not explicitly allowed even in dev (only localhost/127.0.0.1 are allowed in dev)
    await expect(getSafeUrl("http://10.0.0.1")).rejects.toThrow(
      "Access to private IP",
    )
    await expect(getSafeUrl("http://192.168.1.1")).rejects.toThrow(
      "Access to private IP",
    )
    await expect(getSafeUrl("http://169.254.169.254")).rejects.toThrow(
      "Access to private IP",
    )
  })

  it("should allow localhost in dev/test environment", async () => {
    // Assumes isProduction is false in this test environment
    const result = await getSafeUrl("http://localhost")
    expect(result.safeUrl).toBe("http://localhost")
    expect(result.originalHost).toBe("localhost")
  })

  it("should reject invalid protocols", async () => {
    await expect(getSafeUrl("ftp://example.com")).rejects.toThrow(
      "Invalid protocol",
    )
    await expect(getSafeUrl("file:///etc/passwd")).rejects.toThrow(
      "Invalid protocol",
    )
  })

  it("should reject invalid URLs", async () => {
    await expect(getSafeUrl("not-a-url")).rejects.toThrow("Invalid URL format")
  })

  it("should resolve HTTP URL to IP", async () => {
    // This depends on DNS, so we use a stable public domain
    const result = await getSafeUrl("http://www.google.com")
    // Should return an IP-based URL
    // e.g., http://142.250.x.x/
    expect(result.safeUrl).toMatch(/^http:\/\/[\d\.]+(\/|$)/)
    expect(result.originalHost).toBe("www.google.com")
  })
})
