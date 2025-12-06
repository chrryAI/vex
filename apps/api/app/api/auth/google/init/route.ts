import { NextResponse } from "next/server"
import { URLSearchParams } from "node:url"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const searchParams = url.searchParams
  const redirect_uri = searchParams.get("redirect_uri")
  if (!redirect_uri) {
    return NextResponse.json({ error: "Missing redirect_uri" })
  }
  const extension = searchParams.get("extension")

  const params = new URLSearchParams()
  params.set("client_id", process.env.GOOGLE_WEB_CLIENT_ID!)

  params.set("redirect_uri", redirect_uri)

  params.set("response_type", "code")
  params.set("scope", "profile email")
  redirect_uri && params.set("state", redirect_uri)

  return NextResponse.json({
    params,
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  })
}
