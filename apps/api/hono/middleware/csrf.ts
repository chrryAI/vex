import type { Context, Next } from "hono"
import { isTrustedOrigin } from "./cors"

/**
 * Middleware to protect against CSRF attacks by verifying the Origin header.
 *
 * Browsers automatically send the Origin header for POST/PUT/PATCH/DELETE requests.
 * If the Origin is present, we must verify it against our trusted list.
 * If the Origin is NOT trusted, we reject the request.
 *
 * Note: If the Origin header is missing, we allow the request. This is because:
 * 1. Mobile apps, backend scripts, and tools (curl) often don't send Origin.
 * 2. They are not vulnerable to browser-based CSRF in the same way (cookies not sent automatically based on browser context).
 * 3. SameSite cookies provide a first layer of defense, but Origin check provides depth.
 */
/**
 * Sanitize origin for logging to prevent log flooding and control character injection
 */
function sanitizeOriginForLogging(origin: string): string {
  // Construct regex from character codes to avoid Sonar control character warning
  // Removes: \x00-\x1F (C0 controls), \x7F (DEL), \x7F-\x9F (C1 controls)
  const controlCharsPattern = new RegExp(
    `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}]`,
    "g",
  )
  return origin
    .replace(controlCharsPattern, "") // Remove control characters
    .substring(0, 200) // Limit length to prevent log flooding
}

// Paths exempt from CSRF checks (server-to-server callbacks)
const CSRF_EXEMPT_PATHS = ["/auth/callback/apple"]

export const csrfMiddleware = async (c: Context, next: Next) => {
  const method = c.req.method

  // Only check state-changing methods
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    // Skip CSRF for server-to-server callbacks
    if (CSRF_EXEMPT_PATHS.some((path) => c.req.path.endsWith(path))) {
      return next()
    }

    const origin = c.req.header("origin")

    if (origin) {
      if (!isTrustedOrigin(origin)) {
        // Sanitize origin before logging to prevent log flooding/injection
        const sanitizedOrigin = sanitizeOriginForLogging(origin)
        console.warn("🛡️ CSRF blocked request", {
          origin: sanitizedOrigin,
          method,
          path: c.req.path,
        })
        return c.json(
          {
            error: "Forbidden",
            message: "CSRF Validation Failed: Origin not trusted",
          },
          403,
        )
      }
    }
  }

  await next()
}
