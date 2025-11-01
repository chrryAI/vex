import { NextResponse } from "next/server"
import {
  searchNews,
  getNewsBySource,
  getNewsByCategory,
  getLatestNews,
} from "../../../lib/newsFetcher"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { checkRateLimit } from "../../../lib/rateLimiting"

/**
 * GET /api/news
 *
 * Query params:
 * - source: Filter by source (cnn, bloomberg, nyt, techcrunch)
 * - category: Filter by category (world, business, tech, sports)
 * - query: Search query
 * - limit: Number of results (default: 20)
 *
 * Examples:
 * GET /api/news?source=cnn&limit=10
 * GET /api/news?category=tech
 * GET /api/news?query=ai
 */
export async function GET(request: Request) {
  const member = await getMember()
  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 },
    )
  }

  const { success } = await checkRateLimit(request, { member, guest })

  if (!success) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const { searchParams } = new URL(request.url)

    const source = searchParams.get("source")
    const category = searchParams.get("category")
    const query = searchParams.get("query")
    const limit = parseInt(searchParams.get("limit") || "20")

    let news

    if (query) {
      // Search news
      news = await searchNews(query, limit)
    } else if (source) {
      // Get news by source
      news = await getNewsBySource(source, limit)
    } else if (category) {
      // Get news by category
      news = await getNewsByCategory(category, limit)
    } else {
      // Get latest news (all sources)
      news = await getLatestNews(limit)
    }

    return NextResponse.json({
      success: true,
      count: news.length,
      news,
    })
  } catch (error) {
    console.error("❌ Error fetching news:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
