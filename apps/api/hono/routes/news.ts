import { Hono } from "hono"
import {
  getLatestNews,
  getNewsByCategory,
  getNewsBySource,
  searchNews,
} from "../../lib/newsFetcher"
import { checkRateLimit } from "../../lib/rateLimiting"
import { getGuest, getMember } from "../lib/auth"

export const news = new Hono()

/**
 * GET /news
 *
 * Query params:
 * - source: Filter by source (cnn, bloomberg, nyt, techcrunch)
 * - category: Filter by category (world, business, tech, sports)
 * - query: Search query
 * - limit: Number of results (default: 20)
 *
 * Examples:
 * GET /news?source=cnn&limit=10
 * GET /news?category=tech
 * GET /news?query=ai
 */
news.get("/", async (c) => {
  const member = await getMember(c)
  const guest = member ? undefined : await getGuest(c)

  if (!member && !guest) {
    return c.json(
      {
        success: false,
        error: "Unauthorized",
      },
      401,
    )
  }

  const { success } = await checkRateLimit(c.req.raw, { member, guest })

  if (!success) {
    return c.json({ error: "Too many requests" }, 429)
  }

  try {
    const source = c.req.query("source")
    const category = c.req.query("category")
    const query = c.req.query("query")
    const limit = Number.parseInt(c.req.query("limit") || "20", 10)

    let newsData

    if (query) {
      // Search news
      newsData = await searchNews(query, limit)
    } else if (source) {
      // Get news by source
      newsData = await getNewsBySource(source, limit)
    } else if (category) {
      // Get news by category
      newsData = await getNewsByCategory(category, limit)
    } else {
      // Get latest news (all sources)
      newsData = await getLatestNews(limit)
    }

    return c.json({
      success: true,
      count: newsData.length,
      news: newsData,
    })
  } catch (error) {
    console.error("❌ Error fetching news:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})
