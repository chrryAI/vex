import type { scheduledJob } from "@repo/db"
import { assign, fromPromise, setup } from "xstate"

type EngageResult = {
  success?: boolean
  error?: string
  postsEngaged?: number
  reactionsAdded?: number
  commentsPosted?: number
  followsAdded?: number
}

export interface TribeEngageContext {
  job: scheduledJob
  languages?: string[]
  result: EngageResult | null
  error: string | null
  retryCount: number
  maxRetries: number
  startedAt: number
  completedAt: number | null
}

type TribeEngageEvent =
  | { type: "START" }
  | { type: "RETRY" }
  | { type: "CANCEL" }

const executeEngage = fromPromise(
  async ({ input }: { input: { job: scheduledJob; languages?: string[] } }) => {
    const { executeTribeEngageDirect } = await import(
      "../../scheduledJobs/jobScheduler"
    )
    const result = await executeTribeEngageDirect(input.job, input.languages)
    if (result?.error) {
      throw new Error(result.error)
    }
    return result
  },
)

export const tribeEngageMachine = setup({
  types: {
    context: {} as TribeEngageContext,
    events: {} as TribeEngageEvent,
    input: {} as { job: scheduledJob; languages?: string[] },
  },
  actors: {
    executeEngage,
  },
}).createMachine({
  id: "tribeEngage",
  initial: "executing",

  context: ({ input }) => ({
    job: input.job,
    languages: input.languages,
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
        console.log("🎭 [XState] tribeEngageMachine: executing")
      },
      invoke: {
        src: "executeEngage",
        input: ({ context }) => ({
          job: context.job,
          languages: context.languages,
        }),
        onDone: {
          target: "success",
          actions: assign({
            result: ({ event }) => event.output as EngageResult,
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
          `🎭 [XState] tribeEngageMachine: waiting before retry ${context.retryCount}/${context.maxRetries}`,
        )
      },
      after: {
        3000: "executing",
      },
    },

    success: {
      type: "final",
      entry: ({ context }) => {
        const duration = context.completedAt
          ? context.completedAt - context.startedAt
          : 0
        console.log(`🎭 [XState] tribeEngageMachine: success (${duration}ms)`)
      },
    },

    failed: {
      type: "final",
      entry: ({ context }) => {
        console.error(
          `🎭 [XState] tribeEngageMachine: failed after ${context.retryCount} retries - ${context.error}`,
        )
      },
    },
  },
})
