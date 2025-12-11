import { NextRequest } from "next/server"
import app from "../../../../hono"

// Forward GET /api/timers/:deviceId requests to Hono
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const { deviceId } = await params
  const url = new URL(request.url)
  const path = `/timers/${deviceId}` + url.search

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

// Forward PATCH /api/timers/:deviceId requests to Hono
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const { deviceId } = await params
  const url = new URL(request.url)
  const path = `/timers/${deviceId}` + url.search

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
