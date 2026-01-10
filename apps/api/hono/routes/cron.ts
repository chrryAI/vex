import { Hono } from "hono"
import { decayMemories, cleanupIncognitoThreads } from "@repo/db"
import { syncPlausibleAnalytics } from "../../cron/sync-plausible"

export const cron = new Hono()

// GET /cron/decayMemories - Decay unused memories (Vercel Cron)
cron.get("/decayMemories", async (c) => {
  // Verify the request is from Vercel Cron
  const authHeader = c.req.header("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    console.log("🕐 Starting memory decay cron job...")
    await decayMemories()
    console.log("✅ Memory decay completed successfully")

    return c.json({
      success: true,
      message: "Memory decay completed",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Memory decay failed:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})

cron.get("/syncPlausible", async (c) => {
  // Verify auth
  const authHeader = c.req.header("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  // Start sync in background (don't await!)
  syncPlausibleAnalytics()
    .then(() => console.log("✅ Sync complete"))
    .catch((error) => console.error("❌ Sync failed:", error))
  // Return immediately
  return c.json({
    success: true,
    message: "Plausible analytics sync started",
    timestamp: new Date().toISOString(),
  })
})

cron.get("/burn", async (c) => {
  // Verify auth
  const authHeader = c.req.header("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    console.log("🔥 Starting incognito thread cleanup...")
    const deletedCount = await cleanupIncognitoThreads(30) // 30 days retention
    console.log(`✅ Cleanup complete - deleted ${deletedCount} threads`)

    return c.json({
      success: true,
      message: "Incognito thread cleanup completed",
      deletedCount: Number(deletedCount),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Cleanup failed:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})

// Shared handler for fetchNews
async function handleFetchNews(c: any) {
  return c.json({
    success: true,
    message: "Maybe later",
    timestamp: new Date().toISOString(),
  })
  // try {
  //   // Verify cron secret (optional but recommended)
  //   const authHeader = c.req.header("authorization")
  //   const cronSecret = process.env.CRON_SECRET

  //   // Only check auth if CRON_SECRET is set
  //   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  //     console.log("❌ Unauthorized: Invalid or missing authorization header")
  //     return c.json({ error: "Unauthorized" }, 401)
  //   }

  //   console.log("🗞️ Cron: Starting news fetch...")

  //   await fetchAllNews()

  //   return c.json({
  //     success: true,
  //     message: "News fetched successfully",
  //     timestamp: new Date().toISOString(),
  //   })
  // } catch (error) {
  //   console.error("❌ Cron error:", error)
  //   return c.json(
  //     {
  //       success: false,
  //       error: error instanceof Error ? error.message : "Unknown error",
  //     },
  //     500,
  //   )
  // }
}

// GET /cron/fetchNews - Fetch news (for testing)
cron.get("/fetchNews", async (c) => {
  return handleFetchNews(c)
})

// POST /cron/fetchNews - Fetch news (for production cron)
cron.post("/fetchNews", async (c) => {
  return handleFetchNews(c)
})
