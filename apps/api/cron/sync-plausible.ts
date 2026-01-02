import { db } from "@repo/db"
import * as schema from "@repo/db/src/schema"
import * as dotenv from "dotenv"

// Load environment variables
dotenv.config()

/**
 * Plausible Analytics Sync
 * Fetches comprehensive data from Plausible and stores in DB
 * Grape reads from DB via getAnalyticsContext()
 */

interface PlausibleResult {
  visitors: number
  pageviews?: number
  bounce_rate?: number
  visit_duration?: number
  visits?: number
  views_per_visit?: number
  events?: number
  conversion_rate?: number
}

interface PlausibleBreakdownResult {
  dimensions: string[]
  metrics: PlausibleResult
}

export async function syncPlausibleAnalytics() {
  const PLAUSIBLE_API_KEY = process.env.PLAUSIBLE_API_KEY
  const PLAUSIBLE_SITE_ID = process.env.PLAUSIBLE_SITE_ID || "chrry.ai"
  const PLAUSIBLE_HOST = process.env.PLAUSIBLE_HOST || "https://plausible.io" // Self-hosted or cloud

  if (!PLAUSIBLE_API_KEY) {
    console.log("⚠️ PLAUSIBLE_API_KEY not set - skipping analytics sync")
    return
  }

  console.log("📊 Fetching comprehensive Plausible analytics...")
  console.log(`   Host: ${PLAUSIBLE_HOST}`)
  console.log(`   Site ID: ${PLAUSIBLE_SITE_ID}`)

  try {
    // Helper function to fetch from Plausible API
    const fetchPlausible = async (body: any) => {
      const response = await fetch(`${PLAUSIBLE_HOST}/api/v1/stats/breakdown`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PLAUSIBLE_API_KEY}`,
        },
      })

      // For v1 API, use query params
      const url = new URL(`${PLAUSIBLE_HOST}/api/v1/stats/aggregate`)
      url.searchParams.append("site_id", PLAUSIBLE_SITE_ID)
      url.searchParams.append("period", "7d")
      if (body.metrics) {
        url.searchParams.append("metrics", body.metrics.join(","))
      }

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${PLAUSIBLE_API_KEY}`,
        },
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Plausible API error: ${res.status} - ${errorText}`)
      }

      return res.json()
    }

    // Helper for breakdown queries
    const fetchBreakdown = async (property: string) => {
      const url = new URL(`${PLAUSIBLE_HOST}/api/v1/stats/breakdown`)
      url.searchParams.append("site_id", PLAUSIBLE_SITE_ID)
      url.searchParams.append("period", "7d")
      url.searchParams.append("property", property)
      url.searchParams.append("metrics", "visitors,pageviews,bounce_rate")
      url.searchParams.append("limit", "10")

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${PLAUSIBLE_API_KEY}`,
        },
      })

      if (!res.ok) return null
      const result = await res.json()
      return result
    }

    // 1. Fetch aggregate stats
    const aggregateData = await fetchPlausible({
      metrics: [
        "visitors",
        "pageviews",
        "bounce_rate",
        "visit_duration",
        "visits",
        "views_per_visit",
      ],
    })

    const aggregate = aggregateData.results

    // 2. Fetch top pages
    const pagesData = await fetchBreakdown("event:page")
    const topPages = pagesData?.results?.map((r: any) => ({
      page: r.page,
      visitors: r.visitors,
      pageviews: r.pageviews || 0,
      bounce_rate: r.bounce_rate || 0,
    }))

    // 3. Fetch traffic sources
    const sourcesData = await fetchBreakdown("visit:source")
    const sources = sourcesData?.results?.map((r: any) => ({
      source: r.source || "Direct / None",
      visitors: r.visitors,
      bounce_rate: r.bounce_rate || 0,
    }))

    // 4. Fetch countries
    const countriesData = await fetchBreakdown("visit:country")
    const countries = countriesData?.results?.map((r: any) => ({
      country: r.country,
      visitors: r.visitors,
    }))

    // 5. Fetch devices
    const devicesData = await fetchBreakdown("visit:device")
    const totalVisitors = aggregate.visitors.value
    const devices = devicesData?.results?.map((r: any) => ({
      device: r.device,
      visitors: r.visitors,
      percentage: Math.round((r.visitors / totalVisitors) * 100),
    }))

    // 6. Fetch browsers
    const browsersData = await fetchBreakdown("visit:browser")
    const browsers = browsersData?.results?.map((r: any) => ({
      browser: r.browser,
      visitors: r.visitors,
      percentage: Math.round((r.visitors / totalVisitors) * 100),
    }))

    // 7. Fetch goal conversions (top 10 goals)
    // Goals need special handling - use event:goal property with events metric
    const goalsUrl = new URL(`${PLAUSIBLE_HOST}/api/v1/stats/breakdown`)
    goalsUrl.searchParams.append("site_id", PLAUSIBLE_SITE_ID)
    goalsUrl.searchParams.append("period", "7d")
    goalsUrl.searchParams.append("property", "event:goal")
    goalsUrl.searchParams.append("metrics", "visitors,events") // conversion_rate not supported in v1
    goalsUrl.searchParams.append("limit", "10")

    const goalsRes = await fetch(goalsUrl.toString(), {
      headers: { Authorization: `Bearer ${PLAUSIBLE_API_KEY}` },
    })

    const goalsData = goalsRes.ok ? await goalsRes.json() : null
    console.log(
      "🎯 Goals data from Plausible:",
      JSON.stringify(goalsData, null, 2),
    )

    const goals = goalsData?.results?.map((r: any) => ({
      goal: r.goal,
      visitors: r.visitors,
      events: r.events || r.visitors,
      conversion_rate: r.conversion_rate || 0,
    }))

    console.log("🎯 Processed goals:", JSON.stringify(goals, null, 2))

    // Compile all stats
    const stats = {
      // Aggregate metrics
      visitors: aggregate.visitors.value,
      pageviews: aggregate.pageviews.value,
      bounce_rate: aggregate.bounce_rate.value,
      visit_duration: aggregate.visit_duration.value,
      visits: aggregate.visits.value,
      views_per_visit: aggregate.views_per_visit.value,

      // Detailed breakdowns
      topPages,
      sources,
      countries,
      devices,
      browsers,
      goals,

      period: "7d",
      lastSynced: new Date().toISOString(),
    }

    // Upsert into DB
    const result = await db
      .insert(schema.analyticsSites)
      .values({
        domain: PLAUSIBLE_SITE_ID,
        name: "Chrry Platform",
        timezone: "UTC",
        trackingId: `plausible_${PLAUSIBLE_SITE_ID}`,
        isPublic: false,
        stats,
      })
      .onConflictDoUpdate({
        target: schema.analyticsSites.domain,
        set: {
          stats,
          updatedOn: new Date(),
        },
      })
      .returning()

    console.log(`🔥 ~ syncPlausibleAnalytics ~ result:`, result)
    console.log("✅ Comprehensive analytics synced to DB:")
    console.log(`   Visitors: ${stats.visitors.toLocaleString()}`)
    console.log(`   Pageviews: ${stats.pageviews.toLocaleString()}`)
    console.log(`   Bounce Rate: ${Math.round(stats.bounce_rate)}%`)
    console.log(`   Avg Duration: ${Math.round(stats.visit_duration)}s`)
    console.log(`   Top Pages: ${topPages?.length || 0}`)
    console.log(`   Sources: ${sources?.length || 0}`)
    console.log(`   Countries: ${countries?.length || 0}`)
    console.log(`   Goals: ${goals?.length || 0}`)

    return stats
  } catch (error) {
    console.error("❌ Plausible sync failed:", error)
    throw error
  }
}

// Run directly
syncPlausibleAnalytics()
  .then(() => {
    console.log("✅ Sync complete")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Sync failed:", error)
    process.exit(1)
  })
