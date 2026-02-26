import { describe, expect, it } from "vitest"
import { isPrivateIP } from "./ssrf"

describe("isPrivateIP", () => {
  it("should return true for private IPv4 ranges", () => {
    // 0.0.0.0/8
    expect(isPrivateIP("0.0.0.0")).toBe(true)
    expect(isPrivateIP("0.255.255.255")).toBe(true)

    // 10.0.0.0/8
    expect(isPrivateIP("10.0.0.1")).toBe(true)
    expect(isPrivateIP("10.255.255.255")).toBe(true)

    // 100.64.0.0/10 (CGNAT)
    expect(isPrivateIP("100.64.0.1")).toBe(true)
    expect(isPrivateIP("100.127.255.255")).toBe(true)
    expect(isPrivateIP("100.63.255.255")).toBe(false) // Public
    expect(isPrivateIP("100.128.0.0")).toBe(false) // Public

    // 127.0.0.0/8 (Loopback)
    expect(isPrivateIP("127.0.0.1")).toBe(true)
    expect(isPrivateIP("127.255.255.255")).toBe(true)

    // 169.254.0.0/16 (Link-local)
    expect(isPrivateIP("169.254.1.1")).toBe(true)
    expect(isPrivateIP("169.253.255.255")).toBe(false) // Public

    // 172.16.0.0/12 (Private)
    expect(isPrivateIP("172.16.0.1")).toBe(true)
    expect(isPrivateIP("172.31.255.255")).toBe(true)
    expect(isPrivateIP("172.15.255.255")).toBe(false) // Public
    expect(isPrivateIP("172.32.0.0")).toBe(false) // Public

    // 192.0.0.0/24 (IETF Protocol Assignments)
    expect(isPrivateIP("192.0.0.1")).toBe(true)

    // 192.0.2.0/24 (TEST-NET-1)
    expect(isPrivateIP("192.0.2.1")).toBe(true)

    // 192.168.0.0/16 (Private)
    expect(isPrivateIP("192.168.1.1")).toBe(true)

    // 198.51.100.0/24 (TEST-NET-2)
    expect(isPrivateIP("198.51.100.1")).toBe(true)

    // 203.0.113.0/24 (TEST-NET-3)
    expect(isPrivateIP("203.0.113.1")).toBe(true)

    // 224.0.0.0/4 (Multicast)
    expect(isPrivateIP("224.0.0.1")).toBe(true)
    expect(isPrivateIP("239.255.255.255")).toBe(true)

    // 240.0.0.0/4 (Reserved)
    expect(isPrivateIP("240.0.0.1")).toBe(true)
    expect(isPrivateIP("255.255.255.254")).toBe(true)

    // 255.255.255.255 (Limited Broadcast)
    expect(isPrivateIP("255.255.255.255")).toBe(true)
  })

  it("should return false for public IPv4 addresses", () => {
    expect(isPrivateIP("8.8.8.8")).toBe(false)
    expect(isPrivateIP("1.1.1.1")).toBe(false)
    expect(isPrivateIP("142.250.0.0")).toBe(false)
  })

  it("should return true for private IPv6 addresses", () => {
    // Unspecified
    expect(isPrivateIP("::")).toBe(true)
    expect(isPrivateIP("0:0:0:0:0:0:0:0")).toBe(true)

    // Loopback
    expect(isPrivateIP("::1")).toBe(true)
    expect(isPrivateIP("0:0:0:0:0:0:0:1")).toBe(true)

    // IPv4/IPv6 translation
    expect(isPrivateIP("64:ff9b::1")).toBe(true)

    // Discard-Only
    expect(isPrivateIP("100::1")).toBe(true)

    // Documentation
    expect(isPrivateIP("2001:db8::1")).toBe(true)

    // Unique Local
    expect(isPrivateIP("fc00::1")).toBe(true)
    expect(isPrivateIP("fd00::1")).toBe(true)

    // Link Local
    expect(isPrivateIP("fe80::1")).toBe(true)
  })

  it("should return false for public IPv6 addresses", () => {
    // Google DNS
    expect(isPrivateIP("2001:4860:4860::8888")).toBe(false)
  })

  it("should handle IPv4-mapped IPv6 addresses", () => {
    // Dotted decimal
    expect(isPrivateIP("::ffff:127.0.0.1")).toBe(true)
    expect(isPrivateIP("::ffff:192.168.1.1")).toBe(true)
    expect(isPrivateIP("::ffff:8.8.8.8")).toBe(false)

    // Hex
    expect(isPrivateIP("::ffff:7f00:0001")).toBe(true) // 127.0.0.1
    expect(isPrivateIP("::ffff:c0a8:0101")).toBe(true) // 192.168.1.1
  })

  it("should return false for dotted hostnames that start with numeric octets", () => {
    expect(isPrivateIP("100.64.example.com")).toBe(false)
    expect(isPrivateIP("192.168.example.com")).toBe(false)
    expect(isPrivateIP("10.0.0.localhost")).toBe(false)
  })

  it("should handle IPv6 CIDR boundaries correctly", () => {
    // 64:ff9b::/96
    expect(isPrivateIP("64:ff9b::")).toBe(true)
    expect(isPrivateIP("64:ff9b::ffff:ffff")).toBe(true)
    expect(isPrivateIP("64:ff9b:1::")).toBe(false) // Outside /96

    // 100::/64
    expect(isPrivateIP("100::")).toBe(true)
    expect(isPrivateIP("100::ffff:ffff:ffff:ffff")).toBe(true)
    expect(isPrivateIP("100:1::")).toBe(false) // Outside /64

    // Leading ::
    expect(isPrivateIP("::1")).toBe(true)
    expect(isPrivateIP("::ffff:127.0.0.1")).toBe(true)
  })

  it("should handle bracketed IPv6 addresses", () => {
    expect(isPrivateIP("[::1]")).toBe(true)
    expect(isPrivateIP("[2001:4860:4860::8888]")).toBe(false)
  })
})
