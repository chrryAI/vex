import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { securityHeadersMiddleware } from "../hono/middleware/securityHeaders"

const app = new Hono()
app.use("*", securityHeadersMiddleware)

app.get("/", (c) => c.text("Home"))
app.get("/api/test", (c) => c.json({ ok: true }))
app.get("/favicon.ico", (c) => c.text("Icon"))

describe("Security Headers Middleware", () => {
  it("should set basic security headers", async () => {
    const res = await app.request("/api/test")
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(res.headers.get("X-Frame-Options")).toBe("DENY")
    expect(res.headers.get("X-XSS-Protection")).toBe("1; mode=block")
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    )
  })

  it("should set strict CSP for API routes", async () => {
    const res = await app.request("/api/test")
    const csp = res.headers.get("Content-Security-Policy")
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it("should set relaxed CSP for root path", async () => {
    const res = await app.request("/")
    const csp = res.headers.get("Content-Security-Policy")
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
  })

  it("should set relaxed CSP for favicon", async () => {
    const res = await app.request("/favicon.ico")
    const csp = res.headers.get("Content-Security-Policy")
    expect(csp).toContain("default-src 'self'")
  })

  it("should remove X-Powered-By header", async () => {
    const res = await app.request("/api/test")
    expect(res.headers.get("X-Powered-By")).toBe(null)
  })
})
