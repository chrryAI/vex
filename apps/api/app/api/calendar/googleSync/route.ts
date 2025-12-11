import { NextRequest } from "next/server"
import app from "../../../../hono"

// Forward POST /api/calendar/googleSync requests to Hono (import from Google)
export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/calendar/googleSync" + url.search

  // Manually create headers to ensure cookies are included
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    headers.set(key, value)
  })

  const honoRequest = new Request(new URL(path, url.origin), {
    method: request.method,
    headers: headers,
    body: request.body,
    duplex: "half",
  } as RequestInit)

  return await app.fetch(honoRequest)
}

// Forward PUT /api/calendar/googleSync requests to Hono (export to Google)
export async function PUT(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/calendar/googleSync" + url.search

  // Manually create headers to ensure cookies are included
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    headers.set(key, value)
  })

  const honoRequest = new Request(new URL(path, url.origin), {
    method: request.method,
    headers: headers,
    body: request.body,
    duplex: "half",
  } as RequestInit)

  return await app.fetch(honoRequest)
}
