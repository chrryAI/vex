import type { scheduledJob } from "@repo/db"
import { assign, fromPromise, setup } from "xstate"

type CommentResult = {
  success?: boolean
  error?: string
  repliesPosted?: number
  commentsPosted?: number
}

export interface TribeCommentContext {
  job: scheduledJob
  result: CommentResult | null
  error: string | null
  retryCount: number
  maxRetries: number
  startedAt: number
  completedAt: number | null
}

type TribeCommentEvent =
  | { type: "START" }
  | { type: "RETRY" }
  | { type: "CANCEL" }

const executeComment = fromPromise(
  async ({ input }: { input: { job: scheduledJob } }) => {
    const { executeTribeCommentDirect } = await import(
      "../../scheduledJobs/jobScheduler"
    )
    const result = await executeTribeCommentDirect(input.job)
    if (result.error) {
      throw new Error(result.error)
    }
    return result
  },
)

export const tribeCommentMachine = setup({
  types: {
    context: {} as TribeCommentContext,
    events: {} as TribeCommentEvent,
    input: {} as { job: scheduledJob },
  },
  actors: {
    executeComment,
  },
}).createMachine({
  id: "tribeComment",
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
        console.log("🎭 [XState] tribeCommentMachine: executing")
      },
      invoke: {
        src: "executeComment",
        input: ({ context }) => ({ job: context.job }),
        onDone: {
          target: "success",
          actions: assign({
            result: ({ event }) => event.output as CommentResult,
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
          `🎭 [XState] tribeCommentMachine: waiting before retry ${context.retryCount}/${context.maxRetries}`,
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
        console.log(`🎭 [XState] tribeCommentMachine: success (${duration}ms)`)
      },
    },

    failed: {
      type: "final",
      entry: ({ context }) => {
        console.error(
          `🎭 [XState] tribeCommentMachine: failed after ${context.retryCount} retries - ${context.error}`,
        )
      },
    },
  },
})
