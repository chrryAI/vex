import { Context, Next } from "hono"
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
export const csrfMiddleware = async (c: Context, next: Next) => {
  const method = c.req.method

  // Only check state-changing methods
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const origin = c.req.header("origin")

    if (origin) {
      if (!isTrustedOrigin(origin)) {
        console.warn(`🛡️ CSRF blocked request from origin: ${origin}`)
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
