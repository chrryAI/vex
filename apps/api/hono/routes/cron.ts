import {
  and,
  cleanupIncognitoThreads,
  db,
  decayMemories,
  eq,
  fetchAndStoreNews,
  inArray,
  isNull,
  lt,
  sql,
} from "@repo/db"
import { apps, guests, messages, subscriptions } from "@repo/db/src/schema"
import { Hono } from "hono"
import { syncPlausibleAnalytics } from "../../cron/sync-plausible"
import { isDevelopment } from "../../lib"
import { captureException } from "../../lib/captureException"
import {
  runAutonomousAgentsCron,
  updateSlotAnalytics,
} from "../../lib/cron/autonomousAgentsCron"
import { checkMoltbookComments } from "../../lib/cron/moltbookComments"
import { engageWithMoltbookPosts } from "../../lib/cron/moltbookEngagement"
import { postToMoltbookCron } from "../../lib/cron/moltbookPoster"
import { analyzeMoltbookTrends } from "../../lib/cron/moltbookTrends"
import { syncSonarCloud } from "../../lib/cron/sonarSync"
import {
  clearGraphDataForUser,
  storeNewsInGraph,
} from "../../lib/graph/graphService"
import {
  executeScheduledJob,
  findJobsToRun,
} from "../../lib/scheduledJobs/jobScheduler"
import { sendDiscordNotification } from "../../lib/sendDiscordNotification"

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
  try {
    const result = await fetchAndStoreNews()

    // Sync newly inserted articles to graph (fire-and-forget)
    let graphSynced = 0
    if (result.newlyInserted && result.newlyInserted.length > 0) {
      Promise.allSettled(
        result.newlyInserted.map((article) => storeNewsInGraph(article)),
      ).then((results) => {
        graphSynced = results.filter((r) => r.status === "fulfilled").length
        console.log(
          `📰 Graph news sync: ${graphSynced}/${result.newlyInserted!.length} articles`,
        )
      })
    }

    // Discord summary notification
    const stats = result.countryStats || []
    const successRows = stats.filter((s) => !s.error)
    const failRows = stats.filter((s) => s.error)

    sendDiscordNotification(
      {
        embeds: [
          {
            title: "📰 News Fetch Complete",
            color: failRows.length > 0 ? 0xf59e0b : 0x22c55e,
            fields: [
              {
                name: "Summary",
                value: `✅ Inserted: **${result.inserted}** | ⏭️ Skipped: **${result.skipped}**`,
                inline: false,
              },
              {
                name: `✅ Countries (${successRows.length})`,
                value:
                  successRows
                    .map((s) => `\`${s.country}\` → ${s.fetched} articles`)
                    .join("\n") || "none",
                inline: true,
              },
              ...(failRows.length > 0
                ? [
                    {
                      name: `❌ Failed (${failRows.length})`,
                      value: failRows
                        .map((s) => `\`${s.country}\` → ${s.error}`)
                        .join("\n"),
                      inline: true,
                    },
                  ]
                : []),
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      },
      process.env.DISCORD_TRIBE_WEBHOOK_URL,
    ).catch((err) => console.error("⚠️ Discord notification failed:", err))

    return c.json({
      success: true,
      inserted: result.inserted,
      skipped: result.skipped,
      countryStats: result.countryStats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ fetchNews failed:", error)
    sendDiscordNotification(
      {
        embeds: [
          {
            title: "❌ News Fetch Failed",
            color: 0xef4444,
            fields: [{ name: "Error", value: String(error), inline: false }],
            timestamp: new Date().toISOString(),
          },
        ],
      },
      process.env.DISCORD_TRIBE_WEBHOOK_URL,
    ).catch(() => {})
    return c.json({ success: false, error: String(error) }, 500)
  }
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

  try {
    // Import scheduler module (inside try block to catch import errors)

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

    // Limit: Only execute 1 tribe job per cron cycle to avoid overwhelming system
    const tribeJobs = jobsToRun.filter((j) => j.scheduleType === "tribe")
    const otherJobs = jobsToRun.filter((j) => j.scheduleType !== "tribe")

    const jobsToExecute = [
      ...otherJobs, // Execute all non-tribe jobs
      ...(tribeJobs.length > 0 ? [tribeJobs[0]] : []), // Only 1 tribe job
    ]

    console.log(
      `📊 Executing ${jobsToExecute.length} jobs (${tribeJobs.length} tribe jobs found, executing 1)`,
    )

    // Execute selected jobs in background (fire-and-forget)
    jobsToExecute.forEach((job) => {
      job &&
        executeScheduledJob({ jobId: job.id })
          .then(() => {
            console.log(`✅ Job executed: ${job.name}`)
          })
          .catch((error) => {
            captureException(error)
            console.error(`❌ Job failed: ${job.name}`, error)
          })
    })

    // Return immediately
    return c.json({
      success: true,
      message: "Scheduled jobs started in background",
      jobsStarted: jobsToRun.length,
      jobs: jobsToRun.map((j) => ({
        id: j.id,
        name: j.name,
        jobType: j.jobType,
        scheduleType: j.scheduleType,
        nextRunAt: j.nextRunAt?.toISOString(),
        frequency: j.frequency,
        scheduledTimes: j.scheduledTimes?.map((st) => ({
          postType: st.postType,
          time: st.time,
          model: st.model,
        })),
        status: j.status,
      })),
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

// GET /cron/syncSonarCloud - Sync SonarCloud metrics and issues
cron.get("/syncSonarCloud", async (c) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")

  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
  }

  // Start the job in background (fire-and-forget)
  console.log("📊 Starting SonarCloud sync job in background...")

  syncSonarCloud()
    .then(() => {
      console.log("✅ SonarCloud sync completed successfully")
    })
    .catch((error) => {
      captureException(error)
      console.error("❌ SonarCloud sync failed:", error)
    })

  // Return immediately
  return c.json({
    success: true,
    message: "SonarCloud sync job started in background",
    timestamp: new Date().toISOString(),
  })
})

// GET /cron/autonomousAgents - Run autonomous AI agents to analyze stores and place bids
cron.get("/autonomousAgents", async (c) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")

  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
  }

  console.log("🤖 Starting autonomous AI agents cron job...")

  runAutonomousAgentsCron()
    .then((result) => {
      console.log("✅ Autonomous agents job completed:", result)
    })
    .catch((error) => {
      captureException(error)
      console.error("❌ Autonomous agents job failed:", error)
    })

  return c.json({
    success: true,
    message: "Autonomous AI agents job started in background",
    timestamp: new Date().toISOString(),
  })
})

// GET /cron/updateSlotAnalytics - Update slot traffic analytics
cron.get("/updateSlotAnalytics", async (c) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header("authorization")

  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }
  }

  console.log("📊 Starting slot analytics update job...")

  updateSlotAnalytics()
    .then((result) => {
      console.log("✅ Slot analytics update completed:", result)
    })
    .catch((error) => {
      captureException(error)
      console.error("❌ Slot analytics update failed:", error)
    })

  return c.json({
    success: true,
    message: "Slot analytics update job started in background",
    timestamp: new Date().toISOString(),
  })
})
