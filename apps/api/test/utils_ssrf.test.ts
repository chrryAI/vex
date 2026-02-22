import dns from "node:dns/promises"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getSafeUrl, safeFetch } from "../utils/ssrf"

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(),
  },
}))

describe("SSRF Protection", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
  })

  describe("getSafeUrl", () => {
    it("should allow localhost in development", async () => {
      const result = await getSafeUrl("http://127.0.0.1")
      expect(result.safeUrl).toBe("http://127.0.0.1")
    })

    it("should block private IPs (excluding localhost)", async () => {
      await expect(getSafeUrl("http://10.0.0.1")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://172.16.0.1")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://192.168.1.1")).rejects.toThrow(
        /Access to private IP/,
      )
    })

    it("should block reserved IPs", async () => {
      await expect(getSafeUrl("http://0.0.0.0")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://192.0.2.1")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://198.51.100.1")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://203.0.113.1")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://240.0.0.1")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://255.255.255.255")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://192.0.0.1")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://198.18.0.1")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://224.0.0.1")).rejects.toThrow(
        /Access to private IP/,
      )
    })

    it("should block IPv6 reserved addresses", async () => {
      await expect(getSafeUrl("http://[::1]")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://[::]")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://[fc00::1]")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://[fe80::1]")).rejects.toThrow(
        /Access to private IP/,
      )
      await expect(getSafeUrl("http://[2001:db8::1]")).rejects.toThrow(
        /Access to private IP/,
      )
    })

    it("should block IPv4-mapped IPv6 addresses", async () => {
      // Dotted decimal: ::ffff:192.168.1.1
      await expect(getSafeUrl("http://[::ffff:192.168.1.1]")).rejects.toThrow(
        /Access to private IP/,
      )

      // Hex notation: ::ffff:c0a8:0101 (192.168.1.1)
      await expect(getSafeUrl("http://[::ffff:c0a8:0101]")).rejects.toThrow(
        /Access to private IP/,
      )

      // Mixed hex/dec notation is not standard IPv6 but worth checking if parser accepts it?
      // No, standard is either all hex (except last 32 bits can be dotted) or pure IPv6.
      // ::ffff:192.168.1.1 is standard representation.
    })

    it("should resolve hostname and block if IP is private", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({
        address: "192.168.1.1",
        family: 4,
      })

      await expect(getSafeUrl("http://internal.test")).rejects.toThrow(
        /Access to private IP/,
      )
      expect(dns.lookup).toHaveBeenCalledWith("internal.test")
    })

    it("should resolve hostname and allow if IP is public", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "8.8.8.8", family: 4 })

      const result = await getSafeUrl("http://google.com")
      expect(result.safeUrl).toBe("http://8.8.8.8/")
      expect(result.originalHost).toBe("google.com")
    })
  })

  describe("safeFetch", () => {
    it("should fetch valid public URL", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({
        address: "93.184.216.34",
        family: 4,
      })
      vi.mocked(global.fetch).mockResolvedValue(
        new Response("ok", { status: 200 }),
      )

      const res = await safeFetch("http://example.com")
      expect(res.status).toBe(200)

      const [url, options] = vi.mocked(global.fetch).mock.calls[0]
      expect(url).toBe("http://93.184.216.34/")

      // Check headers
      const headers = options.headers as Headers
      expect(headers.get("Host")).toBe("example.com")
      expect(headers.get("User-Agent")).toBe("Chrry/1.0")
    })

    it("should follow redirects to safe URLs", async () => {
      vi.mocked(dns.lookup)
        .mockResolvedValueOnce({ address: "1.1.1.1", family: 4 }) // redirector.com
        .mockResolvedValueOnce({ address: "8.8.8.8", family: 4 }) // destination.com

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: { Location: "http://destination.com" },
          }),
        )
        .mockResolvedValueOnce(new Response("ok", { status: 200 }))

      const res = await safeFetch("http://redirector.com")
      expect(res.status).toBe(200)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it("should block redirect to private IP", async () => {
      vi.mocked(dns.lookup)
        .mockResolvedValueOnce({ address: "1.1.1.1", family: 4 }) // redirector.com
        .mockResolvedValueOnce({ address: "192.168.1.1", family: 4 }) // internal

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "http://internal.test" },
        }),
      )

      await expect(safeFetch("http://redirector.com")).rejects.toThrow(
        /Access to private IP/,
      )
      expect(global.fetch).toHaveBeenCalledTimes(1) // Blocked before second fetch
    })
  })
})
