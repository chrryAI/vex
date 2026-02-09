import { db } from "@repo/db"
import {
  scheduledJobs,
  scheduledJobRuns,
  tribePosts,
  apps,
} from "@repo/db/src/schema"
import { eq, and, lte, gte, isNull, or } from "drizzle-orm"
import { generateText } from "ai"
import { getModelProvider } from "../getModelProvider"
import { captureException } from "@repo/ui/utils/errorTracking"
import { postToMoltbook } from "../integrations/moltbook"
import { engageWithMoltbookPosts } from "../cron/moltbookEngagement"
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz"
import { calculateCreditsFromDB } from "./creditCalculator"
import { getOrCreateTribe } from "../tribes/autoCreateTribe"

interface ExecuteJobParams {
  jobId: string
}

// Helper: Get default model for each provider
function getDefaultModelForProvider(
  provider: "openai" | "claude" | "deepseek" | "sushi",
): string {
  const defaults = {
    openai: "gpt-4o-mini",
    claude: "claude-3-5-haiku-20241022",
    deepseek: "deepseek-chat",
    sushi: "sushi-1",
  }
  return defaults[provider] || "gpt-4o-mini"
}

export async function executeScheduledJob(params: ExecuteJobParams) {
  const { jobId } = params

  // Get job details
  const job = await db.query.scheduledJobs.findFirst({
    where: eq(scheduledJobs.id, jobId),
  })

  if (!job) {
    throw new Error(`Job not found: ${jobId}`)
  }

  // Check if job is active
  if (job.status !== "active") {
    console.log(`⏭️ Job ${job.name} is not active (status: ${job.status})`)
    return
  }

  // Atomically claim the job by updating nextRunAt
  const LOCK_TTL_MS = 5 * 60 * 1000 // 5 minutes for long-running jobs
  const claimResult = await db
    .update(scheduledJobs)
    .set({
      nextRunAt: new Date(Date.now() + LOCK_TTL_MS),
    })
    .where(
      and(
        eq(scheduledJobs.id, job.id),
        eq(scheduledJobs.status, "active"),
        or(
          isNull(scheduledJobs.nextRunAt),
          lte(scheduledJobs.nextRunAt, new Date()),
        ),
      ),
    )
    .returning({ id: scheduledJobs.id })

  // If no rows updated, another scheduler claimed it
  if (claimResult.length === 0) {
    console.log(`⏭️ Job ${job.name} already claimed by another scheduler`)
    return
  }

  // Check if job has ended
  if (job.endDate && new Date() > job.endDate) {
    console.log(`⏭️ Job ${job.name} has ended`)
    await db
      .update(scheduledJobs)
      .set({ status: "completed" })
      .where(eq(scheduledJobs.id, jobId))
    return
  }

  // Create job run record
  const [jobRun] = await db
    .insert(scheduledJobRuns)
    .values({
      jobId: job.id,
      status: "running",
      startedAt: new Date(),
    })
    .returning()

  const startTime = Date.now()

  try {
    console.log(`🚀 Executing job: ${job.name} (${job.jobType})`)

    let result: {
      output: string
      creditsUsed: number
      tokensUsed?: number
      tribePostId?: string
      moltPostId?: string
    }

    switch (job.jobType) {
      case "tribe_post":
        result = await executeTribePost(job)
        break

      case "moltbook_post":
        result = await executeMoltbookPost(job)
        break

      case "moltbook_comment":
        result = await executeMoltbookComment(job)
        break

      case "moltbook_engage":
        result = await executeMoltbookEngage(job)
        break

      default:
        throw new Error(`Unknown job type: ${job.jobType}`)
    }

    const duration = Date.now() - startTime

    // Update job run with success
    await db
      .update(scheduledJobRuns)
      .set({
        status: "success",
        completedAt: new Date(),
        output: result.output,
        creditsUsed: result.creditsUsed,
        tokensUsed: result.tokensUsed,
        duration,
        tribePostId: result.tribePostId,
        moltPostId: result.moltPostId,
      })
      .where(eq(scheduledJobRuns.id, jobRun.id))

    // Calculate next run time
    const nextRunAt =
      job.frequency === "once"
        ? null
        : calculateNextRunTime(job.scheduledTimes, job.timezone, job.frequency)

    // Update job stats
    await db
      .update(scheduledJobs)
      .set({
        lastRunAt: new Date(),
        nextRunAt,
        totalRuns: job.totalRuns + 1,
        successfulRuns: job.successfulRuns + 1,
        creditsUsed: job.creditsUsed + result.creditsUsed,
        status: job.frequency === "once" ? "completed" : job.status,
      })
      .where(eq(scheduledJobs.id, jobId))

    console.log(
      `✅ Job completed: ${job.name} (${duration}ms, ${result.creditsUsed} credits)`,
    )
  } catch (error) {
    captureException(error)
    console.error(`❌ Job failed: ${job.name}`, error)

    const duration = Date.now() - startTime

    // Update job run with failure
    await db
      .update(scheduledJobRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        duration,
      })
      .where(eq(scheduledJobRuns.id, jobRun.id))

    // Calculate next run time (even on failure to avoid tight loops)
    const nextRunAt =
      job.frequency === "once"
        ? null
        : calculateNextRunTime(job.scheduledTimes, job.timezone, job.frequency)

    // Update job stats
    await db
      .update(scheduledJobs)
      .set({
        lastRunAt: new Date(),
        nextRunAt,
        totalRuns: job.totalRuns + 1,
        failedRuns: job.failedRuns + 1,
        status: job.frequency === "once" ? "completed" : job.status,
      })
      .where(eq(scheduledJobs.id, jobId))
  }
}

async function executeTribePost(job: any) {
  // Get app details
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, job.appId),
  })

  if (!app) {
    throw new Error(`App not found: ${job.appId}`)
  }

  // Normalize provider name (DB stores lowercase, getModelProvider expects camelCase)
  const providerMap: Record<string, string> = {
    openai: "chatGPT",
    claude: "claude",
    deepseek: "deepSeek",
    sushi: "sushi",
  }
  const normalizedProvider = providerMap[job.aiModel] || job.aiModel

  // Generate content using AI
  const provider = await getModelProvider(app, normalizedProvider)

  const prompt = `You are creating a social media post for the app "${app.name}".

${job.contentTemplate ? `Content Template:\n${job.contentTemplate}\n\n` : ""}

${job.contentRules?.tone ? `Tone: ${job.contentRules.tone}\n` : ""}
${job.contentRules?.length ? `Length: ${job.contentRules.length}\n` : ""}
${job.contentRules?.topics?.length ? `Topics: ${job.contentRules.topics.join(", ")}\n` : ""}
${job.contentRules?.hashtags?.length ? `Hashtags: ${job.contentRules.hashtags.join(" ")}\n` : ""}

Generate an engaging post that follows these guidelines. Be creative and authentic.`

  const { text, usage } = await generateText({
    model: provider.provider,
    prompt,
    temperature: job.modelConfig?.temperature || 0.7,
    maxTokens: job.modelConfig?.maxTokens || 500,
  })

  // Auto-create/join tribe if specified in metadata
  let tribeId: string | null = null
  if (job.metadata?.tribe) {
    tribeId = await getOrCreateTribe({
      slug: job.metadata.tribe,
      userId: job.userId || undefined,
      guestId: undefined,
    })
  }

  // Create Tribe post
  const [post] = await db
    .insert(tribePosts)
    .values({
      appId: job.appId,
      userId: job.userId,
      content: text,
      visibility: "public",
      tribeId,
    })
    .returning()

  // Calculate credits used
  const defaultModel =
    job.modelConfig?.model || getDefaultModelForProvider(job.aiModel)
  const creditsUsed = await calculateCreditsFromUsage(
    usage?.promptTokens || 0,
    usage?.completionTokens || 0,
    job.aiModel,
    defaultModel,
  )

  return {
    output: text,
    creditsUsed,
    tokensUsed: (usage?.promptTokens || 0) + (usage?.completionTokens || 0),
    tribePostId: post.id,
  }
}

async function executeMoltbookPost(job: any) {
  // Get app details
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, job.appId),
  })

  if (!app) {
    throw new Error(`App not found: ${job.appId}`)
  }

  // Normalize provider name (DB stores lowercase, getModelProvider expects camelCase)
  const providerMap: Record<string, string> = {
    openai: "chatGPT",
    claude: "claude",
    deepseek: "deepSeek",
    sushi: "sushi",
  }
  const normalizedProvider = providerMap[job.aiModel] || job.aiModel

  // Generate content using AI
  const provider = await getModelProvider(app, normalizedProvider)

  const prompt = `You are posting to Moltbook on behalf of "${app.name}".

${job.contentTemplate ? `Content Template:\n${job.contentTemplate}\n\n` : ""}

${job.contentRules?.tone ? `Tone: ${job.contentRules.tone}\n` : ""}
${job.contentRules?.length ? `Length: ${job.contentRules.length}\n` : ""}
${job.contentRules?.topics?.length ? `Topics: ${job.contentRules.topics.join(", ")}\n` : ""}

Generate an engaging Moltbook post. Keep it concise and interesting.`

  const { text, usage } = await generateText({
    model: provider.provider,
    prompt,
    temperature: job.modelConfig?.temperature || 0.7,
    maxTokens: job.modelConfig?.maxTokens || 300,
  })

  // Post to Moltbook
  const moltbookApiKey = process.env.MOLTBOOK_API_KEY
  if (!moltbookApiKey) {
    throw new Error("MOLTBOOK_API_KEY not configured")
  }

  // Post to Moltbook with structured payload
  const result = await postToMoltbook(moltbookApiKey, {
    submolt: job.metadata?.submolt || "chrry",
    title: job.metadata?.title || "Scheduled Post",
    content: text,
    url: job.metadata?.url,
  })

  // Calculate credits used
  const defaultModel =
    job.modelConfig?.model || getDefaultModelForProvider(job.aiModel)
  const creditsUsed = await calculateCreditsFromUsage(
    usage?.promptTokens || 0,
    usage?.completionTokens || 0,
    job.aiModel,
    defaultModel,
  )

  if (!result.success) {
    throw new Error(result.error || "Failed to post to Moltbook")
  }

  return {
    output: text,
    creditsUsed,
    tokensUsed: (usage?.promptTokens || 0) + (usage?.completionTokens || 0),
    moltPostId: result.post_id,
  }
}

async function executeMoltbookComment(
  job: typeof scheduledJobs.$inferSelect,
): Promise<{
  output: string
  creditsUsed: number
}> {
  throw new Error("executeMoltbookComment not implemented")
}

async function executeMoltbookEngage(job: any) {
  // This would integrate with existing moltbookEngagement logic
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, job.appId),
  })

  if (!app) {
    throw new Error(`App not found: ${job.appId}`)
  }

  // Runtime check for function availability
  if (typeof engageWithMoltbookPosts !== "function") {
    throw new Error("engageWithMoltbookPosts is not available")
  }

  const result = await engageWithMoltbookPosts({ slug: app.slug || "chrry" })

  return {
    output: result?.output || "Moltbook engagement execution",
    creditsUsed: result?.creditsUsed || 50,
    tokensUsed: result?.tokensUsed,
  }
}

async function calculateCreditsFromUsage(
  inputTokens: number,
  outputTokens: number,
  provider: "openai" | "claude" | "deepseek" | "sushi",
  modelName: string,
): Promise<number> {
  // Use DB-backed pricing via calculateCreditsFromDB
  const estimate = await calculateCreditsFromDB({
    provider,
    modelName,
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    totalRuns: 1,
  })

  return estimate.estimatedCreditsPerRun
}

// Find jobs that need to run now
export async function findJobsToRun() {
  const now = new Date()

  const jobs = await db.query.scheduledJobs.findMany({
    where: and(
      eq(scheduledJobs.status, "active"),
      lte(scheduledJobs.startDate, now),
      or(isNull(scheduledJobs.endDate), gte(scheduledJobs.endDate, now)),
      or(isNull(scheduledJobs.nextRunAt), lte(scheduledJobs.nextRunAt, now)),
    ),
  })

  return jobs
}

// Calculate next run time based on schedule
export function calculateNextRunTime(
  scheduledTimes: string[],
  timezone: string,
  frequency: string,
): Date {
  // Convert current UTC time to target timezone
  const nowUtc = new Date()
  const zonedNow = utcToZonedTime(nowUtc, timezone)

  // Validate scheduledTimes is not empty
  if (!scheduledTimes || scheduledTimes.length === 0) {
    throw new Error("scheduledTimes cannot be empty")
  }

  // Get current time in target timezone
  const currentHour = zonedNow.getHours()
  const currentMinute = zonedNow.getMinutes()
  const currentTime = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`

  // Sort scheduledTimes in ascending order (invariant: must be sorted)
  const sortedTimes = [...scheduledTimes].sort()

  // Find next time slot in the scheduled times
  const nextTime = sortedTimes.find((time) => time > currentTime)

  let zonedNext: Date

  if (nextTime) {
    // Next run is today in target timezone
    const [hours, minutes] = nextTime.split(":").map(Number)
    zonedNext = new Date(zonedNow)
    zonedNext.setHours(hours, minutes, 0, 0)
  } else {
    // Next run is in the next period (day/week/month) in target timezone
    const [hours, minutes] = sortedTimes[0].split(":").map(Number)
    zonedNext = new Date(zonedNow)

    // Apply frequency-based increment
    switch (frequency.toLowerCase()) {
      case "daily":
        zonedNext.setDate(zonedNext.getDate() + 1)
        break
      case "weekly":
      case "week":
        zonedNext.setDate(zonedNext.getDate() + 7)
        break
      case "monthly":
      case "month":
        zonedNext.setMonth(zonedNext.getMonth() + 1)
        break
      default:
        // Default to daily for unknown frequencies
        zonedNext.setDate(zonedNext.getDate() + 1)
    }

    zonedNext.setHours(hours, minutes, 0, 0)
  }

  // Convert zoned time back to UTC
  return zonedTimeToUtc(zonedNext, timezone)
}
