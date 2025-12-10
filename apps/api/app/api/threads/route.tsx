import { NextRequest } from "next/server"
import app from "../../../hono"

// Forward all /api/threads requests to Hono
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/threads" + url.search

  // Debug: Check cookies in Next.js
  const cookieHeader = request.headers.get("cookie")
  console.log(
    `🍪 Next.js /api/threads cookie:`,
    cookieHeader ? "EXISTS" : "NULL",
  )
  console.log(`🍪 Cookie value:`, cookieHeader)

  // Manually create headers to ensure cookies are included
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    headers.set(key, value)
  })

  const honoRequest = new Request(new URL(path, url.origin), {
    method: request.method,
    headers: headers,
  })

  return await app.fetch(honoRequest)
}
