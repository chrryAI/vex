import type { scheduledJob } from "@repo/db"
import { type AnyActorRef, createActor } from "xstate"
import { tribeCommentMachine } from "./machines/tribeCommentMachine"
import { tribeEngageMachine } from "./machines/tribeEngageMachine"
import { tribePostMachine } from "./machines/tribePostMachine"

// Map of job types to their XState machines
const MACHINE_MAP = {
  tribe_post: tribePostMachine,
  tribe_comment: tribeCommentMachine,
  tribe_engage: tribeEngageMachine,
} as const

type SupportedJobType = keyof typeof MACHINE_MAP

// Track active jobs
const activeJobs = new Map<string, { actor: AnyActorRef; startedAt: number }>()
const completedJobs: Array<{
  jobId: string
  success: boolean
  duration: number
  completedAt: number
}> = []

export function isSupportedJobType(
  jobType: string,
): jobType is SupportedJobType {
  return jobType in MACHINE_MAP
}

/**
 * Execute a scheduled job via XState state machine
 * Returns a promise that resolves when the machine reaches a final state
 */
export async function executeJobViaXState(
  job: scheduledJob,
  options?: { languages?: string[]; effectiveJobType?: string },
): Promise<{
  success: boolean
  error?: string
  output?: any
}> {
  // Use effectiveJobType override (for custom frequency jobs where a single job
  // runs different slot types like post/comment/engage sequentially)
  const jobType = (options?.effectiveJobType || job.jobType) as string

  if (!isSupportedJobType(jobType)) {
    throw new Error(`Unsupported XState job type: ${jobType}`)
  }

  // Use composite key: same job can run different types sequentially (post/comment/engage)
  const jobKey = `${job.id}:${jobType}`

  // Check if this specific job+type combo is already running
  if (activeJobs.has(jobKey)) {
    console.log(`🎭 [XState] Job ${jobKey} already running, skipping`)
    return { success: false, error: "Job already running" }
  }

  console.log(
    `🎭 [XState] Starting ${jobType} machine for job ${job.id} (${job.name})`,
  )

  return new Promise((resolve) => {
    const machine = MACHINE_MAP[jobType]

    // Prepare input based on job type
    const input =
      jobType === "tribe_engage"
        ? { job, languages: options?.languages }
        : { job }

    const actor = createActor(machine, { input: input as any })

    activeJobs.set(jobKey, { actor, startedAt: Date.now() })

    // Subscribe to state changes for logging
    actor.subscribe((snapshot) => {
      const state =
        typeof snapshot.value === "string"
          ? snapshot.value
          : JSON.stringify(snapshot.value)
      console.log(`🎭 [XState] ${jobType}/${job.id}: ${state}`)
    })

    // Handle completion
    actor.subscribe({
      complete: () => {
        const entry = activeJobs.get(jobKey)
        const duration = entry ? Date.now() - entry.startedAt : 0
        activeJobs.delete(jobKey)

        const snapshot = actor.getSnapshot()
        const context = snapshot.context as any
        const success = snapshot.value === "success"

        completedJobs.push({
          jobId: job.id,
          success,
          duration,
          completedAt: Date.now(),
        })

        // Keep only last 100 completed jobs
        if (completedJobs.length > 100) {
          completedJobs.splice(0, completedJobs.length - 100)
        }

        if (success) {
          resolve({
            success: true,
            output: context.result,
          })
        } else {
          resolve({
            success: false,
            error: context.error || "Job failed",
          })
        }
      },
      error: (err) => {
        activeJobs.delete(jobKey)
        console.error(`🎭 [XState] ${jobType}/${job.id}: actor error`, err)
        resolve({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        })
      },
    })

    actor.start()
  })
}

// Stats for monitoring
export function getOrchestratorStats() {
  return {
    activeJobs: activeJobs.size,
    activeJobIds: Array.from(activeJobs.keys()),
    recentCompleted: completedJobs.slice(-10),
    totalCompleted: completedJobs.length,
    successRate:
      completedJobs.length > 0
        ? completedJobs.filter((j) => j.success).length / completedJobs.length
        : 0,
  }
}

export function isOrchestratorReady(): boolean {
  return true // Stateless - always ready
}
