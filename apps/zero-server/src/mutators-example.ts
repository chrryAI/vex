// /**
//  * Zero Custom Mutators - Reusing Existing DB Functions
//  *
//  * These mutators call your existing database functions from @repo/db
//  * This ensures consistency and avoids code duplication
//  */

// import {
//   createMessage,
//   createThread,
//   updateUser,
//   deleteMessage,
//   updateThread,
//   createTask,
//   updateTask,
//   deleteTask,
//   createMood,
//   type newMessage,
//   type newThread,
//   type user,
//   type message,
//   type thread,
//   type newTask,
//   type task,
//   type newMood,
// } from "@repo/db"

// /**
//  * Example mutators that reuse your existing database functions
//  *
//  * When Zero server is implemented, these will be registered like:
//  *
//  * const server = createZeroServer({
//  *   schema,
//  *   mutators: {
//  *     createMessage: async (args, { userID }) => {
//  *       // Call existing function
//  *       return await createMessage({ ...args, userId: userID })
//  *     }
//  *   }
//  * })
//  */

// export const mutators = {
//   /**
//    * Create a new message
//    * Reuses: createMessage from @repo/db
//    */
//   createMessage: async (
//     args: Omit<newMessage, "userId" | "guestId">,
//     { userID }: { userID: string },
//   ) => {
//     // Determine if user or guest
//     const isUser = userID.startsWith("user_") // Adjust based on your ID format

//     const message = await createMessage({
//       ...args,
//       userId: isUser ? userID : null,
//       guestId: isUser ? null : userID,
//     })

//     return { id: message?.id }
//   },

//   /**
//    * Create a new thread
//    * Reuses: createThread from @repo/db
//    */
//   createThread: async (
//     args: Omit<newThread, "userId" | "guestId">,
//     { userID }: { userID: string },
//   ) => {
//     const isUser = userID.startsWith("user_")

//     const thread = await createThread({
//       ...args,
//       userId: isUser ? userID : null,
//       guestId: isUser ? null : userID,
//     })

//     return { id: thread?.id }
//   },

//   /**
//    * Update user profile
//    * Reuses: updateUser from @repo/db
//    */
//   updateProfile: async (
//     args: Partial<user>,
//     { userID }: { userID: string },
//   ) => {
//     // Verify user is updating their own profile
//     if (args.id && args.id !== userID) {
//       throw new Error("Cannot update another user's profile")
//     }

//     const updated = await updateUser({
//       ...args,
//       id: userID,
//     } as user)

//     return { success: !!updated }
//   },

//   /**
//    * Delete a message
//    * Reuses: deleteMessage from @repo/db
//    */
//   deleteMessage: async (
//     args: { messageId: string },
//     { userID }: { userID: string },
//   ) => {
//     // Your existing deleteMessage already handles ownership verification
//     // through the getMessage check in the route
//     const deleted = await deleteMessage({ id: args.messageId })

//     return { success: !!deleted }
//   },

//   /**
//    * Archive a thread
//    * Reuses: updateThread from @repo/db
//    */
//   archiveThread: async (
//     args: { threadId: string },
//     { userID }: { userID: string },
//   ) => {
//     const updated = await updateThread({
//       id: args.threadId,
//       isArchived: true,
//     } as thread)

//     return { success: !!updated }
//   },

//   /**
//    * Create a task
//    * Reuses: createTask from @repo/db
//    */
//   createTask: async (
//     args: Omit<newTask, "userId" | "guestId">,
//     { userID }: { userID: string },
//   ) => {
//     const isUser = userID.startsWith("user_")

//     const task = await createTask({
//       ...args,
//       userId: isUser ? userID : null,
//       guestId: isUser ? null : userID,
//     })

//     return { id: task?.id }
//   },

//   /**
//    * Update a task
//    * Reuses: updateTask from @repo/db
//    */
//   updateTask: async (
//     args: Partial<task> & { id: string },
//     { userID }: { userID: string },
//   ) => {
//     const updated = await updateTask(args as task)

//     return { success: !!updated }
//   },

//   /**
//    * Delete a task
//    * Reuses: deleteTask from @repo/db
//    */
//   deleteTask: async (
//     args: { taskId: string },
//     { userID }: { userID: string },
//   ) => {
//     const deleted = await deleteTask({ id: args.taskId })

//     return { success: !!deleted }
//   },

//   /**
//    * Create a mood
//    * Reuses: createMood from @repo/db
//    */
//   createMood: async (
//     args: Omit<newMood, "userId" | "guestId">,
//     { userID }: { userID: string },
//   ) => {
//     const isUser = userID.startsWith("user_")

//     const mood = await createMood({
//       ...args,
//       userId: isUser ? userID : null,
//       guestId: isUser ? null : userID,
//     })

//     return { id: mood?.id }
//   },
// }

// /**
//  * Benefits of this approach:
//  *
//  * 1. ✅ No code duplication - reuses existing functions
//  * 2. ✅ Consistent business logic - same validation, credit tracking, etc.
//  * 3. ✅ Easier maintenance - update in one place
//  * 4. ✅ All existing features work - cache invalidation, credit logging, etc.
//  * 5. ✅ Type-safe - uses your existing types
//  */
