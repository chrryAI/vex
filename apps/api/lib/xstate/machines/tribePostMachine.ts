// import { setup, assign, fromPromise } from 'xstate';
// import type { scheduledJob, app } from '@repo/db';
// import { db, eq, apps, tribePosts, getUser } from '@repo/db';
// import { generateText } from 'ai';
// import { getModelProvider } from '../../getModelProvider';
// import { generateImage as genImage, generateVideo as genVideo } from '../../ai/mediaGeneration';
// import { getNewsContext } from '../../graph/graphService';
// import { postToBluesky, getBlueskyCredentials } from '../../bluesky';
// import { sendDiscordNotification } from '../../sendDiscordNotification';
// import { autoTranslateTribeContent } from '../../cron/tribeAutoTranslate';
// import { isDevelopment } from '../..';

// // Machine context type
// interface TribePostContext {
//   job: scheduledJob;
//   app: app | null;
//   user: any | null;
//   generatedContent: string | null;
//   generatedTitle: string | null;
//   imageUrl: string | null;
//   videoUrl: string | null;
//   newsContext: string | null;
//   postId: string | null;
//   error: Error | null;
//   cooldownMinutes: number;
//   postType?: string;
//   generateImage?: boolean;
//   generateVideo?: boolean;
//   fetchNews?: boolean;
// }

// // Machine events
// type TribePostEvent =
//   | { type: 'START' }
//   | { type: 'RETRY' }
//   | { type: 'CANCEL' };

// // Actor implementations
// const actors = {
//   // Load app and user data
//   loadAppAndUser: fromPromise(async ({ input }: { input: { job: scheduledJob } }) => {
//     const { job } = input;

//     if (!job.appId) {
//       throw new Error('App not found for Tribe posting');
//     }

//     const app = await db.query.apps.findFirst({
//       where: eq(apps.id, job.appId),
//     });

//     if (!app) {
//       throw new Error('App not found for Tribe posting');
//     }

//     if (!app.userId) {
//       throw new Error('This app is not owned by any user');
//     }

//     const user = await getUser({ id: app.userId });

//     if (!user) {
//       throw new Error('User not found');
//     }

//     return { app, user };
//   }),

//   // Check cooldown
//   checkCooldown: fromPromise(async ({ input }: { input: { app: app; cooldownMinutes: number } }) => {
//     const { app, cooldownMinutes } = input;

//     if (isDevelopment) {
//       console.log(`🔧 [DEV] Cooldown check skipped (cooldownMinutes: ${cooldownMinutes})`);
//       return { canPost: true };
//     }

//     const recentPosts = await db.query.tribePosts.findMany({
//       where: eq(tribePosts.appId, app.id),
//       orderBy: (tribePosts, { desc }) => [desc(tribePosts.createdOn)],
//       limit: 5,
//       columns: { id: true, title: true, createdOn: true },
//     });

//     const lastPost = recentPosts[0];
//     if (lastPost) {
//       const minutesSinceLastPost = (Date.now() - lastPost.createdOn.getTime()) / 60000;
//       if (minutesSinceLastPost < cooldownMinutes) {
//         const minutesLeft = Math.ceil(cooldownMinutes - minutesSinceLastPost);
//         throw new Error(`Cooldown active. Try again in ${minutesLeft} minutes.`);
//       }
//     }

//     return { canPost: true, recentPosts };
//   }),

//   // Fetch news context
//   fetchNews: fromPromise(async ({ input }: { input: { app: app } }) => {
//     const { app } = input;
//     const newsContext = await getNewsContext({
//       appId: app.id,
//       limit: 3,
//     });
//     return { newsContext };
//   }),

//   // Generate content with AI
//   generateContent: fromPromise(async ({ input }: { input: {
//     app: app;
//     job: scheduledJob;
//     newsContext: string | null;
//     recentPosts: any[];
//   } }) => {
//     const { app, job, newsContext, recentPosts } = input;

//     const recentPostTitles = recentPosts
//       .map((p) => p.title)
//       .filter(Boolean)
//       .join('\n- ');

//     const systemPrompt = app.systemPrompt || 'You are a helpful AI assistant.';

//     const prompt = `${systemPrompt}

// ${newsContext ? `Recent news context:\n${newsContext}\n\n` : ''}

// Recent posts (avoid duplicating these topics):
// - ${recentPostTitles}

// Generate a unique, engaging post for the Tribe community. Be creative and authentic.

// Format:
// TITLE: [catchy title]
// CONTENT: [engaging content]`;

//     const { model, provider } = await getModelProvider({
//       job,
//       supportsTools: false,
//     });

//     const result = await generateText({
//       model: provider.languageModel(model),
//       prompt,
//       maxTokens: 1000,
//     });

//     const text = result.text;
//     const titleMatch = text.match(/TITLE:\s*(.+)/);
//     const contentMatch = text.match(/CONTENT:\s*([\s\S]+)/);

//     const title = titleMatch?.[1]?.trim() || 'Untitled Post';
//     const content = contentMatch?.[1]?.trim() || text;

//     return { title, content };
//   }),

//   // Generate image
//   generateImage: fromPromise(async ({ input }: { input: { title: string; content: string } }) => {
//     const { title, content } = input;
//     const imageUrl = await genImage({
//       prompt: `${title}\n\n${content}`,
//       model: 'flux-pro',
//     });
//     return { imageUrl };
//   }),

//   // Generate video
//   generateVideo: fromPromise(async ({ input }: { input: { title: string; content: string } }) => {
//     const { title, content } = input;
//     const videoUrl = await genVideo({
//       prompt: `${title}\n\n${content}`,
//     });
//     return { videoUrl };
//   }),

//   // Create post in database
//   createPost: fromPromise(async ({ input }: { input: {
//     app: app;
//     user: any;
//     title: string;
//     content: string;
//     imageUrl: string | null;
//     videoUrl: string | null;
//   } }) => {
//     const { app, user, title, content, imageUrl, videoUrl } = input;

//     const [newPost] = await db.insert(tribePosts).values({
//       appId: app.id,
//       userId: user.id,
//       title,
//       content,
//       imageUrl,
//       videoUrl,
//       createdOn: new Date(),
//     }).returning();

//     return { postId: newPost.id, post: newPost };
//   }),

//   // Auto-translate post
//   translatePost: fromPromise(async ({ input }: { input: {
//     appId: string;
//     userId: string;
//     postId: string;
//   } }) => {
//     const { appId, userId, postId } = input;

//     await autoTranslateTribeContent({
//       appId,
//       userId,
//       postIds: [postId],
//       languages: ['en', 'tr', 'de', 'fr', 'es', 'ja', 'ko', 'zh'],
//     });

//     return { translated: true };
//   }),

//   // Post to Bluesky
//   postToBluesky: fromPromise(async ({ input }: { input: {
//     app: app;
//     title: string;
//     content: string;
//     postId: string;
//   } }) => {
//     const { app, title, content, postId } = input;

//     const credentials = getBlueskyCredentials(app.slug);
//     if (!credentials) {
//       console.log(`⏭️ No Bluesky credentials for ${app.slug}, skipping`);
//       return { posted: false };
//     }

//     const postUrl = `https://tribe.chrry.ai/post/${postId}`;
//     const blueskyText = `${title}\n\n${content.substring(0, 200)}...\n\n${postUrl}`;

//     await postToBluesky(credentials, blueskyText);
//     return { posted: true };
//   }),

//   // Send Discord notification
//   notifyDiscord: fromPromise(async ({ input }: { input: {
//     app: app;
//     title: string;
//     postId: string;
//   } }) => {
//     const { app, title, postId } = input;

//     await sendDiscordNotification(
//       {
//         embeds: [{
//           title: '✅ Tribe Post Created',
//           color: 0x10b981,
//           fields: [
//             { name: 'Agent', value: app.name || 'Unknown', inline: true },
//             { name: 'Title', value: title, inline: false },
//             { name: 'Post ID', value: postId, inline: true },
//           ],
//           timestamp: new Date().toISOString(),
//         }],
//       },
//       process.env.DISCORD_TRIBE_WEBHOOK_URL,
//     );

//     return { notified: true };
//   }),
// };

// // Guards
// const guards = {
//   shouldGenerateImage: ({ context }: { context: TribePostContext }) =>
//     context.generateImage === true,

//   shouldGenerateVideo: ({ context }: { context: TribePostContext }) =>
//     context.generateVideo === true,

//   shouldFetchNews: ({ context }: { context: TribePostContext }) =>
//     context.fetchNews === true,
// };

// // Create the machine
// export const tribePostMachine = setup({
//   types: {
//     context: {} as TribePostContext,
//     events: {} as TribePostEvent,
//   },
//   actors,
//   guards,
// }).createMachine({
//   id: 'tribePost',
//   initial: 'loadingAppAndUser',

//   context: ({ input }: { input: Partial<TribePostContext> }) => ({
//     job: input.job!,
//     app: null,
//     user: null,
//     generatedContent: null,
//     generatedTitle: null,
//     imageUrl: null,
//     videoUrl: null,
//     newsContext: null,
//     postId: null,
//     error: null,
//     cooldownMinutes: input.cooldownMinutes || 120,
//     postType: input.postType,
//     generateImage: input.generateImage,
//     generateVideo: input.generateVideo,
//     fetchNews: input.fetchNews,
//   }),

//   states: {
//     loadingAppAndUser: {
//       invoke: {
//         src: 'loadAppAndUser',
//         input: ({ context }) => ({ job: context.job }),
//         onDone: {
//           target: 'checkingCooldown',
//           actions: assign({
//             app: ({ event }) => event.output.app,
//             user: ({ event }) => event.output.user,
//           }),
//         },
//         onError: {
//           target: 'error',
//           actions: assign({
//             error: ({ event }) => event.error as Error,
//           }),
//         },
//       },
//     },

//     checkingCooldown: {
//       invoke: {
//         src: 'checkCooldown',
//         input: ({ context }) => ({
//           app: context.app!,
//           cooldownMinutes: context.cooldownMinutes
//         }),
//         onDone: {
//           target: 'decidingNews',
//         },
//         onError: {
//           target: 'cooldownActive',
//           actions: assign({
//             error: ({ event }) => event.error as Error,
//           }),
//         },
//       },
//     },

//     decidingNews: {
//       always: [
//         {
//           guard: 'shouldFetchNews',
//           target: 'fetchingNews',
//         },
//         {
//           target: 'generatingContent',
//         },
//       ],
//     },

//     fetchingNews: {
//       invoke: {
//         src: 'fetchNews',
//         input: ({ context }) => ({ app: context.app! }),
//         onDone: {
//           target: 'generatingContent',
//           actions: assign({
//             newsContext: ({ event }) => event.output.newsContext,
//           }),
//         },
//         onError: {
//           target: 'generatingContent', // Continue without news
//         },
//       },
//     },

//     generatingContent: {
//       invoke: {
//         src: 'generateContent',
//         input: ({ context }) => ({
//           app: context.app!,
//           job: context.job,
//           newsContext: context.newsContext,
//           recentPosts: [],
//         }),
//         onDone: {
//           target: 'decidingMedia',
//           actions: assign({
//             generatedTitle: ({ event }) => event.output.title,
//             generatedContent: ({ event }) => event.output.content,
//           }),
//         },
//         onError: {
//           target: 'error',
//           actions: assign({
//             error: ({ event }) => event.error as Error,
//           }),
//         },
//       },
//     },

//     decidingMedia: {
//       always: [
//         {
//           guard: 'shouldGenerateImage',
//           target: 'generatingImage',
//         },
//         {
//           guard: 'shouldGenerateVideo',
//           target: 'generatingVideo',
//         },
//         {
//           target: 'creatingPost',
//         },
//       ],
//     },

//     generatingImage: {
//       invoke: {
//         src: 'generateImage',
//         input: ({ context }) => ({
//           title: context.generatedTitle!,
//           content: context.generatedContent!,
//         }),
//         onDone: {
//           target: 'creatingPost',
//           actions: assign({
//             imageUrl: ({ event }) => event.output.imageUrl,
//           }),
//         },
//         onError: {
//           target: 'creatingPost', // Continue without image
//         },
//       },
//     },

//     generatingVideo: {
//       invoke: {
//         src: 'generateVideo',
//         input: ({ context }) => ({
//           title: context.generatedTitle!,
//           content: context.generatedContent!,
//         }),
//         onDone: {
//           target: 'creatingPost',
//           actions: assign({
//             videoUrl: ({ event }) => event.output.videoUrl,
//           }),
//         },
//         onError: {
//           target: 'creatingPost', // Continue without video
//         },
//       },
//     },

//     creatingPost: {
//       invoke: {
//         src: 'createPost',
//         input: ({ context }) => ({
//           app: context.app!,
//           user: context.user!,
//           title: context.generatedTitle!,
//           content: context.generatedContent!,
//           imageUrl: context.imageUrl,
//           videoUrl: context.videoUrl,
//         }),
//         onDone: {
//           target: 'translatingPost',
//           actions: assign({
//             postId: ({ event }) => event.output.postId,
//           }),
//         },
//         onError: {
//           target: 'error',
//           actions: assign({
//             error: ({ event }) => event.error as Error,
//           }),
//         },
//       },
//     },

//     translatingPost: {
//       invoke: {
//         src: 'translatePost',
//         input: ({ context }) => ({
//           appId: context.app!.id,
//           userId: context.user!.id,
//           postId: context.postId!,
//         }),
//         onDone: {
//           target: 'postingToBluesky',
//         },
//         onError: {
//           target: 'postingToBluesky', // Continue without translation
//         },
//       },
//     },

//     postingToBluesky: {
//       invoke: {
//         src: 'postToBluesky',
//         input: ({ context }) => ({
//           app: context.app!,
//           title: context.generatedTitle!,
//           content: context.generatedContent!,
//           postId: context.postId!,
//         }),
//         onDone: {
//           target: 'notifyingDiscord',
//         },
//         onError: {
//           target: 'notifyingDiscord', // Continue without Bluesky
//         },
//       },
//     },

//     notifyingDiscord: {
//       invoke: {
//         src: 'notifyDiscord',
//         input: ({ context }) => ({
//           app: context.app!,
//           title: context.generatedTitle!,
//           postId: context.postId!,
//         }),
//         onDone: {
//           target: 'success',
//         },
//         onError: {
//           target: 'success', // Success even if Discord fails
//         },
//       },
//     },

//     success: {
//       type: 'final',
//     },

//     cooldownActive: {
//       on: {
//         RETRY: 'checkingCooldown',
//       },
//     },

//     error: {
//       on: {
//         RETRY: 'loadingAppAndUser',
//       },
//     },
//   },
// });
