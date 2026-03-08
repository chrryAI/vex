import type { Context, Next } from "hono"
import { maskIP, serverPlausibleEvent } from "../../lib/analytics"

export const apiAnalyticsMiddleware = async (c: Context, next: Next) => {
  const start = performance.now()
  const path = c.req.path
  const method = c.req.method

  // Get IP for privacy-preserving analytics (will be hashed)
  const ip =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0] ||
    c.req.header("x-real-ip") ||
    "unknown"

  await next()

  const duration = Math.round(performance.now() - start)
  const status = c.res.status

  // Log API Request Duration
  serverPlausibleEvent({
    name: "API Request",
    u: path,
    domain: "chrry.dev",
    props: {
      method,
      status,
      duration_ms: duration,
      path,
      ip_hash: maskIP(ip), // Privacy-preserving IP hash
    },
  })
}
