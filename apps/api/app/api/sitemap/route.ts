import { NextRequest } from "next/server"
import app from "../../../hono"

export const dynamic = "force-dynamic"

// Forward GET /api/sitemap requests to Hono
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  // Forward to /sitemap.xml which is how we registered it in Hono
  const path = "/sitemap.xml" + url.search

  // Manually create headers to ensure cookies are included
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    headers.set(key, value)
  })

  // Add custom headers to pass info to Hono
  headers.set("x-app-id", request.headers.get("x-app-id") || "")
  headers.set("x-app-slug", request.headers.get("x-app-slug") || "")
  headers.set("x-pathname", request.headers.get("x-pathname") || "")

  const honoRequest = new Request(new URL(path, url.origin), {
    method: request.method,
    headers: headers,
  })

  return await app.fetch(honoRequest)
}
