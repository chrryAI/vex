import { NextRequest } from "next/server"
import app from "../../../hono"

// Forward POST /api/createCreditPurchase requests to Hono
export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const path = "/createCreditPurchase" + url.search

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
