import { NextResponse } from "next/server"
import { fetchAllNews } from "../../../../lib/newsFetcher"

/**
 * Cron job to fetch news from all sources
 *
 * Setup with Vercel Cron:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/fetch-news",
 *     "schedule": "0 * * * *"  // Every hour
 *   }]
 * }
 *
 * Or call manually:
 * - GET /api/cron/fetchNews (for testing)
 * - POST /api/cron/fetchNews (for production cron)
 */

async function handleFetchNews(request: Request) {
  return NextResponse.json({
    success: true,
    message: "Maybe later",
    timestamp: new Date().toISOString(),
  })
  // try {
  //   // Verify cron secret (optional but recommended)
  //   const authHeader = request.headers.get("authorization")
  //   const cronSecret = process.env.CRON_SECRET

  //   // Only check auth if CRON_SECRET is set
  //   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  //     console.log("❌ Unauthorized: Invalid or missing authorization header")
  //     return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  //   }

  //   console.log("🗞️ Cron: Starting news fetch...")

  //   await fetchAllNews()

  //   return NextResponse.json({
  //     success: true,
  //     message: "News fetched successfully",
  //     timestamp: new Date().toISOString(),
  //   })
  // } catch (error) {
  //   console.error("❌ Cron error:", error)
  //   return NextResponse.json(
  //     {
  //       success: false,
  //       error: error instanceof Error ? error.message : "Unknown error",
  //     },
  //     { status: 500 },
  //   )
  // }
}

// Support both GET (for testing) and POST (for cron)
export async function GET(request: Request) {
  return handleFetchNews(request)
}

export async function POST(request: Request) {
  return handleFetchNews(request)
}
