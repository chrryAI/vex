/**
 * FalkorDB Sync Utilities
 * Cleanup functions for destructive operations
 *
 * IMPORTANT: All errors are caught and logged to Sentry
 * FalkorDB failures will NOT crash the app - PostgreSQL is source of truth
 */

import { FalkorDB } from "falkordb"
import { captureException } from "@sentry/node"

let falkorDB: any = null
let graph: any = null

async function getFalkorGraph() {
  if (graph) return graph

  try {
    falkorDB = await FalkorDB.connect({
      socket: { host: "localhost", port: 6380 },
    })
    graph = falkorDB.selectGraph("chrry_ecosystem")
  } catch (error) {
    console.warn("⚠️ FalkorDB not available, skipping graph cleanup")
    // Don't send to Sentry - FalkorDB being down is expected in some envs
    return null
  }

  return graph
}

/**
 * Delete user from FalkorDB
 * Safe to call - will not crash app if FalkorDB fails
 */
export async function deleteFalkorUser(userId: string) {
  const g = await getFalkorGraph()
  if (!g) return

  try {
    await g.query(
      `
      MATCH (user:User {id: $userId})
      DETACH DELETE user
    `,
      { params: { userId } },
    )
    console.log(`🗑️ Deleted user ${userId} from FalkorDB`)
  } catch (error) {
    console.error("Failed to delete user from FalkorDB:", error)
    captureException(error, {
      tags: { operation: "falkor_delete_user" },
      extra: { userId },
    })
  }
}

/**
 * Delete app from FalkorDB
 * Safe to call - will not crash app if FalkorDB fails
 */
export async function deleteFalkorApp(appId: string) {
  const g = await getFalkorGraph()
  if (!g) return

  try {
    await g.query(
      `
      MATCH (app:App {id: $appId})
      DETACH DELETE app
    `,
      { params: { appId } },
    )
    console.log(`🗑️ Deleted app ${appId} from FalkorDB`)
  } catch (error) {
    console.error("Failed to delete app from FalkorDB:", error)
    captureException(error, {
      tags: { operation: "falkor_delete_app" },
      extra: { appId },
    })
  }
}

/**
 * Delete store from FalkorDB
 * Safe to call - will not crash app if FalkorDB fails
 */
export async function deleteFalkorStore(storeId: string) {
  const g = await getFalkorGraph()
  if (!g) return

  try {
    await g.query(
      `
      MATCH (store:Store {id: $storeId})
      DETACH DELETE store
    `,
      { params: { storeId } },
    )
    console.log(`🗑️ Deleted store ${storeId} from FalkorDB`)
  } catch (error) {
    console.error("Failed to delete store from FalkorDB:", error)
    captureException(error, {
      tags: { operation: "falkor_delete_store" },
      extra: { storeId },
    })
  }
}

/**
 * Delete thread from FalkorDB
 * Safe to call - will not crash app if FalkorDB fails
 */
export async function deleteFalkorThread(threadId: string) {
  const g = await getFalkorGraph()
  if (!g) return

  try {
    await g.query(
      `
      MATCH (thread:Thread {id: $threadId})
      DETACH DELETE thread
    `,
      { params: { threadId } },
    )
    console.log(`🗑️ Deleted thread ${threadId} from FalkorDB`)
  } catch (error) {
    console.error("Failed to delete thread from FalkorDB:", error)
    captureException(error, {
      tags: { operation: "falkor_delete_thread" },
      extra: { threadId },
    })
  }
}

/**
 * Delete message from FalkorDB
 * Safe to call - will not crash app if FalkorDB fails
 */
export async function deleteFalkorMessage(messageId: string) {
  const g = await getFalkorGraph()
  if (!g) return

  try {
    await g.query(
      `
      MATCH (message:Message {id: $messageId})
      DETACH DELETE message
    `,
      { params: { messageId } },
    )
    console.log(`🗑️ Deleted message ${messageId} from FalkorDB`)
  } catch (error) {
    console.error("Failed to delete message from FalkorDB:", error)
    captureException(error, {
      tags: { operation: "falkor_delete_message" },
      extra: { messageId },
    })
  }
}

/**
 * Delete task from FalkorDB
 * Safe to call - will not crash app if FalkorDB fails
 */
export async function deleteFalkorTask(taskId: string) {
  const g = await getFalkorGraph()
  if (!g) return

  try {
    await g.query(
      `
      MATCH (task:Task {id: $taskId})
      DETACH DELETE task
    `,
      { params: { taskId } },
    )
    console.log(`🗑️ Deleted task ${taskId} from FalkorDB`)
  } catch (error) {
    console.error("Failed to delete task from FalkorDB:", error)
    captureException(error, {
      tags: { operation: "falkor_delete_task" },
      extra: { taskId },
    })
  }
}

/**
 * Sync user to FalkorDB (create or update)
 * Safe to call - will not crash app if FalkorDB fails
 */
export async function syncFalkorUser(userData: {
  id: string
  email?: string | null
  name?: string | null
  userName?: string | null
}) {
  const g = await getFalkorGraph()
  if (!g) return

  try {
    await g.query(
      `
      MERGE (user:User {id: $id})
      SET user.email = $email,
          user.name = $name,
          user.userName = $userName
    `,
      {
        params: {
          id: userData.id,
          email: userData.email || "",
          name: userData.name || "",
          userName: userData.userName || "",
        },
      },
    )
    console.log(`✅ Synced user ${userData.id} to FalkorDB`)
  } catch (error) {
    console.error("Failed to sync user to FalkorDB:", error)
    captureException(error, {
      tags: { operation: "falkor_sync_user" },
      extra: { userId: userData.id },
    })
  }
}

/**
 * Sync app to FalkorDB (create or update)
 * Safe to call - will not crash app if FalkorDB fails
 */
export async function syncFalkorApp(appData: {
  id: string
  slug: string
  name: string
  storeId?: string | null
  userId?: string | null
}) {
  const g = await getFalkorGraph()
  if (!g) return

  try {
    await g.query(
      `
      MERGE (app:App {id: $id})
      SET app.slug = $slug,
          app.name = $name,
          app.storeId = $storeId,
          app.userId = $userId
    `,
      {
        params: {
          id: appData.id,
          slug: appData.slug,
          name: appData.name,
          storeId: appData.storeId || "",
          userId: appData.userId || "",
        },
      },
    )

    // Create relationships
    if (appData.storeId) {
      await g.query(
        `
        MATCH (app:App {id: $appId})
        MATCH (store:Store {id: $storeId})
        MERGE (app)-[:BELONGS_TO]->(store)
      `,
        {
          params: {
            appId: appData.id,
            storeId: appData.storeId,
          },
        },
      )
    }

    if (appData.userId) {
      await g.query(
        `
        MATCH (app:App {id: $appId})
        MERGE (user:User {id: $userId})
        MERGE (user)-[:OWNS]->(app)
      `,
        {
          params: {
            appId: appData.id,
            userId: appData.userId,
          },
        },
      )
    }

    console.log(`✅ Synced app ${appData.name} to FalkorDB`)
  } catch (error) {
    console.error("Failed to sync app to FalkorDB:", error)
    captureException(error, {
      tags: { operation: "falkor_sync_app" },
      extra: { appId: appData.id },
    })
  }
}

/**
 * Sync store to FalkorDB (create or update)
 * Safe to call - will not crash app if FalkorDB fails
 */
export async function syncFalkorStore(storeData: {
  id: string
  slug: string
  name: string
  userId?: string | null
}) {
  const g = await getFalkorGraph()
  if (!g) return

  try {
    await g.query(
      `
      MERGE (store:Store {id: $id})
      SET store.slug = $slug,
          store.name = $name,
          store.userId = $userId
    `,
      {
        params: {
          id: storeData.id,
          slug: storeData.slug,
          name: storeData.name,
          userId: storeData.userId || "",
        },
      },
    )

    // Create relationship with user
    if (storeData.userId) {
      await g.query(
        `
        MATCH (store:Store {id: $storeId})
        MERGE (user:User {id: $userId})
        MERGE (user)-[:OWNS]->(store)
      `,
        {
          params: {
            storeId: storeData.id,
            userId: storeData.userId,
          },
        },
      )
    }

    console.log(`✅ Synced store ${storeData.name} to FalkorDB`)
  } catch (error) {
    console.error("Failed to sync store to FalkorDB:", error)
    captureException(error, {
      tags: { operation: "falkor_sync_store" },
      extra: { storeId: storeData.id },
    })
  }
}

/**
 * Sync thread to FalkorDB (create or update)
 * Safe to call - will not crash app if FalkorDB fails
 */
export async function syncFalkorThread(threadData: {
  id: string
  userId?: string | null
  appId?: string | null
}) {
  const g = await getFalkorGraph()
  if (!g) return

  try {
    await g.query(
      `
      MERGE (thread:Thread {id: $id})
      SET thread.userId = $userId,
          thread.appId = $appId
    `,
      {
        params: {
          id: threadData.id,
          userId: threadData.userId || "",
          appId: threadData.appId || "",
        },
      },
    )

    // Create relationships
    if (threadData.userId) {
      await g.query(
        `
        MATCH (thread:Thread {id: $threadId})
        MERGE (user:User {id: $userId})
        MERGE (user)-[:OWNS]->(thread)
      `,
        {
          params: {
            threadId: threadData.id,
            userId: threadData.userId,
          },
        },
      )
    }

    if (threadData.appId) {
      await g.query(
        `
        MATCH (thread:Thread {id: $threadId})
        MATCH (app:App {id: $appId})
        MERGE (thread)-[:BELONGS_TO]->(app)
      `,
        {
          params: {
            threadId: threadData.id,
            appId: threadData.appId,
          },
        },
      )
    }

    console.log(`✅ Synced thread ${threadData.id} to FalkorDB`)
  } catch (error) {
    console.error("Failed to sync thread to FalkorDB:", error)
    captureException(error, {
      tags: { operation: "falkor_sync_thread" },
      extra: { threadId: threadData.id },
    })
  }
}

/**
 * Close FalkorDB connection
 */
export async function closeFalkorSync() {
  if (falkorDB) {
    await falkorDB.close()
    falkorDB = null
    graph = null
  }
}
