import { locales } from "@chrryai/chrry/locales"
import { and, db, eq, inArray, logCreditUsage, sql } from "@repo/db"
import {
  apps,
  tribeComments,
  tribeCommentTranslations,
  tribePosts,
  tribePostTranslations,
  users,
} from "@repo/db/src/schema"
import OpenAI from "openai"
import { cleanAiResponse } from "../ai/cleanAiResponse"
import {
  sendDiscordNotification,
  sendErrorNotification,
} from "../sendDiscordNotification"

const openai = new OpenAI({
  apiKey: process.env.CHATGPT_API_KEY,
})

/**
 * All supported locales
 */
const ALL_LOCALES = locales
type Locale = (typeof ALL_LOCALES)[number]

interface AutoTranslateOptions {
  appId: string
  userId?: string // The user executing the job
  postIds?: string[]
  commentIds?: string[]
  /** Override target locales. Defaults to all supported locales. */
  languages?: string[]
}

/**
 * Bulk-translate multiple tribe posts and comments following a scheduled job.
 * Economical: Batch target languages to avoid token limits for long content.
 */
export async function autoTranslateTribeContent({
  appId,
  userId: executingUserId,
  postIds = [],
  commentIds = [],
  languages,
}: AutoTranslateOptions): Promise<void> {
  try {
    const targetLanguages = languages
      ? (languages.filter((l) => ALL_LOCALES.includes(l as Locale)) as Locale[])
      : [...ALL_LOCALES]

    if (targetLanguages.length === 0) {
      return
    }

    // 1. Fetch source content
    const posts = postIds.length
      ? await db.query.tribePosts.findMany({
          where: and(
            eq(tribePosts.appId, appId),
            inArray(tribePosts.id, postIds),
          ),
        })
      : []

    const comments = commentIds.length
      ? await db.query.tribeComments.findMany({
          where: and(
            eq(tribeComments.appId, appId),
            inArray(tribeComments.id, commentIds),
          ),
        })
      : []

    // 2. Identify needed translations (skip existing)
    const postTasks = new Map<string, Locale[]>()
    for (const p of posts) {
      const existing = await db.query.tribePostTranslations.findMany({
        where: eq(tribePostTranslations.postId, p.id),
        columns: { language: true },
      })
      const existingLangs = new Set(existing.map((t) => t.language))
      const needed = targetLanguages.filter((l) => !existingLangs.has(l))
      if (needed.length > 0) postTasks.set(p.id, needed)
    }

    const commentTasks = new Map<string, Locale[]>()
    for (const c of comments) {
      const existing = await db.query.tribeCommentTranslations.findMany({
        where: eq(tribeCommentTranslations.commentId, c.id),
        columns: { language: true },
      })
      const existingLangs = new Set(existing.map((t) => t.language))
      const needed = targetLanguages.filter((l) => !existingLangs.has(l))
      if (needed.length > 0) commentTasks.set(c.id, needed)
    }

    if (postTasks.size === 0 && commentTasks.size === 0) {
      return
    }

    // 3. Billing Logic (Determine if we should charge)
    let shouldCharge = false
    if (executingUserId) {
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
        columns: { userId: true },
      })
      const isOwner = app && app.userId === executingUserId
      const user = await db.query.users.findFirst({
        where: eq(users.id, executingUserId),
        columns: { role: true },
      })
      if (!isOwner && user?.role !== "admin") {
        shouldCharge = true
      }
    }

    console.log(
      `🌍 Bulk auto-translating ${postTasks.size} posts and ${commentTasks.size} comments... (Potential Charge: ${postTasks.size * 10 + commentTasks.size * 5})`,
    )

    // 4. Batch target languages for economy (5 per call - fewer API calls)
    const LANGUAGE_BATCH_SIZE = 5
    const languageBatches: Locale[][] = []
    for (let i = 0; i < targetLanguages.length; i += LANGUAGE_BATCH_SIZE) {
      languageBatches.push(targetLanguages.slice(i, i + LANGUAGE_BATCH_SIZE))
    }

    let savedCount = 0
    let totalCreditsCharged = 0
    const processedPostIds = new Set<string>()
    const processedCommentIds = new Set<string>()

    for (const batch of languageBatches) {
      console.log(`📡 Translating batch: ${batch.join(", ")}`)

      const postsSection = [...postTasks.entries()]
        .map(([id]) => {
          const p = posts.find((item) => item.id === id)!
          return `POST ID: ${id}\nTARGET LANGUAGES: ${batch.join(", ")}\nTITLE: ${p.title ?? ""}\nCONTENT: ${p.content ?? ""}`
        })
        .join("\n\n---\n\n")

      const commentsSection = [...commentTasks.entries()]
        .map(([id]) => {
          const c = comments.find((item) => item.id === id)!
          return `COMMENT ID: ${id}\nTARGET LANGUAGES: ${batch.join(", ")}\nCONTENT: ${c.content ?? ""}`
        })
        .join("\n\n---\n\n")

      if (!postsSection && !commentsSection) continue

      const prompt = `You are an expert multilingual translator for Tribe.
Return ONLY valid JSON. NO markdown fences. NO text before or after.
Translate each item for ALL provided target languages (${batch.join(", ")}).

${postsSection ? `### POSTS TO TRANSLATE:\n${postsSection}\n\n` : ""}
${commentsSection ? `### COMMENTS TO TRANSLATE:\n${commentsSection}\n\n` : ""}

RESPONSE FORMAT (JSON):
{
  "posts": {
    "post_id": {
      "${batch[0]}": { "title": "...", "content": "..." }
    }
  },
  "comments": {
    "comment_id": {
      "${batch[0]}": { "content": "..." }
    }
  }
}`

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_completion_tokens: 12000,
        response_format: { type: "json_object" },
      })

      const choice = response.choices[0]
      const raw = choice?.message?.content ?? "{}"
      if (choice?.finish_reason === "length") {
        console.warn("⚠️ Response truncated due to length.")
      }

      let parsed: any = {}
      try {
        parsed = JSON.parse(cleanAiResponse(raw))
      } catch (e) {
        console.error("❌ Failed to parse JSON batch:", batch)
        continue
      }

      const batchSaves: Promise<any>[] = []

      if (parsed.posts) {
        for (const [postId, langsObj] of Object.entries(parsed.posts)) {
          const post = posts.find((p) => p.id === postId)
          if (!post) continue
          for (const lang of batch) {
            const t = (langsObj as any)[lang]
            if (!t) continue
            batchSaves.push(
              db
                .insert(tribePostTranslations)
                .values({
                  postId,
                  language: lang,
                  title: (t.title || post.title || "").trim(),
                  content: t.content || post.content,
                  creditsUsed: 0,
                  model: "gpt-4o-mini",
                })
                .onConflictDoNothing(),
            )
            processedPostIds.add(postId)
          }
        }
      }

      if (parsed.comments) {
        for (const [commentId, langsObj] of Object.entries(parsed.comments)) {
          const comment = comments.find((c) => c.id === commentId)
          if (!comment) continue
          for (const lang of batch) {
            const t = (langsObj as any)[lang]
            if (!t) continue
            batchSaves.push(
              db
                .insert(tribeCommentTranslations)
                .values({
                  commentId,
                  language: lang,
                  content: t.content || comment.content,
                  creditsUsed: 0,
                  model: "gpt-4o-mini",
                })
                .onConflictDoNothing(),
            )
            processedCommentIds.add(commentId)
          }
        }
      }

      await Promise.all(batchSaves)
      savedCount += batchSaves.length
    }

    // 6. Final Billing
    if (shouldCharge && executingUserId) {
      totalCreditsCharged =
        processedPostIds.size * 10 + processedCommentIds.size * 5
      if (totalCreditsCharged > 0) {
        await logCreditUsage({
          userId: executingUserId,
          agentId: appId,
          creditCost: totalCreditsCharged,
          messageType: "tribe_post_translate",
          appId: appId,
          metadata: {
            bulk: true,
            postCount: processedPostIds.size,
            commentCount: processedCommentIds.size,
          },
        })
        await db
          .update(users)
          .set({
            tribeCredits: sql`${users.tribeCredits} - ${totalCreditsCharged}`,
          })
          .where(eq(users.id, executingUserId))
      }
    }

    if (savedCount > 0) {
      await sendDiscordNotification(
        {
          embeds: [
            {
              title: "🌍 Tribe Auto-Translate Success",
              color: 0x10b981,
              fields: [
                { name: "App ID", value: appId, inline: true },
                { name: "Saved", value: savedCount.toString(), inline: true },
                {
                  name: "Credits",
                  value: totalCreditsCharged.toString(),
                  inline: true,
                },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        },
        process.env.DISCORD_TRIBE_WEBHOOK_URL,
      ).catch(() => {})
    }
  } catch (err) {
    await sendErrorNotification(
      err,
      {
        location: "autoTranslateTribeContent",
        jobType: "tribe_translate",
        appName: appId,
        additionalInfo: {
          postCount: postIds.length,
          commentCount: commentIds.length,
        },
      },
      true,
      process.env.DISCORD_TRIBE_WEBHOOK_URL,
    )
  }
}
