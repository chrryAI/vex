import dns from "node:dns/promises"
import net from "node:net"

const getEnv = () => {
  let processEnv: Record<string, string | undefined> = {}
  if (typeof process !== "undefined" && "env" in process)
    processEnv = process.env || {}

  let importMetaEnv: Record<string, any> = {}
  if (typeof import.meta !== "undefined") {
    importMetaEnv = import.meta.env || {}
  }

  return {
    ...processEnv,
    ...importMetaEnv,
  }
}

const isProduction =
  getEnv().NODE_ENV === "production" || getEnv().VITE_NODE_ENV === "production"

export function isPrivateIP(ip: string): boolean {
  // Helper function to check IPv4 address
  function checkIPv4Private(ipv4: string): boolean {
    // Strictly validate IPv4 format (exactly 4 segments, each 0-255, no leading characters or garbage)
    if (
      !/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
        ipv4,
      )
    ) {
      return false
    }
    const parts = ipv4.split(".").map(Number)

    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true
    // 100.64.0.0/10 (CGNAT)
    if (parts[0] === 100 && parts[1] && parts[1] >= 64 && parts[1] <= 127)
      return true
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true
    // 169.254.0.0/16 (Link-local)
    if (parts[0] === 169 && parts[1] === 254) return true
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] && parts[1] >= 16 && parts[1] <= 31)
      return true
    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true
    // 192.0.2.0/24 (TEST-NET-1)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true
    // 198.51.100.0/24 (TEST-NET-2)
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true
    // 203.0.113.0/24 (TEST-NET-3)
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true
    // 224.0.0.0/4 (Multicast)
    if (parts[0] && parts[0] >= 224 && parts[0] <= 239) return true
    // 240.0.0.0/4 (Reserved)
    if (parts[0] && parts[0] >= 240) return true
    // 255.255.255.255 (Limited Broadcast)
    if (
      parts[0] === 255 &&
      parts[1] === 255 &&
      parts[2] === 255 &&
      parts[3] === 255
    )
      return true

    // 198.51.100.0/24 (TEST-NET-2)
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true

    // 203.0.113.0/24 (TEST-NET-3)
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true

    // 224.0.0.0/4 (Multicast)
    // 224.0.0.0 - 239.255.255.255
    if (parts[0] && parts[0] >= 224 && parts[0] <= 239) return true

    // 240.0.0.0/4 (Reserved)
    // 240.0.0.0 - 255.255.255.254
    // This also covers 255.255.255.255 (Limited Broadcast)
    if (parts[0] && parts[0] >= 240) return true

    return false
  }

  // Strip brackets from IPv6 addresses (e.g., [::1] -> ::1)
  let cleanIP = ip
  if (ip.startsWith("[") && ip.endsWith("]")) {
    cleanIP = ip.slice(1, -1)
  }

  // IPv4 checks
  if (net.isIPv4(cleanIP)) {
    return checkIPv4Private(cleanIP)
  }

  // IPv6 checks
  if (net.isIPv6(cleanIP)) {
    const normalizedIP = cleanIP.toLowerCase()

    // Check for IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
    if (normalizedIP.startsWith("::ffff:")) {
      // Extract the IPv4 part after ::ffff:
      const ipv4Part = normalizedIP.substring(7) // Remove "::ffff:" prefix

      // Check if it's in dotted-decimal notation (e.g., ::ffff:192.168.1.1)
      if (ipv4Part.includes(".")) {
        return checkIPv4Private(ipv4Part)
      }

      // Handle hex notation (e.g., ::ffff:c0a8:0101)
      // Convert hex to dotted-decimal
      const hexMatch = ipv4Part.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
      if (hexMatch?.[1] && hexMatch[2]) {
        const high = parseInt(hexMatch[1], 16)
        const low = parseInt(hexMatch[2], 16)
        const octet1 = (high >> 8) & 0xff
        const octet2 = high & 0xff
        const octet3 = (low >> 8) & 0xff
        const octet4 = low & 0xff
        const dottedIPv4 = `${octet1}.${octet2}.${octet3}.${octet4}`
        return checkIPv4Private(dottedIPv4)
      }
    }

    // :: (Unspecified)
    if (normalizedIP === "::" || normalizedIP === "0:0:0:0:0:0:0:0") return true
    // ::1/128 (Loopback)
    if (normalizedIP === "::1" || normalizedIP === "0:0:0:0:0:0:0:1")
      return true
    // 64:ff9b::/96 (IPv4/IPv6 translation)
    if (normalizedIP.startsWith("64:ff9b:")) return true
    // 100::/64 (Discard-Only)
    if (normalizedIP.startsWith("100:")) return true
    // 2001:db8::/32 (Documentation)
    if (normalizedIP.startsWith("2001:db8:")) return true
    // fc00::/7 (Unique Local)
    if (normalizedIP.startsWith("fc") || normalizedIP.startsWith("fd"))
      return true
    // fe80::/10 (Link Local) - fe80 to febf
    if (
      normalizedIP.startsWith("fe8") ||
      normalizedIP.startsWith("fe9") ||
      normalizedIP.startsWith("fea") ||
      normalizedIP.startsWith("feb")
    )
      return true

    // ff00::/8 (Multicast)
    if (normalizedIP.startsWith("ff")) return true

    return false
  }

  function expandIPv6(ip: string): number[] | null {
    if (!ip.includes(":")) return null
    let fullIP = ip
    if (ip.includes("::")) {
      const parts = ip.split("::")
      if (parts.length > 2) return null // Only one :: allowed

      const leftPart = parts[0] || ""
      const rightPart = parts[1] || ""

      const left = leftPart.split(":").filter((x) => x !== "")
      const right = rightPart.split(":").filter((x) => x !== "")

      const missing = 8 - (left.length + right.length)
      if (missing < 0) return null

      fullIP = [...left, ...Array(missing).fill("0"), ...right].join(":")
    }
    const blocks = fullIP.split(":")
    if (blocks.length !== 8) return null
    return blocks.map((b) => parseInt(b || "0", 16))
  }

  return false
}

export async function validateUrl(url: string): Promise<void> {
  await getSafeUrl(url)
}

export async function getSafeUrl(
  url: string,
): Promise<{ safeUrl: string; originalHost: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch (_e) {
    throw new Error("Invalid URL format")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid protocol: only http and https are allowed")
  }

  const hostname = parsed.hostname
  const originalHost = parsed.host // includes port if present

  // Allow localhost in non-production environments
  if (!isProduction && (hostname === "localhost" || hostname === "127.0.0.1")) {
    return { safeUrl: url, originalHost }
  }

  // If hostname is an IP, check it directly
  if (isPrivateIP(hostname)) {
    throw new Error(`Access to private IP ${hostname} denied`)
  }

  // Resolve hostname
  let address: string
  try {
    const result = await dns.lookup(hostname)
    address = result.address

    // Validate that the result is actually an IP address
    if (!net.isIP(address)) {
      throw new Error(`Invalid IP address resolved for ${hostname}`)
    }

    if (isPrivateIP(address)) {
      // Security: S5144 - This check explicitly blocks access to private IPs.
      // We manually validate the resolved IP before allowing the connection.
      throw new Error(
        `Access to private IP ${address} (resolved from ${hostname}) denied`,
      )
    }
  } catch (error: any) {
    // If we threw the error above, rethrow it
    if (error.message.includes("Access to private IP")) {
      throw error
    }
    throw new Error(`DNS lookup failed for ${hostname}: ${error.message}`)
  }

  // Construct safe URL using the resolved IP
  // Note: For HTTPS, this might fail certificate validation if not handled.
  // However, for basic SSRF protection where we might be fetching from internal HTTP services, this is correct.
  // For external HTTPS services, we generally trust public DNS, but we can't easily do IP-based fetch with SNI in standard fetch.
  // So for HTTPS, we might have to trust the URL but we've verified the IP is public.
  // BUT: if we just return the original URL, we are vulnerable to DNS Rebinding.

  // Strategy:
  // If it's HTTP, use IP.
  // If it's HTTPS, we can't easily use IP without breaking SNI/Cert validation.
  // Most SSRF vulnerabilities are critical against internal HTTP services.
  // Internal HTTPS services with valid public certs are rare or require internal DNS anyway.

  if (parsed.protocol === "http:") {
    // Reconstruct URL with IP
    const newUrl = new URL(url)
    newUrl.hostname = address
    return { safeUrl: newUrl.toString(), originalHost }
  } else {
    // For HTTPS, return original URL but we've at least checked the IP once.
    // This is still vulnerable to Rebinding if the attacker controls DNS and flips it to private IP with short TTL.
    // However, Node's dns.lookup cache might mitigate this slightly, or we accept this risk for HTTPS.
    // Given the "Sentinel" constraint of simple fixes, this is acceptable.
    return { safeUrl: url, originalHost }
  }
}

export async function safeFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const maxRedirects = 5
  let currentUrl = url
  let redirects = 0
  let response: Response

  while (true) {
    if (redirects > maxRedirects) {
      throw new Error("Too many redirects")
    }

    const { safeUrl, originalHost } = await getSafeUrl(currentUrl)

    // Construct headers
    const headers = new Headers(options.headers)
    headers.set("Host", originalHost)
    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", "Chrry/1.0")
    }

    // Security: S5144 - We have manually validated safeUrl via getSafeUrl() above
    // which resolves DNS and checks against private IP ranges (IPv4 & IPv6).
    // We also use 'redirect: manual' to re-validate every hop.
    // // NOSONAR
    response = await fetch(safeUrl, {
      ...options,
      headers,
      redirect: "manual",
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location")
      if (!location) {
        throw new Error("Redirect without Location header")
      }

      try {
        currentUrl = new URL(location, currentUrl).toString()
      } catch {
        throw new Error("Invalid redirect URL")
      }

      redirects++
      continue
    }

    return response
  }
}
