import type { Context, Next } from "hono"

export const securityHeadersMiddleware = async (c: Context, next: Next) => {
  await next()

  // Remove X-Powered-By if present
  if (c.res?.headers) {
    c.res.headers.delete("X-Powered-By")
  }

  // Add security headers
  c.header("X-Content-Type-Options", "nosniff")
  c.header("X-Frame-Options", "DENY")
  c.header("X-XSS-Protection", "1; mode=block")
  c.header("Referrer-Policy", "strict-origin-when-cross-origin")

  if (process.env.NODE_ENV === "production") {
    c.header(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    )
  }

  const path = c.req.path

  // Basic CSP for API (Strict)
  let csp =
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';"

  // Relax CSP for landing page (root path) which uses inline styles/scripts
  if (path === "/" || path === "/favicon.ico") {
    csp =
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https://minio.chrry.dev; font-src 'self' data:; connect-src 'self';"
  }

  c.header("Content-Security-Policy", csp)
}
