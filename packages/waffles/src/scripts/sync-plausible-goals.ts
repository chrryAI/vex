import * as dotenv from "dotenv"
import { ALL_TRACKABLE_EVENTS, analyticsDomains } from "../shared/plausible"

// Load environment variables from root
dotenv.config({ path: "../../.env" })

const PLAUSIBLE_API_KEY = process.env.PLAUSIBLE_API_KEY
const PLAUSIBLE_HOST = process.env.PLAUSIBLE_HOST || "https://plausible.io"

if (!PLAUSIBLE_API_KEY) {
  console.error("❌ PLAUSIBLE_API_KEY is not set in environment")
  process.exit(1)
}

/**
 * Synchronize Plausible Goals for all domains
 */
async function syncAllGoals() {
  console.log(
    `🚀 Starting Plausible goal sync for ${analyticsDomains.length} domains...`,
  )
  console.log(`📊 Trackable events: ${ALL_TRACKABLE_EVENTS.length}`)

  for (const site of analyticsDomains) {
    const domain = site.domain
    console.log(`\n🎯 Syncing goals for ${domain}...`)

    try {
      // 1. Fetch current goals
      const goalsUrl = new URL(`${PLAUSIBLE_HOST}/api/v1/sites/goals`)
      goalsUrl.searchParams.append("site_id", domain)

      const res = await fetch(goalsUrl.toString(), {
        headers: { Authorization: `Bearer ${PLAUSIBLE_API_KEY}` },
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error(
          `   ❌ Failed to fetch goals for ${domain}: ${res.status} - ${errText}`,
        )
        continue
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
        console.log(
          `   ✅ All ${ALL_TRACKABLE_EVENTS.length} goals already exist.`,
        )
        continue
      }

      console.log(`   ➕ Creating ${missingGoals.length} missing goals...`)

      // 3. Create missing goals
      for (const eventName of missingGoals) {
        const createUrl = `${PLAUSIBLE_HOST}/api/v1/sites/goals`
        const createRes = await fetch(createUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PLAUSIBLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            site_id: domain,
            goal_type: "event",
            event_name: eventName,
          }),
        })

        if (createRes.ok) {
          console.log(`      + Created: ${eventName}`)
        } else {
          const err = await createRes.text()
          console.error(`      - Failed: ${eventName} (${err})`)
        }
      }
    } catch (error) {
      console.error(`   ❌ Error syncing ${domain}:`, error)
    }
  }

  console.log("\n✅ Plausible goal synchronization complete!")
}

syncAllGoals().catch(console.error)
