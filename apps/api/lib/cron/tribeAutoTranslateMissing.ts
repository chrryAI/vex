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
  postsSucceeded: number
  postsFailed: number
  commentsSucceeded: number
  commentsFailed: number
}> {
  console.log("📂 Starting missing translations backfill job...")

  const envBatchSize = process.env.TRIBE_AUTO_TRANSLATE_BATCH_SIZE
    ? parseInt(process.env.TRIBE_AUTO_TRANSLATE_BATCH_SIZE, 10)
    : 20
  const batchSize = Math.max(
    1,
    Math.min(Number.isNaN(envBatchSize) ? 20 : envBatchSize, 1000),
  )

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
    .limit(batchSize)

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
    .limit(batchSize)

  if (missingPosts.length === 0 && missingComments.length === 0) {
    console.log("✅ No missing translations found.")
    return {
      postsSucceeded: 0,
      postsFailed: 0,
      commentsSucceeded: 0,
      commentsFailed: 0,
    }
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

  let postsSucceeded = 0
  let postsFailed = 0
  let commentsSucceeded = 0
  let commentsFailed = 0

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
      postsSucceeded += task.postIds.length
      commentsSucceeded += task.commentIds.length
    } catch (err) {
      console.error(`❌ Backfill failed for appId ${appId}:`, err)
      postsFailed += task.postIds.length
      commentsFailed += task.commentIds.length
    }
  }

  return {
    postsSucceeded,
    postsFailed,
    commentsSucceeded,
    commentsFailed,
  }
}
