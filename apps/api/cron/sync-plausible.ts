import {
  ALL_TRACKABLE_EVENTS,
  analyticsDomains as whiteLabels,
} from "@chrryai/chrry/utils/siteConfig"
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

interface _PlausibleResult {
  visitors: number
  pageviews?: number
  bounce_rate?: number
  visit_duration?: number
  visits?: number
  views_per_visit?: number
  events?: number
  conversion_rate?: number
}

async function syncPlausibleGoals(
  domain: string,
  apiKey: string,
  host: string,
) {
  console.log(`🎯 Syncing goals for ${domain}...`)

  try {
    // 1. Fetch current goals
    const goalsUrl = new URL(`${host}/api/v1/sites/goals`)
    goalsUrl.searchParams.append("site_id", domain)

    const res = await fetch(goalsUrl.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      console.error(`❌ Failed to fetch goals for ${domain}: ${res.status}`)
      return
    }

    const { goals: currentGoals } = await res.json()
    const existingGoalNames = new Set(
      currentGoals.map((g: any) => g.event_name),
    )

    // 2. Identify missing goals
    const missingGoals = ALL_TRACKABLE_EVENTS.filter(
      (event) => !existingGoalNames.has(event),
    )

    if (missingGoals.length === 0) {
      console.log(`✅ All ${ALL_TRACKABLE_EVENTS.length} goals already exist.`)
      return
    }

    console.log(`🚀 Creating ${missingGoals.length} missing goals...`)

    // 3. Create missing goals
    for (const eventName of missingGoals) {
      const createUrl = `${host}/api/v1/sites/goals`
      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          site_id: domain,
          goal_type: "event",
          event_name: eventName,
        }),
      })

      if (createRes.ok) {
        console.log(`   + Created goal: ${eventName}`)
      } else {
        const err = await createRes.text()
        console.error(`   - Failed to create goal ${eventName}: ${err}`)
      }
    }
  } catch (error) {
    console.error(`❌ Error syncing goals for ${domain}:`, error)
  }
}

export async function syncPlausibleAnalytics() {
  console.log(
    `🍇 Starting sync for ${whiteLabels.length} white-label domains...`,
  )

  for (const label of whiteLabels) {
    const PLAUSIBLE_SITE_ID = label.domain
    const PLAUSIBLE_API_KEY = process.env.PLAUSIBLE_API_KEY

    const PLAUSIBLE_HOST = process.env.PLAUSIBLE_HOST || "https://plausible.io" // Self-hosted or cloud

    if (!PLAUSIBLE_API_KEY) {
      console.log("⚠️ PLAUSIBLE_API_KEY not set - skipping analytics sync")
      continue // Skip to next domain
    }

    console.log(`   Site ID: ${PLAUSIBLE_SITE_ID}`)

    // Sync goals first ensuring custom events are registered
    await syncPlausibleGoals(
      PLAUSIBLE_SITE_ID,
      PLAUSIBLE_API_KEY,
      PLAUSIBLE_HOST,
    )

    try {
      // Helper function to fetch from Plausible API
      const fetchPlausible = async (body: any) => {
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
      console.log(`---\n`) // Separator between domains
    } catch (error) {
      console.error(`❌ Plausible sync failed for ${label.domain}:`, error)
    }
  }
}
