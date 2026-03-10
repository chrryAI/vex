import { locales } from "@chrryai/chrry/locales"
import { db, eq, isNotNull, sql } from "@repo/db"
import {
  tribeComments,
  tribeCommentTranslations,
  tribePosts,
  tribePostTranslations,
} from "@repo/db/src/schema"
import { autoTranslateTribeContent } from "./tribeAutoTranslate"

/**
 * Periodically identify content missing translations and process them in batches.
 * Useful for backfilling new languages (like Swedish) or recovering from failed jobs.
 */
export async function autoTranslateMissingContent(): Promise<{
  postsProcessed: number
  commentsProcessed: number
}> {
  console.log("📂 Starting missing translations backfill job...")

  // 1. Find posts missing one or more translations
  const missingPosts = await db
    .select({
      id: tribePosts.id,
      appId: tribePosts.appId,
    })
    .from(tribePosts)
    .leftJoin(
      tribePostTranslations,
      eq(tribePosts.id, tribePostTranslations.postId),
    )
    .where(isNotNull(tribePosts.appId))
    .groupBy(tribePosts.id, tribePosts.appId)
    .having(sql`count(${tribePostTranslations.id}) < ${locales.length}`)
    .limit(20)

  // 2. Find comments missing one or more translations
  const missingComments = await db
    .select({
      id: tribeComments.id,
      appId: tribeComments.appId,
    })
    .from(tribeComments)
    .leftJoin(
      tribeCommentTranslations,
      eq(tribeComments.id, tribeCommentTranslations.commentId),
    )
    .where(isNotNull(tribeComments.appId))
    .groupBy(tribeComments.id, tribeComments.appId)
    .having(sql`count(${tribeCommentTranslations.id}) < ${locales.length}`)
    .limit(20)

  if (missingPosts.length === 0 && missingComments.length === 0) {
    console.log("✅ No missing translations found.")
    return { postsProcessed: 0, commentsProcessed: 0 }
  }

  console.log(
    `🌍 Found ${missingPosts.length} posts and ${missingComments.length} comments missing translations. Processing...`,
  )

  // 3. Group by appId to respect agent context and usage logging
  const appTasks = new Map<
    string,
    { postIds: string[]; commentIds: string[] }
  >()

  for (const p of missingPosts) {
    if (!p.appId) continue
    if (!appTasks.has(p.appId)) {
      appTasks.set(p.appId, { postIds: [], commentIds: [] })
    }
    appTasks.get(p.appId)!.postIds.push(p.id)
  }

  for (const c of missingComments) {
    if (!c.appId) continue
    if (!appTasks.has(c.appId)) {
      appTasks.set(c.appId, { postIds: [], commentIds: [] })
    }
    appTasks.get(c.appId)!.commentIds.push(c.id)
  }

  // 4. Process each app group (non-blocking, sequential for safety)
  for (const [appId, task] of appTasks.entries()) {
    console.log(
      `📡 Backfilling ${task.postIds.length} posts & ${task.commentIds.length} comments for App: ${appId}`,
    )
    try {
      await autoTranslateTribeContent({
        appId,
        postIds: task.postIds,
        commentIds: task.commentIds,
      })
    } catch (err) {
      console.error(`❌ Backfill failed for appId ${appId}:`, err)
    }
  }

  return {
    postsProcessed: missingPosts.length,
    commentsProcessed: missingComments.length,
  }
}
