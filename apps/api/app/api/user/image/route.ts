import { NextRequest } from "next/server"
import app from "../../../../hono"

// Forward PATCH /api/user/image requests to Hono
export async function PATCH(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/user/image" + url.search

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
