import type { Context, Next } from "hono"
import { serverPlausibleEvent } from "../../lib/analytics"

export const apiAnalyticsMiddleware = async (c: Context, next: Next) => {
  const start = performance.now()
  const path = c.req.path
  const method = c.req.method

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
    },
  })
}
