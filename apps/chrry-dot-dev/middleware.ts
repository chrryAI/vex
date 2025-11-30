import { getSlugFromPathname } from "chrry/utils"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { v4 as uuidv4 } from "uuid"
import createIntlMiddleware from "next-intl/middleware"
import { locales, defaultLocale } from "chrry/locales"

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

const staticPatterns = [
  "/_next",
  "/favicon.ico",
  "/manifests",
  "/manifest.webmanifest",
  "/sw.js",
  "/icons",
  "/images",
  "/logo",
  "/icons",
  "/sounds",
  "/video",
  "/((?!_next|favicon.ico|manifest.webmanifest|sw.js|icon-|blob\.mp4|kitasaku\.mp3|birds\.mp3|timer-end\.mp3|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.webp).*)",
]

const intlMiddleware = createIntlMiddleware({
  // A list of all locales that are supported
  locales: locales as string[],
  // Used when no locale matches
  defaultLocale: defaultLocale,
  // Don't use a locale prefix for the default locale
  localePrefix: "as-needed",
})

const handleIntlRequest = (request: NextRequest) => {
  return intlMiddleware(request as any)
}

// TODO: Add dynamic store domain loading via API endpoint
// For now, use static origins to avoid Edge runtime issues with Prisma/bcrypt
function getAllowedOrigins(): RegExp[] {
  return STATIC_ALLOWED_ORIGINS
}

function setCorsHeaders(response: { headers: Headers }, request: NextRequest) {
  const origin = request.headers.get("origin")

  // Get allowed origins
  const allowedOrigins = getAllowedOrigins()

  if (origin && allowedOrigins.some((pattern) => pattern.test(origin))) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.set("Vary", "Origin")
  } else if (process.env.NODE_ENV === "development") {
    // Allow all origins in development for testing
    response.headers.set("Access-Control-Allow-Origin", "*")
  } else {
    // Production: only allow chrry.ai for unmatched origins
    response.headers.set("Access-Control-Allow-Origin", "https://chrry.ai")
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  )
  response.headers.set(
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
  response.headers.set(
    "Access-Control-Max-Age",
    process.env.NODE_ENV === "development" ? "0" : "86400", // Disable in dev, 24h in prod
  )
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle OPTIONS preflight requests FIRST (before any other checks)
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 200 })
    setCorsHeaders(response, request)
    return response
  }

  if (staticPatterns.some((pattern) => pathname.startsWith(pattern))) {
    const response = NextResponse.next()
    setCorsHeaders(response, request)
    return response
  }

  const response = handleIntlRequest(request)
  setCorsHeaders(response, request)

  // Add pathname to headers for app detection
  response.headers.set("x-pathname", pathname)

  const slug = getSlugFromPathname(pathname)

  // Handle route detection for app/store routing
  if (slug.appSlug) {
    response.headers.set("x-app-slug", slug.appSlug)
    response.headers.set("x-store-slug", slug.storeSlug)
    response.headers.set("x-route-type", "store-app")
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

  const searchParams = request.nextUrl.searchParams

  // Set fingerprint cookie if not already set
  const existingFingerprintCookie = request.cookies.get("fingerprint")?.value
  const fingerprintUrl = searchParams.get("fp")

  const chrryUrl =
    searchParams.get("chrryUrl") || request.headers.get("x-chrry-url")

  chrryUrl && response.headers.set("x-chrry-url", chrryUrl)

  const fingerprint = request.headers.get("x-fp") || fingerprintUrl || uuidv4()
  if (!existingFingerprintCookie && fingerprint) {
    response.cookies.set("fingerprint", fingerprint, {
      httpOnly: false,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
      path: "/",
    })
  }

  // Pass fingerprint to API via header (for cross-domain requests)
  const fingerprintToPass = existingFingerprintCookie || uuidv4()
  response.headers.set("x-fp", fingerprintToPass)

  // Extract path segments to check for reserved paths
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}\//, "/")
  const segments = pathWithoutLocale.split("/").filter(Boolean)

  // If first or second segment is a reserved path, skip the [id]/[slug] route
  // by continuing with normal routing (don't match the dynamic route)
  if (
    segments.length >= 1 &&
    segments[0] &&
    RESERVED_PATHS.includes(segments[0])
  ) {
    // This is a reserved client-side route - let it pass through normally
    const response = handleIntlRequest(request)
    setCorsHeaders(response, request)
    response.headers.set("x-pathname", pathname)
    response.headers.set("x-route-type", "client-side")
    return response
  }

  if (
    segments.length >= 2 &&
    segments[1] &&
    RESERVED_PATHS.includes(segments[1])
  ) {
    // Second segment is reserved (e.g., /en/threads or /store/threads)
    const response = handleIntlRequest(request)
    setCorsHeaders(response, request)
    response.headers.set("x-pathname", pathname)
    response.headers.set("x-route-type", "client-side")
    return response
  }

  // API routes: only add CORS
  if (pathname.startsWith("/api")) {
    const response = NextResponse.next()
    setCorsHeaders(response, request)
    chrryUrl && response.headers.set("x-chrry-url", chrryUrl)
    return response
  }
  return response
}

// Match all routes including API routes for CORS
export const config = {
  // Match all request paths except for the ones starting with:
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - Image files (.png, .jpg, etc.)
  // Include API routes and static assets (icons, images, logos) for CORS headers
  matcher: [
    "/(en|de|fr|ja|ko|pt|es|zh|nl|tr)/:path*",
    "/((?!_next/static|_next/image|manifest.webmanifest|sw.js|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.webp|.*\\.ico).*)",
    "/api/:path*",
    "/icons/:path*",
    "/images/:path*",
    "/logo/:path*",
  ],
}
