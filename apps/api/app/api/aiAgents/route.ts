import { NextRequest } from "next/server"
import app from "../../../hono"

export async function GET(request: NextRequest) {
  const honoRequest = new Request(
    new URL("/aiAgents" + request.nextUrl.search, request.url),
    {
      method: "GET",
      headers: request.headers,
    },
  )

  const honoResponse = await app.fetch(honoRequest)
  return honoResponse
}

export async function POST(request: NextRequest) {
  const honoRequest = new Request(new URL("/aiAgents", request.url), {
    method: "POST",
    headers: request.headers,
    body: request.body,
    // @ts-ignore - duplex is required for streaming bodies
    duplex: "half",
  })

  const honoResponse = await app.fetch(honoRequest)
  return honoResponse
}
