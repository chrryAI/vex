import dns from "node:dns/promises"

const getEnv = () => {
  let processEnv: Record<string, string | undefined> = {}
  if (typeof process !== "undefined" && "env" in process)
    processEnv = process.env || {}

  let importMetaEnv: Record<string, any> = {}
  if (typeof import.meta !== "undefined") {
    // @ts-ignore
    importMetaEnv = import.meta.env || {}
  }

  return {
    ...processEnv,
    ...importMetaEnv,
  }
}

const isProduction =
  getEnv().NODE_ENV === "production" || getEnv().VITE_NODE_ENV === "production"

function isPrivateIP(ip: string): boolean {
  // IPv4 checks
  if (ip.includes(".")) {
    const parts = ip.split(".").map(Number)
    if (parts.length !== 4) return false

    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true
    // 169.254.0.0/16 (Link-local)
    if (parts[0] === 169 && parts[1] === 254) return true
    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true

    return false
  }

  // IPv6 checks
  if (ip.includes(":")) {
    const normalizedIP = ip.toLowerCase()

    // ::1/128 (Loopback)
    if (normalizedIP === "::1" || normalizedIP === "0:0:0:0:0:0:0:1")
      return true
    // fc00::/7 (Unique Local)
    if (normalizedIP.startsWith("fc") || normalizedIP.startsWith("fd"))
      return true
    // fe80::/10 (Link Local)
    if (
      normalizedIP.startsWith("fe8") ||
      normalizedIP.startsWith("fe9") ||
      normalizedIP.startsWith("fea") ||
      normalizedIP.startsWith("feb")
    )
      return true

    return false
  }

  return false
}

export async function validateUrl(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch (e) {
    throw new Error("Invalid URL format")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid protocol: only http and https are allowed")
  }

  // Allow localhost in non-production environments
  if (
    !isProduction &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
  ) {
    return
  }

  // If hostname is an IP, check it directly
  if (isPrivateIP(parsed.hostname)) {
    throw new Error(`Access to private IP ${parsed.hostname} denied`)
  }

  // Resolve hostname
  try {
    const { address } = await dns.lookup(parsed.hostname)

    if (isPrivateIP(address)) {
      throw new Error(
        `Access to private IP ${address} (resolved from ${parsed.hostname}) denied`,
      )
    }
  } catch (error: any) {
    // If we threw the error above, rethrow it
    if (error.message.includes("Access to private IP")) {
      throw error
    }
    // If DNS lookup failed, we probably can't fetch it anyway, but it's not strictly an SSRF violation.
    // However, it's safer to fail.
    throw new Error(
      `DNS lookup failed for ${parsed.hostname}: ${error.message}`,
    )
  }
}
