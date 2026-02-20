import { describe, expect, it } from "vitest"
import { isPrivateIP } from "./ssrf"

describe("isPrivateIP", () => {
  // IPv4 Private Ranges
  it("should detect 127.0.0.0/8 (Loopback)", () => {
    expect(isPrivateIP("127.0.0.1")).toBe(true)
    expect(isPrivateIP("127.255.255.255")).toBe(true)
  })

  it("should detect 10.0.0.0/8 (Private)", () => {
    expect(isPrivateIP("10.0.0.1")).toBe(true)
    expect(isPrivateIP("10.255.255.255")).toBe(true)
  })

  it("should detect 172.16.0.0/12 (Private)", () => {
    expect(isPrivateIP("172.16.0.1")).toBe(true)
    expect(isPrivateIP("172.31.255.255")).toBe(true)
    // Public range
    expect(isPrivateIP("172.15.0.1")).toBe(false)
    expect(isPrivateIP("172.32.0.1")).toBe(false)
  })

  it("should detect 192.168.0.0/16 (Private)", () => {
    expect(isPrivateIP("192.168.0.1")).toBe(true)
    expect(isPrivateIP("192.168.255.255")).toBe(true)
  })

  it("should detect 169.254.0.0/16 (Link-local)", () => {
    expect(isPrivateIP("169.254.1.1")).toBe(true)
  })

  it("should detect 0.0.0.0/8 (Current network)", () => {
    expect(isPrivateIP("0.0.0.0")).toBe(true)
  })

  it("should detect 100.64.0.0/10 (CGNAT)", () => {
    expect(isPrivateIP("100.64.0.1")).toBe(true)
    expect(isPrivateIP("100.127.255.255")).toBe(true)
    // Public range
    expect(isPrivateIP("100.63.0.1")).toBe(false)
    expect(isPrivateIP("100.128.0.1")).toBe(false)
  })

  // IPv6
  it("should detect IPv6 Loopback", () => {
    expect(isPrivateIP("::1")).toBe(true)
    expect(isPrivateIP("0:0:0:0:0:0:0:1")).toBe(true)
  })

  it("should detect IPv6 Unique Local (fc00::/7)", () => {
    expect(isPrivateIP("fc00::1")).toBe(true)
    expect(isPrivateIP("fd00::1")).toBe(true)
  })

  it("should detect IPv6 Link Local (fe80::/10)", () => {
    expect(isPrivateIP("fe80::1")).toBe(true)
    expect(isPrivateIP("febf::1")).toBe(true)
    // Public
    expect(isPrivateIP("fec0::1")).toBe(false)
  })

  // IPv4-mapped IPv6
  it("should detect IPv4-mapped IPv6 addresses", () => {
    // ::ffff:127.0.0.1
    expect(isPrivateIP("::ffff:127.0.0.1")).toBe(true)
    // ::ffff:7f00:0001 (Hex for 127.0.0.1)
    expect(isPrivateIP("::ffff:7f00:0001")).toBe(true)
    // ::ffff:c0a8:0101 (Hex for 192.168.1.1)
    expect(isPrivateIP("::ffff:c0a8:0101")).toBe(true)

    // Public IPv4 mapped
    // 8.8.8.8 -> 0808:0808
    expect(isPrivateIP("::ffff:8.8.8.8")).toBe(false)
    expect(isPrivateIP("::ffff:0808:0808")).toBe(false)
  })

  // Public IPs
  it("should allow public IPs", () => {
    expect(isPrivateIP("8.8.8.8")).toBe(false) // Google DNS
    expect(isPrivateIP("1.1.1.1")).toBe(false) // Cloudflare DNS
    expect(isPrivateIP("142.250.187.238")).toBe(false) // Google.com
    expect(isPrivateIP("2607:f8b0:4006:80e::200e")).toBe(false) // Google IPv6
  })
})
