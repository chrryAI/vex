import type { Context, Next } from "hono"
import { maskIP, serverPlausibleEvent } from "../../lib/analytics"
import { getGuest, getMember } from "../lib/auth"

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

  // Bucket duration for better analytics grouping
  const durationBucket =
    duration < 100
      ? "0-100ms"
      : duration < 500
        ? "100-500ms"
        : duration < 1000
          ? "500ms-1s"
          : duration < 3000
            ? "1-3s"
            : duration < 10000
              ? "3-10s"
              : "10s+"

  // Get user/guest for geographic data (non-blocking, fire-and-forget)
  getMember(c)
    .then(async (member) => {
      const guest = member ? undefined : await getGuest(c)
      return member || guest
    })
    .then((user) => {
      // Log API Request Duration with geographic data
      serverPlausibleEvent({
        name: "API Request",
        u: path,
        domain: "chrry.dev",
        props: {
          method,
          status,
          duration_bucket: durationBucket,
          duration_ms: duration,
          path,
          ip_hash: maskIP(ip),
          country: user?.country || undefined,
          city: user?.city || undefined,
        },
      })
    })
    .catch(() => {
      // If auth fails, still log without geographic data
      serverPlausibleEvent({
        name: "API Request",
        u: path,
        domain: "chrry.dev",
        props: {
          method,
          status,
          duration_bucket: durationBucket,
          duration_ms: duration,
          path,
          ip_hash: maskIP(ip),
        },
      })
    })
}
