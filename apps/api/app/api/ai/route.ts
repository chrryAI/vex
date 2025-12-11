import { NextRequest } from "next/server"
import app from "../../../hono"

export async function POST(request: NextRequest) {
  // Forward to Hono /ai route
  const honoRequest = new Request(new URL("/ai", request.url), {
    method: "POST",
    headers: request.headers,
    body: request.body,
    duplex: "half",
  } as RequestInit)

  const honoResponse = await app.fetch(honoRequest)
  return honoResponse
}
