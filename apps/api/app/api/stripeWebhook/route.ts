import { NextRequest } from "next/server"
import app from "../../../hono"

// Forward POST /api/stripeWebhook requests to Hono
export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/stripeWebhook" + url.search

  // Manually create headers
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    headers.set(key, value)
  })

  // IMPORTANT: For webhooks, we must preserve the raw body
  // Hono will read this stream to verify the Stripe signature
  const honoRequest = new Request(new URL(path, url.origin), {
    method: request.method,
    headers: headers,
    body: request.body,
    duplex: "half",
  } as RequestInit)

  return await app.fetch(honoRequest)
}
