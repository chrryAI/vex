import { NextRequest } from "next/server"
import app from "../../../hono"

// Forward POST /api/tts requests to Hono
export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/tts" + url.search

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
