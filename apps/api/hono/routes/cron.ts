import { Hono } from "hono"
import {
  decayMemories,
  cleanupIncognitoThreads,
  db,
  and,
  eq,
  isNull,
  inArray,
  lt,
  sql,
} from "@repo/db"
import { syncPlausibleAnalytics } from "../../cron/sync-plausible"
import { guests, subscriptions, messages, apps } from "@repo/db/src/schema"
import { clearGraphDataForUser } from "../../lib/graph/graphService"
import { postToMoltbookCron } from "../../lib/cron/moltbookPoster"
import { analyzeMoltbookTrends } from "../../lib/cron/moltbookTrends"
import { isDevelopment } from "../../lib"

export const cron = new Hono()

async function clearGuests() {
  const batchSize = 500
  let totalDeleted = 0
  let hasMore = true
  // 5 gün önceki tarih
  const fiveDaysAgo = new Date()
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

  while (hasMore) {
    // Find inactive guests (no subscription, no messages, no tasks)
    const inactiveGuests = await db
      .select({ id: guests.id, ip: guests.ip })
      .from(guests)
      .leftJoin(subscriptions, eq(subscriptions.guestId, guests.id))
      .leftJoin(messages, eq(messages.guestId, guests.id))
      .leftJoin(apps, eq(apps.guestId, guests.id))
      .leftJoin(sql`task`, sql`task."guestId" = ${guests.id}`)
      .where(
        and(
          isNull(subscriptions.id),
          isNull(messages.id),
          isNull(apps.id),
          sql`task.id IS NULL`,
          lt(guests.activeOn, fiveDaysAgo),
        ),
      )
      .groupBy(guests.id, guests.ip)
      .limit(batchSize)

    if (inactiveGuests.length === 0) {
      hasMore = false
      break
    }

    // Clean up graph data for each guest before deletion
    for (const guest of inactiveGuests) {
      await clearGraphDataForUser({ guestId: guest.id })
    }

    // Delete batch from PostgreSQL
    const idsToDelete = inactiveGuests.map((g) => g.id)
    await db.delete(guests).where(inArray(guests.id, idsToDelete))

    totalDeleted += inactiveGuests.length
    console.log(
      `🧹 Deleted batch of ${inactiveGuests.length} guests (total: ${totalDeleted})`,
    )

    // Show some IPs from this batch
    inactiveGuests.slice(0, 5).forEach((guest) => {
      console.log(`  - ${guest.ip}`)
    })

    if (inactiveGuests.length < batchSize) {
      hasMore = false
    }
  }

  console.log(
    `✅ Cleanup complete! Deleted ${totalDeleted} inactive bot guests`,
  )
}

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

// GET /cron/clearGuests - Clean up inactive bot guests (Vercel Cron)
cron.get("/clearGuests", async (c) => {
  // Verify auth
  const authHeader = c.req.header("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    console.log("🧹 Starting guest cleanup cron job...")
    await clearGuests()
    console.log("✅ Guest cleanup completed successfully")

    return c.json({
      success: true,
      message: "Guest cleanup completed",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Guest cleanup failed:", error)
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

// GET /cron/postToMoltbook - Post AI-generated content to Moltbook
cron.get("/postToMoltbook", async (c) => {
  // Verify auth
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")

  const slug = c.req.query("slug") || "zarathustra"

  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
  }

  try {
    console.log("🦞 Starting Moltbook post cron job...")
    const result = await postToMoltbookCron(slug)

    if (result.success) {
      return c.json({
        success: true,
        message: "Posted to Moltbook successfully",
        post_id: result.post_id,
        timestamp: new Date().toISOString(),
      })
    } else {
      return c.json(
        {
          success: false,
          error: result.error,
        },
        500,
      )
    }
  } catch (error) {
    console.error("❌ Moltbook post failed:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})

// GET /cron/analyzeMoltbookTrends - Analyze Moltbook trends and generate questions
cron.get("/analyzeMoltbookTrends", async (c) => {
  // Verify auth
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")

  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
  }

  try {
    console.log("🦞 Starting Moltbook trends analysis job...")
    await analyzeMoltbookTrends()

    return c.json({
      success: true,
      message: "Moltbook trends analysis completed successfully",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Moltbook trends analysis failed:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})
