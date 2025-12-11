import { NextRequest } from "next/server"
import app from "../../../../../hono"

// Forward DELETE /api/threads/:id/collaborations requests to Hono
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const url = new URL(request.url)
  const path = `/threads/${id}/collaborations` + url.search

  const headers = new Headers()
  request.headers.forEach((value, key) => {
    headers.set(key, value)
  })

  const honoRequest = new Request(new URL(path, url.origin), {
    method: request.method,
    headers: headers,
  })

  return await app.fetch(honoRequest)
}
