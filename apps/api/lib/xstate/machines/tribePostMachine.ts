import type { scheduledJob } from "@repo/db"
import { assign, fromPromise, setup } from "xstate"

// Import existing job handler - XState wraps it, doesn't replace it
// The actual complex logic (API calls, AI generation, media, Bluesky, etc.)
// lives in jobScheduler.ts and is reused here
type PostResult = {
  success?: boolean
  error?: string
  output?: string
  post_id?: string
  tribeTitle?: string
  tribeName?: string
}

// Machine context type
export interface TribePostContext {
  job: scheduledJob
  result: PostResult | null
  error: string | null
  retryCount: number
  maxRetries: number
  startedAt: number
  completedAt: number | null
}

// Machine events
type TribePostEvent = { type: "START" } | { type: "RETRY" } | { type: "CANCEL" }

// Actor: Execute the tribe post job using the existing async handler
const executePost = fromPromise(
  async ({
    input,
  }: {
    input: {
      job: scheduledJob
      postType?: string
      generateImage?: boolean
      generateVideo?: boolean
      fetchNews?: boolean
      languages?: string[]
    }
  }) => {
    // Dynamically import to avoid circular dependency
    const { executeTribePostDirect } = await import(
      "../../scheduledJobs/jobScheduler"
    )
    const result = await executeTribePostDirect(input)
    if (!result.success) {
      throw new Error(result.error || "Post creation failed")
    }
    return result
  },
)

// Create the machine
export const tribePostMachine = setup({
  types: {
    context: {} as TribePostContext,
    events: {} as TribePostEvent,
    input: {} as {
      job: scheduledJob
      postType?: string
      generateImage?: boolean
      generateVideo?: boolean
      fetchNews?: boolean
      languages?: string[]
    },
  },
  actors: {
    executePost,
  },
}).createMachine({
  id: "tribePost",
  initial: "executing",

  context: ({ input }) => ({
    job: input.job,
    result: null,
    error: null,
    retryCount: 0,
    maxRetries: 1,
    startedAt: Date.now(),
    completedAt: null,
  }),

  states: {
    executing: {
      entry: () => {
        console.log("🎭 [XState] tribePostMachine: executing")
      },
      invoke: {
        src: "executePost",
        input: ({ context }) => ({
          job: context.job,
          postType: (context.job.metadata as any)?.postType,
          generateImage: (context.job.metadata as any)?.generateImage,
          generateVideo: (context.job.metadata as any)?.generateVideo,
          fetchNews: (context.job.metadata as any)?.fetchNews,
          languages: (context.job.metadata as any)?.languages,
        }),
        onDone: {
          target: "success",
          actions: assign({
            result: ({ event }) => event.output as PostResult,
            completedAt: () => Date.now(),
          }),
        },
        onError: {
          target: "retrying",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : String(event.error),
          }),
        },
      },
    },

    retrying: {
      always: [
        {
          guard: ({ context }) => context.retryCount < context.maxRetries,
          target: "waiting",
          actions: assign({
            retryCount: ({ context }) => context.retryCount + 1,
          }),
        },
        {
          target: "failed",
        },
      ],
    },

    waiting: {
      entry: ({ context }) => {
        console.log(
          `🎭 [XState] tribePostMachine: waiting before retry ${context.retryCount}/${context.maxRetries}`,
        )
      },
      after: {
        5000: "executing", // Wait 5s before retry
      },
    },

    success: {
      type: "final",
      entry: ({ context }) => {
        const duration = context.completedAt
          ? context.completedAt - context.startedAt
          : 0
        console.log(
          `🎭 [XState] tribePostMachine: success (${duration}ms, post: ${context.result?.post_id})`,
        )
      },
    },

    failed: {
      type: "final",
      entry: ({ context }) => {
        console.error(
          `🎭 [XState] tribePostMachine: failed after ${context.retryCount} retries - ${context.error}`,
        )
      },
    },
  },
})
