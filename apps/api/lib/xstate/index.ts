// import type { scheduledJob } from '@repo/db';
// import { createOrchestrator, scheduleJob, spawnAgent } from './agentOrchestrator';

// // Global orchestrator instance
// let orchestratorInstance: ReturnType<typeof createOrchestrator> | null = null;

// // Initialize orchestrator
// export function initializeOrchestrator() {
//   if (orchestratorInstance) {
//     console.log('🎭 Orchestrator already initialized');
//     return orchestratorInstance;
//   }

//   console.log('🚀 Initializing XState Orchestrator...');
//   orchestratorInstance = createOrchestrator();

//   // Spawn default agents
//   spawnAgent(orchestratorInstance, 'lucas');
//   spawnAgent(orchestratorInstance, 'zarathustra');
//   spawnAgent(orchestratorInstance, 'chrry');
//   spawnAgent(orchestratorInstance, 'sushi');

//   console.log('✅ XState Orchestrator initialized with 4 agents');
//   return orchestratorInstance;
// }

// // Get orchestrator instance
// export function getOrchestrator() {
//   if (!orchestratorInstance) {
//     return initializeOrchestrator();
//   }
//   return orchestratorInstance;
// }

// // Execute a scheduled job via XState
// export async function executeJobViaXState(job: scheduledJob): Promise<{
//   success: boolean;
//   error?: string;
//   output?: any;
// }> {
//   try {
//     const orchestrator = getOrchestrator();

//     // Determine agent name based on job metadata or app
//     const agentName = job.metadata?.agentName || 'default';

//     console.log(`🎯 Executing job ${job.id} via XState (agent: ${agentName})`);

//     // Schedule the job
//     scheduleJob(orchestrator, job, agentName);

//     // Wait for job completion (simplified - in production use proper event handling)
//     return new Promise((resolve) => {
//       const subscription = orchestrator.subscribe((state) => {
//         // Check if job completed
//         if (state.context.completedJobs.includes(job.id)) {
//           subscription.unsubscribe();
//           resolve({
//             success: true,
//             output: 'Job completed successfully via XState',
//           });
//         }

//         // Check if job failed
//         if (state.context.failedJobs.has(job.id)) {
//           const error = state.context.failedJobs.get(job.id);
//           subscription.unsubscribe();
//           resolve({
//             success: false,
//             error: error?.message || 'Job failed',
//           });
//         }
//       });

//       // Timeout after 5 minutes
//       setTimeout(() => {
//         subscription.unsubscribe();
//         resolve({
//           success: false,
//           error: 'Job execution timeout',
//         });
//       }, 5 * 60 * 1000);
//     });
//   } catch (error) {
//     console.error('❌ XState execution error:', error);
//     return {
//       success: false,
//       error: error instanceof Error ? error.message : String(error),
//     };
//   }
// }

// // Export machine types for external use
// export { tribePostMachine } from './machines/tribePostMachine';
// export { agentOrchestrator } from './agentOrchestrator';
