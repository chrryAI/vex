import { Context, Next } from "hono"
import { getCookie, setCookie } from "hono/cookie"
import { validate } from "uuid"
import { getSlugFromPathname } from "chrry/utils"

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

/**
 * Middleware to set custom headers for app/store detection and fingerprinting
 * Matches the behavior of Next.js middleware
 */
export async function headersMiddleware(c: Context, next: Next) {
  const url = new URL(c.req.url)
  const pathname = url.pathname
  const searchParams = url.searchParams

  // Add pathname to headers for app detection
  c.header("x-pathname", pathname)

  // Get slug from pathname for app/store routing
  const slug = getSlugFromPathname(pathname)

  // Handle route detection for app/store routing
  if (slug.appSlug) {
    c.header("x-app-slug", slug.appSlug)
    c.header("x-store-slug", slug.storeSlug)
    c.header("x-route-type", "store-app")
  }

  // Handle chrryUrl from query params or headers
  const chrryUrl =
    decodeURIComponent(searchParams.get("chrryUrl") || "") ||
    c.req.header("x-chrry-url")

  if (chrryUrl) {
    c.header("x-chrry-url", chrryUrl)
  }

  // Set fingerprint cookie if not already set
  const existingFingerprintCookie = getCookie(c, "fingerprint")
  const fingerprint = searchParams.get("fp") || c.req.header("x-fp")

  if (!existingFingerprintCookie && fingerprint && validate(fingerprint)) {
    setCookie(c, "fingerprint", fingerprint, {
      httpOnly: false,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
      path: "/",
    })
  }

  // Extract path segments to check for reserved paths
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}\//, "/")
  const segments = pathWithoutLocale.split("/").filter(Boolean)

  // Check if first or second segment is a reserved path
  if (
    (segments.length >= 1 &&
      segments[0] &&
      RESERVED_PATHS.includes(segments[0])) ||
    (segments.length >= 2 &&
      segments[1] &&
      RESERVED_PATHS.includes(segments[1]))
  ) {
    // This is a reserved client-side route
    c.header("x-route-type", "client-side")
  }

  await next()
}
