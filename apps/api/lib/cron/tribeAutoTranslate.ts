import { db, eq, logCreditUsage, sql } from "@repo/db"
import {
  apps,
  tribeComments,
  tribeCommentTranslations,
  tribePosts,
  tribePostTranslations,
  users,
} from "@repo/db/src/schema"
import OpenAI from "openai"
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
const ALL_LOCALES = [
  "en",
  "de",
  "es",
  "fr",
  "ja",
  "ko",
  "pt",
  "zh",
  "nl",
  "tr",
] as const
type Locale = (typeof ALL_LOCALES)[number]

interface AutoTranslateOptions {
  appId: string
  userId?: string // The user executing the job
  postIds?: string[]
  commentIds?: string[]
  /** Override target locales. Defaults to all supported locales. */
  languages?: string[]
}

function stripCodeFence(raw: string): string {
  let s = raw.trim()
  if (s.startsWith("```")) {
    const nl = s.indexOf("\n")
    s = nl !== -1 ? s.slice(nl + 1) : s.slice(3)
  }
  if (s.endsWith("```")) s = s.slice(0, s.length - 3)
  return s.trim()
}

/**
 * Bulk-translate multiple tribe posts and comments following a scheduled job.
 * Economical: 1 GPT-4o-mini call translates ALL items to ALL languages at once.
 */
export async function autoTranslateTribeContent({
  appId,
  userId: executingUserId,
  postIds = [],
  commentIds = [],
  languages,
}: AutoTranslateOptions): Promise<void> {
  const targetLanguages = languages
    ? (languages.filter((l) => ALL_LOCALES.includes(l as Locale)) as Locale[])
    : [...ALL_LOCALES]

  if (targetLanguages.length === 0) {
    return
  }

  // 1. Fetch source content
  const posts = postIds.length
    ? await db.query.tribePosts.findMany({
        where: sql`${tribePosts.id} IN (${sql.join(postIds, sql`, `)})`,
      })
    : []

  const comments = commentIds.length
    ? await db.query.tribeComments.findMany({
        where: sql`${tribeComments.id} IN (${sql.join(commentIds, sql`, `)})`,
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

  // 3. Billing Logic (Premium Feature)
  // Owner/Admin gets it for free. Others pay bulk rate (10 per post, 5 per comment).
  let creditsToCharge = 0
  if (executingUserId) {
    const app = await db.query.apps.findFirst({
      where: eq(apps.id, appId),
      columns: { userId: true },
    })

    const isOwner = app && app.userId === executingUserId
    const user = await db.query.users.findFirst({
      where: eq(users.id, executingUserId),
      columns: { role: true, tribeCredits: true },
    })

    if (!isOwner && user?.role !== "admin") {
      creditsToCharge = postTasks.size * 10 + commentTasks.size * 5

      if (user && user.tribeCredits < creditsToCharge) {
        console.warn(
          `⚠️ Bulk auto-translate: User ${executingUserId} has insufficient credits (${user.tribeCredits} < ${creditsToCharge})`,
        )
        return
      }
    }
  }

  console.log(
    `🌍 Bulk auto-translating ${postTasks.size} posts and ${commentTasks.size} comments... (Charge: ${creditsToCharge})`,
  )

  // 4. Construct bulk prompt
  const postsSection = [...postTasks.entries()]
    .map(([id, langs]) => {
      const p = posts.find((item) => item.id === id)!
      return `POST ID: ${id}\nTARGET LANGUAGES: ${langs.join(", ")}\nTITLE: ${p.title ?? ""}\nCONTENT: ${p.content ?? ""}`
    })
    .join("\n\n---\n\n")

  const commentsSection = [...commentTasks.entries()]
    .map(([id, langs]) => {
      const c = comments.find((item) => item.id === id)!
      return `COMMENT ID: ${id}\nTARGET LANGUAGES: ${langs.join(", ")}\nCONTENT: ${c.content ?? ""}`
    })
    .join("\n\n---\n\n")

  const prompt = `You are a high-quality translator for Tribe, an AI social network.
Translate the following items. Each item specifies which target languages are needed.

RULES:
- Maintain original tone and markdown
- If source language matches target, return original text
- Return ONLY valid JSON

${postsSection ? `### POSTS TO TRANSLATE:\n${postsSection}\n\n` : ""}
${commentsSection ? `### COMMENTS TO TRANSLATE:\n${commentsSection}\n\n` : ""}

RESPONSE FORMAT (JSON):
{
  "posts": {
    "post_id": { "nl": { "title": "...", "content": "..." }, "fr": { ... } }
  },
  "comments": {
    "comment_id": { "nl": { "content": "..." }, "fr": { ... } }
  }
}`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 12000,
    })

    const raw = response?.choices?.at(0)?.message?.content ?? "{}"
    const parsed = JSON.parse(stripCodeFence(raw)) as {
      posts?: Record<
        string,
        Record<string, { title?: string; content?: string }>
      >
      comments?: Record<string, Record<string, { content?: string }>>
    }

    // 5. Save results
    const saves: Promise<any>[] = []

    if (parsed.posts) {
      for (const [postId, langsObj] of Object.entries(parsed.posts)) {
        const needed = postTasks.get(postId)
        if (!needed) continue
        const post = posts.find((p) => p.id === postId)
        if (!post) continue

        for (const lang of needed) {
          const t = langsObj[lang]
          if (!t) continue

          // 🏷️ Add language prefix to title for better feed visibility/SEO
          const title = t.title || post.title
          const prefixedTitle =
            lang === "en" ? title : `[${lang.toUpperCase()}] ${title}`

          saves.push(
            db
              .insert(tribePostTranslations)
              .values({
                postId,
                language: lang,
                title: prefixedTitle,
                content: t.content || post.content,
                creditsUsed: 0,
                model: "gpt-4o-mini",
              })
              .onConflictDoNothing(),
          )
        }
      }
    }

    if (parsed.comments) {
      for (const [commentId, langsObj] of Object.entries(parsed.comments)) {
        const needed = commentTasks.get(commentId)
        if (!needed) continue
        const comment = comments.find((c) => c.id === commentId)
        if (!comment) continue

        for (const lang of needed) {
          const t = langsObj[lang]
          if (!t) continue
          saves.push(
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
        }
      }
    }

    await Promise.all(saves)

    // 6. Charge Credits after successful translation
    if (creditsToCharge > 0 && executingUserId) {
      await logCreditUsage({
        userId: executingUserId,
        agentId: appId, // Use appId as agentId for tracking
        creditCost: creditsToCharge,
        messageType: "tribe_post_translate",
        appId: appId,
        metadata: {
          bulk: true,
          itemCount: postTasks.size + commentTasks.size,
          postCount: postTasks.size,
          commentCount: commentTasks.size,
        },
      })

      await db
        .update(users)
        .set({ tribeCredits: sql`${users.tribeCredits} - ${creditsToCharge}` })
        .where(eq(users.id, executingUserId))
    }

    console.log(`✅ Bulk auto-translate: saved ${saves.length} translations`)

    // 7. Success Notification
    if (saves.length > 0) {
      await sendDiscordNotification(
        {
          embeds: [
            {
              title: "🌍 Tribe Auto-Translate Success",
              color: 0x10b981, // Green
              fields: [
                {
                  name: "App ID",
                  value: appId,
                  inline: true,
                },
                {
                  name: "Translations Saved",
                  value: saves.length.toString(),
                  inline: true,
                },
                {
                  name: "Credits Charged",
                  value: creditsToCharge.toString(),
                  inline: true,
                },
                {
                  name: "Items",
                  value: `Posts: ${postTasks.size}, Comments: ${commentTasks.size}`,
                  inline: false,
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
