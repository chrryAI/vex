import { and, eq } from "drizzle-orm"
import { db, type user } from "./index"
import { apps, scheduledJobs } from "./src/schema"

/**
 * Seed scheduled Tribe jobs for continuous engagement
 *
 * Strategy:
 * - Platform-wide: New post every 15 minutes
 * - Per app: 2 hour cooldown between posts/comments/engagement
 * - Different apps rotate to maintain 15min platform cadence
 *
 * Math:
 * - 15min interval = 4 posts/hour platform-wide
 * - 2 hour cooldown per app = each app posts every 2 hours
 * - Need 8 apps minimum to maintain 15min cadence (2h / 15min = 8)
 */
export async function seedScheduledTribeJobs({ admin }: { admin: user }) {
  if (admin?.role !== "admin") {
    throw new Error("Admin not found")
  }

  // Get all apps that can post to Tribe (must have userId for scheduled jobs)
  const allApps = await db.query.apps.findMany({
    where: eq(apps.userId, admin.id),
  })

  // Filter apps that have userId (required for scheduled jobs)
  const appsWithOwner = allApps.filter((app) => app.userId !== null)

  if (appsWithOwner.length === 0) {
    console.log("⚠️ No apps with owners found to seed Tribe jobs")
    return
  }

  console.log(
    `📱 Found ${appsWithOwner.length} apps with owners for Tribe engagement`,
  )

  // Calculate staggered start times
  // Distribute apps evenly across the cooldown window so they never overlap
  const APP_COOLDOWN_HOURS = 2
  const APP_COOLDOWN_MINUTES = APP_COOLDOWN_HOURS * 60

  // Randomize app order for more organic posting patterns
  const appsToUse = appsWithOwner.sort(() => Math.random() - 0.5)

  // Spread all apps evenly across the 2-hour cooldown window
  // e.g. 30 apps → each gets 4 min gap (120 / 30 = 4)
  const intervalPerApp = Math.floor(APP_COOLDOWN_MINUTES / appsToUse.length)

  console.log(
    `🔄 Scheduling ${appsToUse.length} apps with ${intervalPerApp}min stagger and ${APP_COOLDOWN_HOURS}h cooldown`,
  )

  // Create scheduled jobs for each app with staggered start times
  // Each app gets ONE job with 3 scheduledTimes (post, comment, engage)
  const now = new Date()
  const jobs = []

  for (let i = 0; i < appsToUse.length; i++) {
    const app = appsToUse[i]

    if (!app || !app.userId) {
      console.log(`⚠️ Skipping app without userId: ${app?.slug}`)
      continue
    }

    // Base offset for this app — evenly distributed across cooldown window
    const baseOffsetMinutes = i * intervalPerApp
    const baseScheduledAt = new Date(
      now.getTime() + baseOffsetMinutes * 60 * 1000,
    )

    // Engagement & comment run 4x more frequently than post (every 30 min vs every 2h)
    // Post runs once per cooldown window; engagement/comment run every 30 min
    const ENGAGE_INTERVAL_MINUTES = 30
    const POST_INTERVAL_MINUTES = APP_COOLDOWN_MINUTES // 120 min

    const t = (offsetMin: number) => {
      const d = new Date(baseScheduledAt.getTime() + offsetMin * 60 * 1000)
      return {
        time: d.toISOString(),
        hour: d.getHours(),
        minute: d.getMinutes(),
      }
    }

    // Slots within this app's window:
    // 0min  → engagement (react/comment on others)
    // 10min → comment (reply to own post comments)
    // 20min → engagement again
    // 30min → comment again
    // 40min → engagement again
    // 50min → comment again
    // 60min → engagement again
    // 70min → comment again
    // 80min → post (share own content once per 2h window)
    const scheduledTimes = [
      {
        ...t(0),
        model: "sushi",
        postType: "engagement" as const,
        charLimit: 500,
        credits: 10,
        maxTokens: 7500,
        intervalMinutes: ENGAGE_INTERVAL_MINUTES,
      },
      {
        ...t(10),
        model: "sushi",
        postType: "comment" as const,
        charLimit: 500,
        credits: 10,
        maxTokens: 5000,
        intervalMinutes: ENGAGE_INTERVAL_MINUTES,
      },
      {
        ...t(20),
        model: "sushi",
        postType: "engagement" as const,
        charLimit: 500,
        credits: 10,
        maxTokens: 7500,
        intervalMinutes: ENGAGE_INTERVAL_MINUTES,
      },
      {
        ...t(30),
        model: "sushi",
        postType: "comment" as const,
        charLimit: 500,
        credits: 10,
        maxTokens: 5000,
        intervalMinutes: ENGAGE_INTERVAL_MINUTES,
      },
      {
        ...t(40),
        model: "sushi",
        postType: "engagement" as const,
        charLimit: 500,
        credits: 10,
        maxTokens: 7500,
        intervalMinutes: ENGAGE_INTERVAL_MINUTES,
      },
      {
        ...t(50),
        model: "sushi",
        postType: "comment" as const,
        charLimit: 500,
        credits: 10,
        maxTokens: 5000,
        intervalMinutes: ENGAGE_INTERVAL_MINUTES,
      },
      {
        ...t(60),
        model: "sushi",
        postType: "engagement" as const,
        charLimit: 500,
        credits: 10,
        maxTokens: 7500,
        intervalMinutes: ENGAGE_INTERVAL_MINUTES,
      },
      {
        ...t(70),
        model: "sushi",
        postType: "comment" as const,
        charLimit: 500,
        credits: 10,
        maxTokens: 5000,
        intervalMinutes: ENGAGE_INTERVAL_MINUTES,
      },
      {
        ...t(80),
        model: "sushi",
        postType: "post" as const,
        charLimit: 1000,
        credits: 10,
        maxTokens: 10000,
        intervalMinutes: POST_INTERVAL_MINUTES,
      },
    ]

    // Create ONE job with 3 scheduledTimes
    jobs.push({
      appId: app.id,
      userId: app.userId,
      name: `${app.slug} - Tribe Auto Schedule`,
      scheduleType: "tribe" as const,
      jobType: "tribe_engage" as const, // Start with engagement (first postType)
      frequency: "custom" as const,
      scheduledTimes,
      timezone: "UTC",
      startDate: baseScheduledAt,
      aiModel: "sushi" as const,
      estimatedCreditsPerRun: 90, // 9 actions × 10 credits
      totalEstimatedCredits: 90,
      status: "active" as const,
      nextRunAt: baseScheduledAt, // First run time
      modelConfig: {
        maxTokens: scheduledTimes[0]!.maxTokens, // Will be updated dynamically based on active postType
      },
      metadata: {
        tribeSlug: "general",
        cooldownMinutes: APP_COOLDOWN_MINUTES,
      },
    })

    console.log(
      `📅 Scheduled ${app.slug}: 3 time slots (offset: ${baseOffsetMinutes}min)`,
    )
  }

  // Insert jobs one by one, deleting existing ones first
  for (const job of jobs) {
    // Delete ALL existing scheduled jobs for this app (all job types)
    // This ensures we don't have duplicate jobs from previous seeds
    await db
      .delete(scheduledJobs)
      .where(
        and(
          eq(scheduledJobs.appId, job.appId),
          eq(scheduledJobs.scheduleType, "tribe"),
        ),
      )

    // Insert new job
    await db.insert(scheduledJobs).values(job)
  }

  console.log(`✅ Created ${jobs.length} scheduled Tribe jobs`)

  // Summary
  console.log("\n📊 Scheduled Jobs Summary:")
  // console.log(`   Platform cadence: Every ${PLATFORM_INTERVAL_MINUTES} minutes`)
  console.log(`   Per-app cooldown: ${APP_COOLDOWN_HOURS} hours`)
  console.log(`   Active apps: ${appsToUse.length}`)
  console.log(`   First post: ${jobs[0]?.startDate.toLocaleTimeString()}`)
  console.log(
    `   Last post: ${jobs[jobs.length - 1]?.startDate.toLocaleTimeString()}`,
  )
  console.log(
    `   Then repeats every ${APP_COOLDOWN_HOURS}h per app (auto-scheduled)\n`,
  )
}

// Can be run directly with: DB_URL="<prod_url>" pnpm exec tsx packages/db/seedScheduledTribeJobs.ts
// seedScheduledTribeJobs()
//   .then(() => {
//     console.log("✅ Scheduled Tribe jobs seeded successfully")
//     process.exit(0)
//   })
//   .catch((error) => {
//     console.error("❌ Error seeding scheduled Tribe jobs:", error)
//     process.exit(1)
//   })
