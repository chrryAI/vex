import { NextRequest } from "next/server"
import app from "../../../hono"

// Forward GET /api/user requests to Hono
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/user" + url.search

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

// Forward PATCH /api/user requests to Hono
export async function PATCH(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/user" + url.search

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

// Forward DELETE /api/user requests to Hono
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/user" + url.search

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
