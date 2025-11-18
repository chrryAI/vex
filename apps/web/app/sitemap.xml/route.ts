import { NextRequest, NextResponse } from "next/server"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://chrry.dev"

export async function GET(request: NextRequest) {
  try {
    // Get the host from the request
    const host = request.headers.get("host") || "chrry.ai"
    const protocol = "https://"
    const fullUrl = `${protocol}${host}`

    // Fetch sitemap from API
    const apiUrl = `${API_URL}/api/sitemap?chrryUrl=${encodeURIComponent(fullUrl)}`
    const response = await fetch(apiUrl)

    if (!response.ok) {
      return new NextResponse("Sitemap not found", { status: 404 })
    }

    const xml = await response.text()

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    })
  } catch (error) {
    console.error("Error fetching sitemap:", error)
    return new NextResponse("Error generating sitemap", { status: 500 })
  }
}
