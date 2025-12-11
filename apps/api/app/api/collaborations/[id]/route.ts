import { NextRequest } from "next/server"
import app from "../../../../hono"

// Forward PATCH /api/collaborations/:id requests to Hono
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const url = new URL(request.url)
  const { id } = await params
  const path = `/collaborations/${id}` + url.search

  // Manually create headers to ensure cookies are included
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
