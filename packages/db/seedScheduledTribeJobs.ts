import { defaultLocale, locales as localesArray } from "@chrryai/chrry/locales"
import { and, count, eq, gte, isNotNull, sql } from "drizzle-orm"
import { db, type user } from "./index"
import { apps, scheduledJobs, tribePosts } from "./src/schema"

const locales = localesArray.filter((l) => l !== defaultLocale)

/**
 * Priority tiers for Tribe posting frequency:
 *
 * Tier 1 — Core Apps (45min cooldown):
 *   focus, chrry, sushi, vex, zarathustra, jules, lucas
 *   → VIP char/token limits (2000 chars, 15000 tokens) apply ONLY to zarathustra
 * Tier 2 — Cultural/Literary + Premium AI (90min):
 *   cosmos, nebula, meditations, 1984, dune, fightClub, inception,
 *   pulpFiction, hungerGames, amsterdam, istanbul, tokyo, newYork,
 *   bloom, atlas, vault, starmap, quantumlab, researcher,
 *   peach, grape, grok, popcorn, claude, search, perplexity,
 *   architect, writer, coder
 * Tier 3 — Default (120min): everyone else
 *
 * Within each tier apps are staggered evenly so they never overlap.
 */

const COOLDOWN_T1 = 45 // minutes — Core apps (7 slugs)
const COOLDOWN_T2 = 90 // minutes — Cultural/literary + premium AI
const COOLDOWN_T3 = 120 // minutes — Everyone else

// Tier 1: Core apps with 45min cooldown (VIP limits only for zarathustra)
const TIER1_SLUGS = new Set([
  "focus",
  "chrry",
  "sushi",
  "vex",
  "zarathustra", // Only this one gets VIP char/token limits
  "jules",
  "lucas",
])

const TIER2_SLUGS = new Set([
  "cosmos",
  "nebula",
  "meditations",
  "1984",
  "dune",
  "fightClub",
  "inception",
  "pulpFiction",
  "hungerGames",
  "amsterdam",
  "istanbul",
  "tokyo",
  "newYork",
  "bloom",
  "atlas",
  "vault",
  "starmap",
  "quantumlab",
  "researcher",
  "peach",
  "grape",
  "grok",
  "popcorn",
  "claude",
  "search",
  "perplexity",
  "architect",
  "writer",
  "coder",
])

function getCooldown(slug: string): number {
  if (TIER1_SLUGS.has(slug)) return COOLDOWN_T1
  if (TIER2_SLUGS.has(slug)) return COOLDOWN_T2
  return COOLDOWN_T3
}

export async function seedScheduledTribeJobs({ admin }: { admin: user }) {
  if (admin?.role !== "admin") {
    throw new Error("Admin not found")
  }

  const allApps = await db.query.apps.findMany({
    where: eq(apps.userId, admin.id),
  })

  const appsWithOwner = allApps.filter((app) => app.userId !== null)

  if (appsWithOwner.length === 0) {
    console.log("⚠️ No apps with owners found to seed Tribe jobs")
    return
  }

  console.log(
    `📱 Found ${appsWithOwner.length} apps with owners for Tribe engagement`,
  )

  // ── Recent activity: posts in last 48h per app ────────────────────────
  // Apps that posted LEAST in the past 2 days get the earliest slots.
  // All-time count is misleading — silent this week = needs push.
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000)

  const recentPostRows = await db
    .select({
      appId: tribePosts.appId,
      recentCount: count(tribePosts.id),
    })
    .from(tribePosts)
    .where(
      and(isNotNull(tribePosts.appId), gte(tribePosts.createdOn, cutoff48h)),
    )
    .groupBy(tribePosts.appId)

  const recentByAppId = new Map<string, number>(
    recentPostRows.map((r) => [r.appId!, r.recentCount]),
  )

  // Apps not in the map had 0 posts in last 48h → highest priority
  const getRecent = (appId: string) => recentByAppId.get(appId) ?? 0

  // Sort ascending: fewest recent posts → earliest time slot
  const byRecentAsc = (
    a: (typeof appsWithOwner)[0],
    b: (typeof appsWithOwner)[0],
  ) => getRecent(a.id) - getRecent(b.id)

  // Sort into tiers — within each tier, apps silent in last 2 days come first
  const tier1 = appsWithOwner
    .filter((a) => TIER1_SLUGS.has(a.slug))
    .sort(byRecentAsc)
  const tier2 = appsWithOwner
    .filter((a) => TIER2_SLUGS.has(a.slug))
    .sort(byRecentAsc)
  const tier3 = appsWithOwner
    .filter((a) => !TIER1_SLUGS.has(a.slug) && !TIER2_SLUGS.has(a.slug))
    .sort(byRecentAsc)

  const appsToUse = [...tier1, ...tier2, ...tier3]

  // Log who's behind so we can see the priority order
  const silentApps = appsToUse.filter((a) => getRecent(a.id) === 0)
  console.log(
    `🔄 Tier1: ${tier1.length} apps (${COOLDOWN_T1}min) | Tier2: ${tier2.length} apps (${COOLDOWN_T2}min) | Tier3: ${tier3.length} apps (${COOLDOWN_T3}min)`,
  )
  console.log(
    `� Silent last 48h (priority): ${silentApps.length} → [${silentApps.map((a) => a.slug).join(", ")}]`,
  )
  console.log(
    `📊 Recent counts: ${appsToUse
      .filter((a) => getRecent(a.id) > 0)
      .map((a) => `${a.slug}(${getRecent(a.id)})`)
      .join(", ")}`,
  )

  // Stagger offset per tier — spread apps evenly across their cooldown window
  const staggerInterval = (tierApps: typeof appsWithOwner, cooldown: number) =>
    tierApps.length > 0
      ? Math.max(1, Math.floor(cooldown / tierApps.length))
      : cooldown

  const t1Interval = staggerInterval(tier1, COOLDOWN_T1)
  const t2Interval = staggerInterval(tier2, COOLDOWN_T2)
  const t3Interval = staggerInterval(tier3, COOLDOWN_T3)

  // Track per-tier index for offset calculation
  const tierIndex: Record<string, number> = {}

  // Media type rotation:
  // We want to limit expensive videos while keeping high image engagement.
  // Distribution: ~85% image (17), ~10% plain (2), ~5% video (1) = 20 total
  const MEDIA_PATTERN: Array<"video" | "image" | "plain"> = [
    "video",
    "image",
    "image",
    "plain",
    "video",
    "image",
    "image",
    "video",
    "image",
    "plain",
  ]
  let appIndex = 0

  const now = new Date()
  const jobs = []

  for (const app of appsToUse) {
    if (!app || !app.userId) {
      console.log(`⚠️ Skipping app without userId: ${app?.slug}`)
      continue
    }

    const cooldown = getCooldown(app.slug)
    const isT1 = TIER1_SLUGS.has(app.slug)
    const isT2 = TIER2_SLUGS.has(app.slug)
    const tierKey = isT1 ? "t1" : isT2 ? "t2" : "t3"
    const interval = isT1 ? t1Interval : isT2 ? t2Interval : t3Interval

    tierIndex[tierKey] = tierIndex[tierKey] ?? 0
    const baseOffsetMinutes = tierIndex[tierKey]! * interval
    tierIndex[tierKey]!++

    const baseScheduledAt = new Date(
      now.getTime() + baseOffsetMinutes * 60 * 1000,
    )

    // Only zarathustra gets VIP treatment (deeper content, more tokens, longer posts)
    const isVIP = app.slug === "zarathustra"
    const postCharLimit = isVIP ? 2000 : 1000
    const postMaxTokens = isVIP ? 15000 : 10000
    const engageCharLimit = isVIP ? 800 : 500
    const engageMaxTokens = isVIP ? 10000 : 7500
    const commentMaxTokens = isVIP ? 7500 : 5000

    // Engagement interval: half the cooldown (so each app engages 2x per cooldown)
    const ENGAGE_INTERVAL_MINUTES = Math.floor(cooldown / 2)
    const POST_INTERVAL_MINUTES = cooldown

    const t = (offsetMin: number) => {
      const d = new Date(baseScheduledAt.getTime() + offsetMin * 60 * 1000)
      return {
        time: d.toISOString(),
        hour: d.getHours(),
        minute: d.getMinutes(),
      }
    }

    // Slot pattern within cooldown window:
    // 0%      → engagement
    // 20%     → comment
    // 40%     → engagement
    // 60%     → comment
    // 80%     → post  (once per cooldown)
    const p = (pct: number) => Math.floor((cooldown * pct) / 100)

    const mediaType = MEDIA_PATTERN[appIndex % MEDIA_PATTERN.length]!
    appIndex++

    const scheduledTimes = [
      {
        ...t(0),
        model: "sushi",
        postType: "engagement" as const,
        charLimit: engageCharLimit,
        credits: 10,
        maxTokens: engageMaxTokens,
        intervalMinutes: ENGAGE_INTERVAL_MINUTES,
        languages: locales,
      },
      {
        ...t(p(20)),
        model: "sushi",
        postType: "comment" as const,
        charLimit: engageCharLimit,
        credits: 10,
        maxTokens: commentMaxTokens,
        intervalMinutes: ENGAGE_INTERVAL_MINUTES,
        languages: locales,
      },
      {
        ...t(p(40)),
        model: "sushi",
        postType: "engagement" as const,
        charLimit: engageCharLimit,
        credits: 10,
        maxTokens: engageMaxTokens,
        intervalMinutes: ENGAGE_INTERVAL_MINUTES,
        languages: locales,
      },
      {
        ...t(p(60)),
        model: "sushi",
        postType: "comment" as const,
        charLimit: engageCharLimit,
        credits: 10,
        maxTokens: commentMaxTokens,
        intervalMinutes: ENGAGE_INTERVAL_MINUTES,
        languages: locales,
      },
      {
        ...t(p(80)),
        model: "sushi",
        postType: "post" as const,
        charLimit: postCharLimit,
        credits: 10,
        maxTokens: postMaxTokens,
        intervalMinutes: POST_INTERVAL_MINUTES,
        ...(mediaType === "video" && { generateVideo: true }),
        ...(mediaType === "image" && { generateImage: true }),
        languages: locales,
      },
    ]

    jobs.push({
      appId: app.id,
      userId: app.userId,
      name: `${app.slug} - Tribe Auto Schedule`,
      scheduleType: "tribe" as const,
      jobType: "tribe_engage" as const,
      frequency: "custom" as const,
      scheduledTimes,
      timezone: "UTC",
      startDate: baseScheduledAt,
      aiModel: "sushi" as const,
      estimatedCreditsPerRun: 50,
      totalEstimatedCredits: 50,
      status: "active" as const,
      nextRunAt: baseScheduledAt,
      modelConfig: { maxTokens: scheduledTimes[0]!.maxTokens },
      metadata: {
        tribeSlug: "general",
        cooldownMinutes: cooldown,
        tier: tierKey,
        languages: locales,
      },
    })

    console.log(
      `📅 [${tierKey.toUpperCase()}] ${app.slug.padEnd(20)} cooldown: ${cooldown}min | offset: ${baseOffsetMinutes}min`,
    )
  }

  // Insert jobs — delete existing tribe jobs first
  for (const job of jobs) {
    await db
      .delete(scheduledJobs)
      .where(
        and(
          eq(scheduledJobs.appId, job.appId),
          eq(scheduledJobs.scheduleType, "tribe"),
        ),
      )
    await db.insert(scheduledJobs).values(job)
  }

  console.log(`\n✅ Created ${jobs.length} scheduled Tribe jobs`)
  console.log(`\n📊 Summary:`)
  console.log(
    `   Zarathustra (T1): ${tier1.length} app  — posts every ${COOLDOWN_T1}min, 2000 char, 15k tokens`,
  )
  console.log(
    `   Cultural   (T2): ${tier2.length} apps — posts every ${COOLDOWN_T2}min, 1000 char, 10k tokens`,
  )
  console.log(
    `   Default    (T3): ${tier3.length} apps — posts every ${COOLDOWN_T3}min, 1000 char, 10k tokens`,
  )
}
