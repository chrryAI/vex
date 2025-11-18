// /**
//  * Zero Custom Mutators
//  *
//  * These are server-side functions that handle authenticated mutations.
//  * They run on the Zero server and have full access to the database.
//  */

// import { z } from "zod"
// import type { Drizzle } from "@repo/db"
// import { v4 as uuidv4 } from "uuid"

// // Input validation schemas
// const createMessageSchema = z.object({
//   threadId: z.string().uuid(),
//   message: z.string().min(1).max(10000),
//   role: z.enum(["user", "assistant", "system"]),
//   model: z.string().optional(),
// })

// const createThreadSchema = z.object({
//   title: z.string().max(100).optional(),
//   appId: z.string().uuid().optional(),
// })

// const updateUserSchema = z.object({
//   name: z.string().max(100).optional(),
//   language: z.string().optional(),
//   theme: z.enum(["light", "dark", "system"]).optional(),
//   favouriteAgent: z.string().optional(),
// })

// /**
//  * Define custom mutators
//  * These will be available on the client as:
//  * zero.mutate.createMessage({ ... })
//  */
// export const mutators = {
//   /**
//    * Create a new message
//    * Authenticated: Only the message author can create
//    */
//   createMessage: {
//     args: createMessageSchema,
//     async handler(
//       args: z.infer<typeof createMessageSchema>,
//       { db, userID }: { db: Drizzle; userID: string },
//     ) {
//       // Verify thread ownership
//       const thread = await db.query.threads.findFirst({
//         where: (threads, { eq, or }) =>
//           or(eq(threads.userId, userID), eq(threads.guestId, userID)),
//       })

//       if (!thread) {
//         throw new Error("Thread not found or access denied")
//       }

//       // Determine if user or guest
//       const isUser = thread.userId === userID

//       // Create message
//       const messageId = uuidv4()
//       await db.insert(schema.messages).values({
//         id: messageId,
//         threadId: args.threadId,
//         message: args.message,
//         role: args.role,
//         model: args.model,
//         userId: isUser ? userID : null,
//         guestId: isUser ? null : userID,
//         createdAt: new Date(),
//       })

//       return { id: messageId }
//     },
//   },

//   /**
//    * Create a new thread
//    * Authenticated: Creates thread for current user/guest
//    */
//   createThread: {
//     args: createThreadSchema,
//     async handler(
//       args: z.infer<typeof createThreadSchema>,
//       { db, userID }: { db: Drizzle; userID: string },
//     ) {
//       // Check if user or guest
//       const user = await db.query.users.findFirst({
//         where: (users, { eq }) => eq(users.id, userID),
//       })

//       const threadId = uuidv4()
//       await db.insert(schema.threads).values({
//         id: threadId,
//         title: args.title,
//         appId: args.appId,
//         userId: user ? userID : null,
//         guestId: user ? null : userID,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//       })

//       return { id: threadId }
//     },
//   },

//   /**
//    * Update user profile
//    * Authenticated: Only the user can update their own profile
//    */
//   updateUser: {
//     args: updateUserSchema,
//     async handler(
//       args: z.infer<typeof updateUserSchema>,
//       { db, userID }: { db: Drizzle; userID: string },
//     ) {
//       // Verify user exists
//       const user = await db.query.users.findFirst({
//         where: (users, { eq }) => eq(users.id, userID),
//       })

//       if (!user) {
//         throw new Error("User not found")
//       }

//       // Update user
//       await db
//         .update(schema.users)
//         .set({
//           ...args,
//           updatedOn: new Date(),
//         })
//         .where(eq(schema.users.id, userID))

//       return { success: true }
//     },
//   },

//   /**
//    * Delete a message
//    * Authenticated: Only the message author can delete
//    */
//   deleteMessage: {
//     args: z.object({ messageId: z.string().uuid() }),
//     async handler(
//       args: { messageId: string },
//       { db, userID }: { db: Drizzle; userID: string },
//     ) {
//       // Verify message ownership
//       const message = await db.query.messages.findFirst({
//         where: (messages, { eq, and, or }) =>
//           and(
//             eq(messages.id, args.messageId),
//             or(eq(messages.userId, userID), eq(messages.guestId, userID)),
//           ),
//       })

//       if (!message) {
//         throw new Error("Message not found or access denied")
//       }

//       // Delete message
//       await db
//         .delete(schema.messages)
//         .where(eq(schema.messages.id, args.messageId))

//       return { success: true }
//     },
//   },

//   /**
//    * Archive a thread
//    * Authenticated: Only the thread owner can archive
//    */
//   archiveThread: {
//     args: z.object({ threadId: z.string().uuid() }),
//     async handler(
//       args: { threadId: string },
//       { db, userID }: { db: Drizzle; userID: string },
//     ) {
//       // Verify thread ownership
//       const thread = await db.query.threads.findFirst({
//         where: (threads, { eq, and, or }) =>
//           and(
//             eq(threads.id, args.threadId),
//             or(eq(threads.userId, userID), eq(threads.guestId, userID)),
//           ),
//       })

//       if (!thread) {
//         throw new Error("Thread not found or access denied")
//       }

//       // Archive thread
//       await db
//         .update(schema.threads)
//         .set({
//           isArchived: true,
//           updatedAt: new Date(),
//         })
//         .where(eq(schema.threads.id, args.threadId))

//       return { success: true }
//     },
//   },
// }
