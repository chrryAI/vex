import type { Context, Next } from "hono"
import { validate } from "uuid"

// Static allowed origins (always allowed)
const STATIC_ALLOWED_ORIGINS = [
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  /^tauri:\/\/localhost$/, // Tauri desktop app
  /^https?:\/\/(.*\.)?localhost(:\d+)?$/, // Allow localhost with optional port and subdomain
  /^https?:\/\/(.*\.)?askvex\.com$/,
  /^https?:\/\/(.*\.)?chrry\.dev$/,
  /^https?:\/\/(.*\.)?chrry\.ai$/,
  /^https?:\/\/(.*\.)?chrry\.store$/,
]

export const isCI = process.env.VITE_CI || process.env.CI

export const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.VITE_NODE_ENV === "production"

export const isDevelopment = !isProduction

/**
 * Checks if the origin is trusted for credentialed requests.
 * @param origin The Origin header value
 */
export function isTrustedOrigin(origin: string): boolean {
  // Use static origins to avoid Edge runtime issues with Prisma/bcrypt
  // TODO: Add dynamic store domain loading via API endpoint
  if (STATIC_ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))) {
    return true
  }

  if (isDevelopment) {
    try {
      const url = new URL(origin)
      const hostname = url.hostname
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.startsWith("192.168.")
      ) {
        return true
      }
    } catch {
      // Invalid origin URL
      return false
    }
  }

  // Production: allow cross-domain requests between chrry domains
  try {
    const hostname = new URL(origin).hostname
    return (
      hostname.endsWith(".chrry.ai") ||
      hostname.endsWith(".chrry.dev") ||
      hostname.endsWith(".chrry.store")
    )
  } catch {
    return false
  }
}

function setCommonHeaders(c: Context) {
  c.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  )
  c.header(
    "Access-Control-Allow-Headers",
    [
      "Content-Type",
      "Authorization",
      "x-screen-width",
      "x-screen-height",
      "x-timezone",
      "x-device-id",
      "x-fp",
      "x-app-slug",
      "x-store-slug",
      "x-route-type",
      "x-source",
      "x-pathname",
      "x-locale",
      "x-app-id",
      "x-chrry-url",
    ].join(", "),
  )
  c.header(
    "Access-Control-Max-Age",
    isDevelopment ? "0" : "86400", // Disable in dev, 24h in prod
  )
}

function setCorsHeaders(c: Context) {
  const origin = c.req.header("origin")

  if (origin && isTrustedOrigin(origin)) {
    c.header("Access-Control-Allow-Origin", origin)
    c.header("Access-Control-Allow-Credentials", "true")
    c.header("Vary", "Origin")
    setCommonHeaders(c)
    return
  }

  // Fallbacks for untrusted or missing origins
  if (isDevelopment) {
    // Allow all other origins in development (no credentials)
    c.header("Access-Control-Allow-Origin", "*")
  } else if (!origin) {
    // No origin header (Tauri desktop apps, native apps, etc.)
    // Allow these requests - they're not browser-based CORS requests
    c.header("Access-Control-Allow-Origin", "*")
  } else {
    // Production: only allow chrry.ai for unmatched origins
    c.header("Access-Control-Allow-Origin", "https://chrry.ai")
  }

  setCommonHeaders(c)
}

const _RESERVED_PATHS = [
  "threads",
  "about",
  "settings",
  "calendar",
  "u",
  "why",
  "privacy",
  "terms",
  "affiliate",
]

export const corsMiddleware = async (c: Context, next: Next) => {
  // Handle OPTIONS preflight requests FIRST (before any other checks)
  if (c.req.method === "OPTIONS") {
    setCorsHeaders(c)
    return c.text("", 200)
  }

  // Get search params - handle both absolute and relative URLs
  const url = c.req.url.startsWith("http")
    ? new URL(c.req.url)
    : new URL(c.req.url, "http://localhost")
  const searchParams = url.searchParams

  // Set fingerprint cookie if not already set
  const existingFingerprintCookie = c.req
    .header("cookie")
    ?.match(/fingerprint=([^;]+)/)?.[1]

  const fingerprint = searchParams.get("fp") || c.req.header("x-fp")

  if (!existingFingerprintCookie && fingerprint && validate(fingerprint)) {
    // Set cookie for cross-subdomain access
    // Note: Do NOT set HttpOnly=false (invalid). Omit HttpOnly to allow JS access when needed.
    // Use SameSite=None; Secure for cross-site requests in production.
    const isDev = process.env.NODE_ENV === "development"
    const cookieValue = `fingerprint=${fingerprint}; ${
      isDev ? "" : "Secure; "
    }SameSite=None; Max-Age=${60 * 60 * 24 * 365 * 10}; Path=/`

    c.header("Set-Cookie", cookieValue)
  }

  // Set CORS headers once
  setCorsHeaders(c)

  return next()
}
