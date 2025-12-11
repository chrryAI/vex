import app from "../../../../hono"

// Forward all /api/auth/* requests to Hono Better Auth handler
export async function GET(request: Request) {
  const url = new URL(request.url)

  console.log("🔵 Next.js forwarding auth request to Hono:", url.href)

  return app.fetch(request)
}

export async function POST(request: Request) {
  const url = new URL(request.url)

  console.log("🔵 Next.js forwarding auth request to Hono:", url.href)

  return app.fetch(request)
}
