import { NextRequest } from "next/server"
import app from "../../../../hono"

// Forward all /api/threads/:id requests to Hono
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const id = url.pathname.split("/").pop()?.split("?")[0]
  const path = `/threads/${id}` + url.search

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

export async function PATCH(request: NextRequest) {
  const url = new URL(request.url)
  const id = url.pathname.split("/").pop()?.split("?")[0]
  const path = `/threads/${id}` + url.search

  // Manually create headers to ensure cookies are included
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    headers.set(key, value)
  })

  const honoRequest = new Request(new URL(path, url.origin), {
    method: request.method,
    headers: headers,
    body: request.body,
  })

  return await app.fetch(honoRequest)
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url)
  const id = url.pathname.split("/").pop()?.split("?")[0]
  const path = `/threads/${id}` + url.search

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
