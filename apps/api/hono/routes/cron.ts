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
import { checkMoltbookComments } from "../../lib/cron/moltbookComments"
import { engageWithMoltbookPosts } from "../../lib/cron/moltbookEngagement"
import { isDevelopment } from "../../lib"
import { captureException } from "@sentry/node"

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
    await Promise.all(
      inactiveGuests.map((guest) =>
        clearGraphDataForUser({ guestId: guest.id }),
      ),
    )

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
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")
  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
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
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")
  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
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
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")
  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
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
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")
  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
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
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")
  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
  }

  return handleFetchNews(c)
})

// POST /cron/fetchNews - Fetch news (for production cron)
cron.post("/fetchNews", async (c) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")
  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
  }
  return handleFetchNews(c)
})

// GET /cron/postToMoltbook - Post AI-generated content to Moltbook
cron.get("/postToMoltbook", async (c) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")

  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
  }

  const slug = c.req.query("slug") || "vex"
  const agentName = c.req.query("agentName") || "sushi"
  const minutesRaw = Number(c.req.query("minutes"))
  const minutes =
    Number.isFinite(minutesRaw) && minutesRaw > 0 ? minutesRaw : 30

  const subSlug = c.req.query("subSlug")

  // Start the job in background (fire-and-forget)
  console.log("🦞 Starting Moltbook post cron job in background...")

  postToMoltbookCron({
    slug,
    agentName,
    subSlug,
    minutes,
  })
    .then((result) => {
      console.log(`✅ Moltbook post completed successfully: ${result.post_id}`)
    })
    .catch((error) => {
      captureException(error)
      console.error(`❌ Moltbook post failed:`, error)
    })

  // Return immediately
  return c.json({
    success: true,
    message: "Moltbook post job started in background",
    slug,
    timestamp: new Date().toISOString(),
  })
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

  const sortParam = c.req.query("sort")
  const allowedSorts = ["hot", "new", "top", "rising"] as const
  const sort =
    sortParam && allowedSorts.includes(sortParam as any)
      ? (sortParam as "hot" | "new" | "top" | "rising")
      : undefined

  const slug = c.req.query("slug") || "chrry"

  // Start the job in background (fire-and-forget)
  console.log("🦞 Starting Moltbook trends analysis job in background...")

  analyzeMoltbookTrends({ sort, slug })
    .then(() => {
      console.log("✅ Moltbook trends analysis completed successfully")
    })
    .catch((error) => {
      captureException(error)
      console.error("❌ Moltbook trends analysis failed:", error)
    })

  // Return immediately
  return c.json({
    success: true,
    message: "Moltbook trends analysis job started in background",
    timestamp: new Date().toISOString(),
  })
})

// GET /cron/checkMoltbookComments - Check for new comments and auto-reply
cron.get("/checkMoltbookComments", async (c) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")
  const minutesRaw = Number(c.req.query("minutes"))
  const minutes =
    Number.isFinite(minutesRaw) && minutesRaw > 0 ? minutesRaw : 60

  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
  }

  const slug = c.req.query("slug") || "vex"

  // Start the job in background (fire-and-forget)
  console.log("💬 Starting Moltbook comment check job in background...")

  checkMoltbookComments({
    slug,
    minutes,
  })
    .then(() => {
      console.log("✅ Moltbook comment check completed successfully")
    })
    .catch((error) => {
      captureException(error)
      console.error("❌ Moltbook comment check failed:", error)
    })

  // Return immediately
  return c.json({
    success: true,
    message: "Moltbook comment check job started in background",
    slug,
    timestamp: new Date().toISOString(),
  })
})

// GET /cron/engageWithMoltbook - Comment on daily top posts
cron.get("/engageWithMoltbook", async (c) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")

  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
  }

  const slug = c.req.query("slug") || "chrry"

  // Start the job in background (fire-and-forget)
  console.log("🎯 Starting Moltbook engagement job in background...")

  engageWithMoltbookPosts({ slug })
    .then(() => {
      console.log("✅ Moltbook engagement completed successfully")
    })
    .catch((error) => {
      captureException(error)
      console.error("❌ Moltbook engagement failed:", error)
    })

  // Return immediately
  return c.json({
    success: true,
    message: "Moltbook engagement job started in background",
    slug,
    timestamp: new Date().toISOString(),
  })
})

// GET /cron/runScheduledJobs - Execute scheduled jobs that are due
cron.get("/runScheduledJobs", async (c) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")

  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
  }

  console.log("📅 Starting scheduled jobs execution...")

  const { findJobsToRun, executeScheduledJob } =
    await import("../../lib/scheduledJobs/jobScheduler")

  try {
    // Find all jobs that need to run now
    const jobsToRun = await findJobsToRun()

    if (jobsToRun.length === 0) {
      console.log("⏭️ No scheduled jobs to run")
      return c.json({
        success: true,
        message: "No scheduled jobs to run",
        jobsExecuted: 0,
        timestamp: new Date().toISOString(),
      })
    }

    console.log(`🚀 Found ${jobsToRun.length} jobs to execute`)

    // Execute all jobs in parallel (fire-and-forget)
    const executionPromises = jobsToRun.map((job) =>
      executeScheduledJob({ jobId: job.id })
        .then(() => {
          console.log(`✅ Job executed: ${job.name}`)
          return { jobId: job.id, name: job.name, status: "success" }
        })
        .catch((error) => {
          captureException(error)
          console.error(`❌ Job failed: ${job.name}`, error)
          return {
            jobId: job.id,
            name: job.name,
            status: "failed",
            error: error.message,
          }
        }),
    )

    // Wait for all jobs to complete (with timeout)
    const results = await Promise.race([
      Promise.all(executionPromises),
      new Promise(
        (resolve) => setTimeout(() => resolve([]), 25000), // 25s timeout (Vercel limit is 30s)
      ),
    ])

    return c.json({
      success: true,
      message: "Scheduled jobs execution completed",
      jobsExecuted: jobsToRun.length,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    captureException(error)
    console.error("❌ Scheduled jobs execution failed:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      500,
    )
  }
})
