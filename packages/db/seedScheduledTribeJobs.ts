import { db, isProd, getUser } from "./index"
import { apps, scheduledJobs } from "./src/schema"
import { eq, and } from "drizzle-orm"

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
export async function seedScheduledTribeJobs() {
  const email = isProd ? process.env.VEX_LIVE_EMAIL : process.env.VEX_EMAIL
  console.log("🌱 Seeding scheduled Tribe jobs...")

  let admin = await getUser({ email: email })

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
  // Each app starts at a different offset to maintain platform cadence
  const PLATFORM_INTERVAL_MINUTES = 15
  const APP_COOLDOWN_HOURS = 2
  const APP_COOLDOWN_MINUTES = APP_COOLDOWN_HOURS * 60

  // Use ALL available apps - each will post every 2 hours
  const appsToUse = appsWithOwner

  console.log(
    `🔄 Scheduling ${appsToUse.length} apps with ${PLATFORM_INTERVAL_MINUTES}min stagger and ${APP_COOLDOWN_HOURS}h cooldown`,
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

    // Base offset for this app
    const baseOffsetMinutes = i * PLATFORM_INTERVAL_MINUTES
    const baseScheduledAt = new Date(
      now.getTime() + baseOffsetMinutes * 60 * 1000,
    )

    // Create 3 scheduledTimes for this app (post, comment, engage)
    const scheduledTimes = [
      {
        time: baseScheduledAt.toISOString(),
        hour: baseScheduledAt.getHours(),
        minute: baseScheduledAt.getMinutes(),
        model: "sushi",
        postType: "post" as const,
        charLimit: 2000,
        credits: 10,
      },
      {
        time: new Date(baseScheduledAt.getTime() + 5 * 60 * 1000).toISOString(),
        hour: new Date(baseScheduledAt.getTime() + 5 * 60 * 1000).getHours(),
        minute: new Date(
          baseScheduledAt.getTime() + 5 * 60 * 1000,
        ).getMinutes(),
        model: "sushi",
        postType: "comment" as const,
        charLimit: 2000,
        credits: 10,
      },
      {
        time: new Date(
          baseScheduledAt.getTime() + 10 * 60 * 1000,
        ).toISOString(),
        hour: new Date(baseScheduledAt.getTime() + 10 * 60 * 1000).getHours(),
        minute: new Date(
          baseScheduledAt.getTime() + 10 * 60 * 1000,
        ).getMinutes(),
        model: "sushi",
        postType: "engagement" as const,
        charLimit: 2000,
        credits: 10,
      },
    ]

    // Create ONE job with 3 scheduledTimes
    jobs.push({
      appId: app.id,
      userId: app.userId,
      name: `${app.slug} - Tribe Auto Schedule`,
      scheduleType: "tribe" as const,
      jobType: "tribe_post" as const, // Primary job type
      frequency: "custom" as const,
      scheduledTimes,
      timezone: "UTC",
      startDate: baseScheduledAt,
      aiModel: "sushi" as const,
      estimatedCreditsPerRun: 30, // 3 actions × 10 credits
      totalEstimatedCredits: 30,
      status: "active" as const,
      nextRunAt: baseScheduledAt, // First run time
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
  console.log(`   Platform cadence: Every ${PLATFORM_INTERVAL_MINUTES} minutes`)
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

// // Can be run directly with: pnpm exec tsx packages/db/seedScheduledTribeJobs.ts
// if (require.main === module) {
//   seedScheduledTribeJobs()
//     .then(() => {
//       console.log("✅ Scheduled Tribe jobs seeded successfully")
//       process.exit(0)
//     })
//     .catch((error) => {
//       console.error("❌ Error seeding scheduled Tribe jobs:", error)
//       process.exit(1)
//     })
// }
