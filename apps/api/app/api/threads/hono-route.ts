import { NextRequest } from "next/server"
import app from "../../../hono"

// Forward to Hono's /threads route
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/threads" + url.search

  const honoRequest = new Request(new URL(path, url.origin), {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })

  return await app.fetch(honoRequest)
}
