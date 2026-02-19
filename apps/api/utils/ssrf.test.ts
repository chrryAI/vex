import { afterAll, describe, expect, it, vi } from "vitest"
import { getSafeUrl, safeFetch } from "./ssrf"

describe("validateUrl / getSafeUrl", () => {
  it("should allow public URLs", async () => {
    // We use a well-known public domain that is unlikely to fail DNS
    const result = await getSafeUrl("https://www.google.com")
    expect(result.safeUrl).toBe("https://www.google.com")
    expect(result.originalHost).toBe("www.google.com")
  })

  it("should reject private IPs", async () => {
    // These are not explicitly allowed even in dev (only localhost/127.0.0.1 are allowed in dev)
    await expect(getSafeUrl("https://10.0.0.1")).rejects.toThrow(
      "Access to private IP",
    )
    await expect(getSafeUrl("https://192.168.1.1")).rejects.toThrow(
      "Access to private IP",
    )
    await expect(getSafeUrl("https://169.254.169.254")).rejects.toThrow(
      "Access to private IP",
    )
  })

  it("should allow localhost in dev/test environment", async () => {
    // Assumes isProduction is false in this test environment
    const result = await getSafeUrl("https://localhost")
    expect(result.safeUrl).toBe("https://localhost")
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
    // HTTP URLs should be resolved to IP addresses
    const result = await getSafeUrl("http://www.google.com") // NOSONAR - Testing HTTP to IP resolution
    // Should return an IP-based URL (e.g., http://142.250.x.x/)
    expect(result.safeUrl).toMatch(/^http:\/\/[\d.]+(\/?|$)/)
    expect(result.originalHost).toBe("www.google.com")
  })

  it("should keep HTTPS URLs as-is (for SNI/cert validation)", async () => {
    // HTTPS URLs should remain unchanged to preserve SNI
    const result = await getSafeUrl("https://www.google.com")
    expect(result.safeUrl).toBe("https://www.google.com")
    expect(result.originalHost).toBe("www.google.com")
  })

  it("should reject CGNAT IP range (100.64.0.0/10)", async () => {
    // CGNAT (Carrier-Grade NAT) addresses should be blocked
    await expect(getSafeUrl("https://100.64.0.1")).rejects.toThrow(
      "Access to private IP",
    )
    await expect(getSafeUrl("https://100.127.255.254")).rejects.toThrow(
      "Access to private IP",
    )
    await expect(getSafeUrl("https://100.100.100.100")).rejects.toThrow(
      "Access to private IP",
    )
  })

  it("should reject IPv4-mapped IPv6 addresses (dotted notation)", async () => {
    // ::ffff:192.168.1.1 format should be detected and blocked
    // NOSONAR - Intentionally testing HTTP with private IPs for security validation
    await expect(getSafeUrl("http://[::ffff:192.168.1.1]")).rejects.toThrow(
      "Access to private IP",
    )
    await expect(getSafeUrl("http://[::ffff:10.0.0.1]")).rejects.toThrow(
      "Access to private IP",
    )
    await expect(getSafeUrl("http://[::ffff:127.0.0.1]")).rejects.toThrow(
      "Access to private IP",
    )
  })

  it("should reject IPv4-mapped IPv6 addresses (hex notation)", async () => {
    // ::ffff:c0a8:0101 format (192.168.1.1 in hex) should be blocked
    // NOSONAR - Intentionally testing HTTP with private IPs for security validation
    await expect(getSafeUrl("http://[::ffff:c0a8:0101]")).rejects.toThrow(
      "Access to private IP",
    )
    // ::ffff:0a00:0001 format (10.0.0.1 in hex) should be blocked
    await expect(getSafeUrl("http://[::ffff:0a00:0001]")).rejects.toThrow(
      "Access to private IP",
    )
  })
})

describe("safeFetch", () => {
  const originalFetch = global.fetch

  afterAll(() => {
    global.fetch = originalFetch
  })

  it("should follow safe redirects", async () => {
    // Mock fetch to redirect once then succeed
    global.fetch = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString()

        if (url.includes("google.com")) {
          return new Response(null, {
            status: 301,
            headers: { Location: "https://example.com/dest" },
          })
        }

        if (url.includes("example.com")) {
          return new Response("ok", { status: 200 })
        }

        return new Response("not found", { status: 404 })
      },
    )

    const response = await safeFetch("https://google.com/source")
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("ok")
  })

  it("should block redirect to private IP", async () => {
    // Mock fetch to redirect to a private IP
    global.fetch = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString()

        if (url.includes("google.com")) {
          return new Response(null, {
            status: 301,
            headers: { Location: "http://192.168.1.1/secret" },
          })
        }

        return new Response("ok", { status: 200 })
      },
    )

    await expect(safeFetch("https://google.com/source")).rejects.toThrow(
      "Access to private IP",
    )
  })

  it("should fail after too many redirects", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(null, {
        status: 301,
        headers: { Location: "https://google.com/loop" },
      })
    })

    await expect(safeFetch("https://google.com/loop")).rejects.toThrow(
      "Too many redirects",
    )
  })
})
