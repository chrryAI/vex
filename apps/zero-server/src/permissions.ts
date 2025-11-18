/**
 * Zero Client Utilities
 *
 * This file exports the Zero schema and client creation function.
 * Permissions are defined SERVER-SIDE only when the Zero server is implemented.
 */

import { Zero } from "@rocicorp/zero"
import { schema, type Schema } from "../zero-schema.gen"

export { schema, type Schema }

/**
 * Permissions are defined SERVER-SIDE only!
 *
 * When you implement the Zero server, you'll define permissions like this:
 *
 * const server = createZeroServer({
 *   schema,
 *   permissions: (context) => ({
 *     users: {
 *       row: {
 *         select: ["id", context.userId],
 *         update: { id: context.userId },
 *       },
 *     },
 *     // ... more permissions
 *   }),
 * })
 *
 * See AUTHENTICATION.md for full examples.
 */

// Initialize Zero client
// Note: Permissions are enforced SERVER-SIDE only, not on the client
export function createZeroClient({
  userId,
  guestId,
  server,
  auth,
}: {
  userId?: string
  guestId?: string
  server: string
  auth?: string
}) {
  return new Zero({
    server,
    schema,
    userID: userId || guestId || "anonymous",
    auth,
    // Permissions are NOT specified here - they're enforced on the server
  })
}
