import { NextRequest } from "next/server"
import app from "../../../../hono"

// Forward /api/messages/[id] requests to Hono
// Hono route is registered as /messages/:id, so requests to /api/messages/123 -> Hono /messages/123

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  const url = new URL(request.url)
  const path = `/messages/${id}` + url.search

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  const url = new URL(request.url)
  const path = `/messages/${id}` + url.search

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  const url = new URL(request.url)
  const path = `/messages/${id}` + url.search

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
