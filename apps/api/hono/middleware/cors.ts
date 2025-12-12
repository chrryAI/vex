import { Context, Next } from "hono"
import { getSlugFromPathname } from "@chrryai/chrry/utils"
import { validate } from "uuid"

// Static allowed origins (always allowed)
const STATIC_ALLOWED_ORIGINS = [
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  /^https?:\/\/(.*\.)?localhost(:\d+)?$/, // Allow localhost with optional port and subdomain
  /^https?:\/\/(.*\.)?askvex\.com$/,
  /^https?:\/\/(.*\.)?chrry\.dev$/,
  /^https?:\/\/(.*\.)?chrry\.ai$/,
  /^https?:\/\/(.*\.)?chrry\.store$/,
]

export const isCI = process.env.NEXT_PUBLIC_CI || process.env.CI

export const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_NODE_ENV === "production"

export const isDevelopment = !isProduction

// TODO: Add dynamic store domain loading via API endpoint
// For now, use static origins to avoid Edge runtime issues with Prisma/bcrypt
function getAllowedOrigins(): RegExp[] {
  return STATIC_ALLOWED_ORIGINS
}

function setCorsHeaders(c: Context) {
  const origin = c.req.header("origin")

  // Get allowed origins
  const allowedOrigins = getAllowedOrigins()

  if (origin && allowedOrigins.some((pattern) => pattern.test(origin))) {
    c.header("Access-Control-Allow-Origin", origin)
    c.header("Access-Control-Allow-Credentials", "true")
    c.header("Vary", "Origin")
  } else if (isDevelopment) {
    // Allow all origins in development for testing
    c.header("Access-Control-Allow-Origin", "*")
  } else {
    // Production: only allow chrry.ai for unmatched origins
    c.header("Access-Control-Allow-Origin", "https://chrry.ai")
  }

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

const RESERVED_PATHS = [
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

  // Get search params
  const url = new URL(c.req.url)
  const searchParams = url.searchParams

  // Set fingerprint cookie if not already set
  const existingFingerprintCookie = c.req
    .header("cookie")
    ?.match(/fingerprint=([^;]+)/)?.[1]

  const fingerprint = searchParams.get("fp") || c.req.header("x-fp")

  if (!existingFingerprintCookie && fingerprint && validate(fingerprint)) {
    // Set cookie using Hono's cookie helper
    const cookieValue = `fingerprint=${fingerprint}; HttpOnly=false; ${
      process.env.NODE_ENV !== "development" ? "Secure; " : ""
    }SameSite=Lax; Max-Age=${60 * 60 * 24 * 365 * 10}; Path=/`

    c.header("Set-Cookie", cookieValue)
  }

  setCorsHeaders(c)

  // Set CORS headers for all other routes
  setCorsHeaders(c)

  return next()
}
