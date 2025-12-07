import cron from "node-cron"
import { fetchAllNews } from "./newsFetcher"

/**
 * Initialize cron jobs
 * Call this in your server startup (e.g., in a custom server or API route)
 */
export function initCronJobs() {
  // Fetch news every hour
  cron.schedule("0 * * * *", async () => {
    console.log("🗞️ Cron: Fetching news...")
    try {
      await fetchAllNews()
      console.log("✅ Cron: News fetched successfully")
    } catch (error) {
      console.error("❌ Cron: Error fetching news:", error)
    }
  })

  console.log("✅ Cron jobs initialized")
}

// For testing: Run immediately
export async function runNewsFetchNow() {
  console.log("🗞️ Manual: Fetching news...")
  await fetchAllNews()
  console.log("✅ Manual: News fetched successfully")
}
