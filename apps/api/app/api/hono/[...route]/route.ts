import { NextRequest, NextResponse } from "next/server"
import app from "../../../../hono"

// Forward all requests to Hono
export async function GET(request: NextRequest) {
  return handleRequest(request)
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}

export async function PUT(request: NextRequest) {
  return handleRequest(request)
}

export async function DELETE(request: NextRequest) {
  return handleRequest(request)
}

export async function PATCH(request: NextRequest) {
  return handleRequest(request)
}

async function handleRequest(request: NextRequest) {
  // Extract the route path from the URL
  const url = new URL(request.url)
  const path = url.pathname.replace("/api/hono", "")

  console.log(`📨 Next.js catch-all forwarding to Hono: ${path}`)

  // Create a new URL with the Hono path
  const honoUrl = new URL(path + url.search, url.origin)

  // Debug: Check if cookies are present
  const cookieHeader = request.headers.get("cookie")
  console.log(`🍪 Cookie header in Next.js:`, cookieHeader ? "present" : "null")

  // Create a new Request with the Hono URL
  const honoRequest = new Request(honoUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })

  // Call Hono app
  const honoResponse = await app.fetch(honoRequest)

  // Convert Hono response to Next.js response
  return new NextResponse(honoResponse.body, {
    status: honoResponse.status,
    statusText: honoResponse.statusText,
    headers: honoResponse.headers,
  })
}
