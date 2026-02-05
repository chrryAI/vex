import { db } from "@repo/db"
import {
  scheduledJobs,
  scheduledJobRuns,
  tribePosts,
} from "@repo/db/src/schema"
import { eq, and, lte, gte, isNull, or } from "drizzle-orm"
import { generateText } from "ai"
import { getModelProvider } from "../getModelProvider"
import { captureException } from "@repo/ui/utils/errorTracking"
import { postToMoltbook } from "../moltbook"
import { engageWithMoltbookPosts } from "../cron/moltbookTrends"

interface ExecuteJobParams {
  jobId: string
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

    // Update job stats
    await db
      .update(scheduledJobs)
      .set({
        lastRunAt: new Date(),
        totalRuns: job.totalRuns + 1,
        successfulRuns: job.successfulRuns + 1,
        creditsUsed: job.creditsUsed + result.creditsUsed,
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

    // Update job stats
    await db
      .update(scheduledJobs)
      .set({
        lastRunAt: new Date(),
        totalRuns: job.totalRuns + 1,
        failedRuns: job.failedRuns + 1,
      })
      .where(eq(scheduledJobs.id, jobId))
  }
}

async function executeTribePost(job: any) {
  // Get app details
  const app = await db.query.apps.findFirst({
    where: eq(scheduledJobs.appId, job.appId),
  })

  if (!app) {
    throw new Error(`App not found: ${job.appId}`)
  }

  // Generate content using AI
  const provider = await getModelProvider(app, job.aiModel)

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

  // Create Tribe post
  const [post] = await db
    .insert(tribePosts)
    .values({
      appId: job.appId,
      userId: job.userId,
      content: text,
      visibility: "public",
    })
    .returning()

  // Calculate credits used
  const creditsUsed = calculateCreditsFromUsage(
    usage?.promptTokens || 0,
    usage?.completionTokens || 0,
    job.aiModel,
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
    where: eq(scheduledJobs.appId, job.appId),
  })

  if (!app) {
    throw new Error(`App not found: ${job.appId}`)
  }

  // Generate content using AI
  const provider = await getModelProvider(app, job.aiModel)

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

  const result = await postToMoltbook(moltbookApiKey, text)

  // Calculate credits used
  const creditsUsed = calculateCreditsFromUsage(
    usage?.promptTokens || 0,
    usage?.completionTokens || 0,
    job.aiModel,
  )

  return {
    output: text,
    creditsUsed,
    tokensUsed: (usage?.promptTokens || 0) + (usage?.completionTokens || 0),
    moltPostId: result.id,
  }
}

async function executeMoltbookComment(job: any) {
  // This would integrate with existing moltbookComments logic
  // For now, return placeholder
  return {
    output: "Moltbook comment execution",
    creditsUsed: 10,
  }
}

async function executeMoltbookEngage(job: any) {
  // This would integrate with existing moltbookTrends logic
  const app = await db.query.apps.findFirst({
    where: eq(scheduledJobs.appId, job.appId),
  })

  if (!app) {
    throw new Error(`App not found: ${job.appId}`)
  }

  await engageWithMoltbookPosts({ slug: app.slug || "chrry" })

  return {
    output: "Moltbook engagement execution",
    creditsUsed: 50, // Estimated
  }
}

function calculateCreditsFromUsage(
  inputTokens: number,
  outputTokens: number,
  provider: string,
): number {
  // Simplified credit calculation
  // In production, fetch from aiModelPricing table
  const rates: Record<string, { input: number; output: number }> = {
    openai: { input: 25, output: 100 },
    claude: { input: 30, output: 150 },
    deepseek: { input: 1, output: 2 },
    sushi: { input: 0, output: 0 },
  }

  const rate = rates[provider] || rates.openai
  const inputCost = (inputTokens / 1000) * rate.input
  const outputCost = (outputTokens / 1000) * rate.output

  return Math.ceil(inputCost + outputCost)
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
  const now = new Date()

  // Simple implementation - find next scheduled time
  // In production, use proper timezone handling
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTime = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`

  // Find next time slot
  const nextTime = scheduledTimes.find((time) => time > currentTime)

  if (nextTime) {
    // Today
    const [hours, minutes] = nextTime.split(":").map(Number)
    const next = new Date()
    next.setHours(hours, minutes, 0, 0)
    return next
  } else {
    // Tomorrow
    const [hours, minutes] = scheduledTimes[0].split(":").map(Number)
    const next = new Date()
    next.setDate(next.getDate() + 1)
    next.setHours(hours, minutes, 0, 0)
    return next
  }
}
