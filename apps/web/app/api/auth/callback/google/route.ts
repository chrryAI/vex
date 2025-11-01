import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  console.log("🔍 Google OAuth callback received:")
  console.log("📋 Full URL:", request.url)
  console.log("📋 Query params:", Object.fromEntries(searchParams.entries()))

  // Check for error
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  if (error) {
    console.error("❌ Google OAuth Error:", error)
    console.error("📋 Error description:", errorDescription)
  }

  // Let NextAuth handle it
  const { GET: nextAuthGET } = await import("../../[...nextauth]/route")
  return nextAuthGET(request, { params: { nextauth: ["callback", "google"] } })
}
