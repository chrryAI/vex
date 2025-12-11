import { NextRequest } from "next/server"
import app from "../../../hono"

// Forward /api/messages requests to Hono
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/messages" + url.search

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

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/messages" + url.search

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
