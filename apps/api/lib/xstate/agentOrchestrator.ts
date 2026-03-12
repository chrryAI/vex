// import { setup, assign, createActor, type ActorRefFrom } from "xstate"
// import type { scheduledJob } from "@repo/db"
// import { tribePostMachine } from "./machines/tribePostMachine"

// // Orchestrator context
// interface OrchestratorContext {
//   agents: {
//     lucas?: ActorRefFrom<typeof tribePostMachine>
//     zarathustra?: ActorRefFrom<typeof tribePostMachine>
//     chrry?: ActorRefFrom<typeof tribePostMachine>
//     sushi?: ActorRefFrom<typeof tribePostMachine>
//   }
//   activeJobs: Map<string, scheduledJob>
//   completedJobs: string[]
//   failedJobs: Map<string, Error>
// }

// // Orchestrator events
// type OrchestratorEvent =
//   | { type: "SCHEDULE_JOB"; job: scheduledJob; agentName: string }
//   | { type: "JOB_COMPLETED"; jobId: string }
//   | { type: "JOB_FAILED"; jobId: string; error: Error }
//   | { type: "SPAWN_AGENT"; agentName: string }
//   | { type: "STOP_AGENT"; agentName: string }

// // Create orchestrator machine
// export const agentOrchestrator = setup({
//   types: {
//     context: {} as OrchestratorContext,
//     events: {} as OrchestratorEvent,
//   },
//   actors: {
//     tribePostMachine,
//   },
// }).createMachine({
//   id: "agentOrchestrator",
//   initial: "idle",

//   context: {
//     agents: {},
//     activeJobs: new Map(),
//     completedJobs: [],
//     failedJobs: new Map(),
//   },

//   states: {
//     idle: {
//       on: {
//         SPAWN_AGENT: {
//           target: "spawningAgent",
//         },
//         SCHEDULE_JOB: {
//           target: "schedulingJob",
//         },
//       },
//     },

//     spawningAgent: {
//       entry: assign({
//         agents: ({ context, event }) => {
//           if (event.type !== "SPAWN_AGENT") return context.agents

//           const { agentName } = event
//           console.log(`🤖 Spawning agent: ${agentName}`)

//           // Don't spawn if already exists
//           if (context.agents[agentName as keyof typeof context.agents]) {
//             console.log(`⚠️ Agent ${agentName} already exists`)
//             return context.agents
//           }

//           return {
//             ...context.agents,
//             [agentName]: null, // Will be spawned when job is scheduled
//           }
//         },
//       }),
//       always: "idle",
//     },

//     schedulingJob: {
//       entry: assign({
//         activeJobs: ({ context, event }) => {
//           if (event.type !== "SCHEDULE_JOB") return context.activeJobs

//           const { job } = event
//           console.log(
//             `📅 Scheduling job: ${job.id} for agent: ${event.agentName}`,
//           )

//           const newActiveJobs = new Map(context.activeJobs)
//           newActiveJobs.set(job.id, job)
//           return newActiveJobs
//         },
//       }),
//       always: "runningJob",
//     },

//     runningJob: {
//       invoke: {
//         src: "tribePostMachine",
//         input: ({ context, event }) => {
//           if (event.type !== "SCHEDULE_JOB") return {}

//           const { job } = event
//           return {
//             job,
//             cooldownMinutes: job.metadata?.cooldownMinutes || 120,
//             generateImage: job.metadata?.generateImage,
//             generateVideo: job.metadata?.generateVideo,
//             fetchNews: job.metadata?.fetchNews,
//           }
//         },
//         onDone: {
//           target: "jobCompleted",
//         },
//         onError: {
//           target: "jobFailed",
//         },
//       },
//     },

//     jobCompleted: {
//       entry: assign({
//         completedJobs: ({ context, event }) => {
//           const jobId = context.activeJobs.keys().next().value
//           console.log(`✅ Job completed: ${jobId}`)
//           return [...context.completedJobs, jobId]
//         },
//         activeJobs: ({ context }) => {
//           const newActiveJobs = new Map(context.activeJobs)
//           const jobId = newActiveJobs.keys().next().value
//           newActiveJobs.delete(jobId)
//           return newActiveJobs
//         },
//       }),
//       always: "idle",
//     },

//     jobFailed: {
//       entry: assign({
//         failedJobs: ({ context, event }) => {
//           const jobId = context.activeJobs.keys().next().value
//           const error = event.error as Error
//           console.error(`❌ Job failed: ${jobId}`, error)

//           const newFailedJobs = new Map(context.failedJobs)
//           newFailedJobs.set(jobId, error)
//           return newFailedJobs
//         },
//         activeJobs: ({ context }) => {
//           const newActiveJobs = new Map(context.activeJobs)
//           const jobId = newActiveJobs.keys().next().value
//           newActiveJobs.delete(jobId)
//           return newActiveJobs
//         },
//       }),
//       always: "idle",
//     },
//   },
// })

// // Create and export the orchestrator actor
// export function createOrchestrator() {
//   const actor = createActor(agentOrchestrator)

//   // Subscribe to state changes
//   actor.subscribe((state) => {
//     console.log("🎭 Orchestrator state:", state.value)
//     console.log("📊 Active jobs:", state.context.activeJobs.size)
//     console.log("✅ Completed:", state.context.completedJobs.length)
//     console.log("❌ Failed:", state.context.failedJobs.size)
//   })

//   actor.start()
//   return actor
// }

// // Helper function to schedule a job
// export function scheduleJob(
//   orchestrator: ActorRefFrom<typeof agentOrchestrator>,
//   job: scheduledJob,
//   agentName: string = "default",
// ) {
//   orchestrator.send({
//     type: "SCHEDULE_JOB",
//     job,
//     agentName,
//   })
// }

// // Helper to spawn an agent
// export function spawnAgent(
//   orchestrator: ActorRefFrom<typeof agentOrchestrator>,
//   agentName: string,
// ) {
//   orchestrator.send({
//     type: "SPAWN_AGENT",
//     agentName,
//   })
// }
