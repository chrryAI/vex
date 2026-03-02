import { locales } from "@chrryai/chrry/locales"
import {
  calculateTranslationCredits,
  isDevelopment,
} from "@chrryai/chrry/utils"
import { and, db, eq, getAiAgent, getApp, logCreditUsage } from "@repo/db"
import {
  tribeComments,
  tribeCommentTranslations,
  tribePosts,
  tribePostTranslations,
  users,
} from "@repo/db/src/schema"
import { Hono } from "hono"
import OpenAI from "openai"
import { getMember } from "../lib/auth"

const app = new Hono()

const openai = new OpenAI({
  apiKey: process.env.CHATGPT_API_KEY,
})

// Calculate credits based on content length
function calculateCredits(contentLength: number): number {
  return calculateTranslationCredits({ contentLength })
}

// Translate tribe post
app.post("/p/:id/translate", async (c) => {
  const member = await getMember(c)

  const agent = await getAiAgent({
    name: "chatGPT",
  })

  if (!agent) {
    return c.json({ error: "Agent not found" }, { status: 401 })
  }

  if (!member) {
    return c.json({ error: "Authentication required" }, { status: 401 })
  }

  const postId = c.req.param("id")
  const body = await c.req.json()
  const { languages } = body as { languages: string[] }

  if (!languages || !Array.isArray(languages) || languages.length === 0) {
    return c.json({ error: "Languages array is required" }, { status: 400 })
  }

  // Validate language codes (ISO 639-1)
  const validLanguages = locales
  const invalidLangs = languages.filter(
    (lang) => !validLanguages.includes(lang as any),
  )
  if (invalidLangs.length > 0) {
    return c.json(
      { error: `Invalid language codes: ${invalidLangs.join(", ")}` },
      { status: 400 },
    )
  }

  try {
    // Get the post
    const post = await db.query.tribePosts.findFirst({
      where: eq(tribePosts.id, postId),
    })

    if (!post) {
      return c.json({ error: "Post not found" }, { status: 404 })
    }
    const app = await getApp({
      id: post.appId,
    })

    if (!app) {
      return c.json({ error: "App not found" }, { status: 404 })
    }

    // Check if user is post owner or admin
    const isOwner = app.userId === member.id

    const isAdmin = isDevelopment || member.role === "admin"
    const canTranslateFree = isOwner || isAdmin

    // Calculate total credits needed
    const contentLength =
      (post.title?.length || 0) + (post.content?.length || 0)
    const creditsPerLanguage = calculateCredits(contentLength)
    const totalCredits = creditsPerLanguage * languages.length

    // Check if user has enough credits (if not free)
    if (!canTranslateFree) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, member.id),
      })

      if (!user || (user.credits || 0) < totalCredits) {
        return c.json(
          {
            error: "Insufficient credits",
            required: totalCredits,
            available: user?.credits || 0,
          },
          { status: 402 },
        )
      }
    }

    const translations = []

    // Translate to each language
    for (const lang of languages) {
      // Check if translation already exists
      const existing = await db.query.tribePostTranslations.findFirst({
        where: and(
          eq(tribePostTranslations.postId, postId),
          eq(tribePostTranslations.language, lang),
        ),
      })

      if (existing) {
        translations.push(existing)
        continue
      }

      // Translate with GPT
      const prompt = `Translate this tribe post to ${lang}.

IMPORTANT RULES:
- Maintain the original tone and style
- Preserve any markdown formatting
- Keep technical terms consistent
- Don't translate product names or proper nouns
- Return ONLY valid JSON with "title" and "content" keys

Post to translate:
Title: ${post.title || ""}
Content: ${post.content || ""}

Return the translation as JSON:`

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 2000,
        })

        const rawContent = response?.choices?.at(0)?.message?.content || "{}"
        const translated = JSON.parse(
          rawContent
            .replace(/^```(?:json)?\s*/m, "")
            .replace(/\s*```$/m, "")
            .trim(),
        )

        // Save translation
        const [newTranslation] = await db
          .insert(tribePostTranslations)
          .values({
            postId,
            language: lang,
            title: translated.title || post.title,
            content: translated.content || post.content,
            translatedBy: member.id,
            creditsUsed: canTranslateFree ? 0 : creditsPerLanguage,
            model: "gpt-4o-mini",
          })
          .returning()

        translations.push(newTranslation)

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Error translating to ${lang}:`, error)
        return c.json(
          { error: `Translation failed for ${lang}` },
          { status: 500 },
        )
      }
    }

    await logCreditUsage({
      userId: member.id,
      agentId: agent.id,
      // guestId: appOwnerId,
      creditCost: totalCredits, // Positive = deduction
      messageType: "tribe_post_translate",
      // appId,
    })

    return c.json({
      success: true,
      translations,
      creditsUsed: canTranslateFree ? 0 : totalCredits,
      message: canTranslateFree
        ? "Translations completed (free for owner/admin)"
        : `Translations completed. ${totalCredits} credits deducted.`,
    })
  } catch (error) {
    console.error("Error translating post:", error)
    return c.json({ error: "Translation failed" }, { status: 500 })
  }
})

app.post("/c/:id/translate", async (c) => {
  const agent = await getAiAgent({
    name: "chatGPT",
  })

  if (!agent) {
    return c.json({ error: "Agent not found" }, { status: 401 })
  }

  const member = await getMember(c)

  if (!member) {
    return c.json({ error: "Authentication required" }, { status: 401 })
  }

  const commentId = c.req.param("id")
  const body = await c.req.json()
  const { languages } = body as { languages: string[] }

  if (!languages || !Array.isArray(languages) || languages.length === 0) {
    return c.json({ error: "Languages array is required" }, { status: 400 })
  }

  // Validate language codes (ISO 639-1)
  const validLanguages = locales
  const invalidLangs = languages.filter(
    (lang) => !validLanguages.includes(lang as any),
  )
  if (invalidLangs.length > 0) {
    return c.json(
      { error: `Invalid language codes: ${invalidLangs.join(", ")}` },
      { status: 400 },
    )
  }

  try {
    // Get the post
    const comment = await db.query.tribeComments.findFirst({
      where: eq(tribeComments.id, commentId),
    })

    if (!comment) {
      return c.json({ error: "Comment not found" }, { status: 404 })
    }

    if (!comment.appId) {
      return c.json({ error: "Comment doesn't have an App" }, { status: 404 })
    }

    const app = await getApp({
      id: comment.appId,
    })

    if (!app) {
      return c.json({ error: "App not found" }, { status: 404 })
    }

    // Check if user is post owner or admin
    const isOwner = app.userId === member.id
    const isAdmin = isDevelopment || member.role === "admin"
    const canTranslateFree = isOwner || isAdmin

    // Calculate total credits needed
    const contentLength = comment.content?.length || 0
    const creditsPerLanguage = calculateCredits(contentLength)
    const totalCredits = creditsPerLanguage * languages.length

    // Check if user has enough credits (if not free)
    if (!canTranslateFree) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, member.id),
      })

      if (!user || (user.credits || 0) < totalCredits) {
        return c.json(
          {
            error: "Insufficient credits",
            required: totalCredits,
            available: user?.credits || 0,
          },
          { status: 402 },
        )
      }
    }

    const translations = []

    // Translate to each language
    for (const lang of languages) {
      // Check if translation already exists
      const existing = await db.query.tribeCommentTranslations.findFirst({
        where: and(
          eq(tribeCommentTranslations.commentId, commentId),
          eq(tribeCommentTranslations.language, lang),
        ),
      })

      if (existing) {
        translations.push(existing)
        continue
      }

      // Translate with GPT
      const prompt = `Translate this tribe comment to ${lang}.

IMPORTANT RULES:
- Maintain the original tone and style
- Preserve any markdown formatting
- Keep technical terms consistent
- Don't translate product names or proper nouns
- Return ONLY valid JSON with "title" and "content" keys

Post to translate:
Content: ${comment.content || ""}

Return the translation as JSON:`

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 2000,
        })

        const rawContent = response?.choices?.at(0)?.message?.content || "{}"
        const translated = JSON.parse(
          rawContent
            .replace(/^```(?:json)?\s*/m, "")
            .replace(/\s*```$/m, "")
            .trim(),
        )

        // Save translation
        const [newTranslation] = await db
          .insert(tribeCommentTranslations)
          .values({
            commentId,
            language: lang,
            content: translated.content || comment.content,
            translatedBy: member.id,
            creditsUsed: canTranslateFree ? 0 : creditsPerLanguage,
            model: "gpt-4o-mini",
          })
          .returning()

        translations.push(newTranslation)

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Error translating to ${lang}:`, error)
        return c.json(
          { error: `Translation failed for ${lang}` },
          { status: 500 },
        )
      }
    }

    await logCreditUsage({
      userId: member.id,
      agentId: agent.id,
      // guestId: appOwnerId,
      creditCost: totalCredits, // Positive = deduction
      messageType: "tribe_post_comment_translate",
      // appId,
    })

    return c.json({
      success: true,
      translations,
      creditsUsed: canTranslateFree ? 0 : totalCredits,
      message: canTranslateFree
        ? "Translations completed (free for owner/admin)"
        : `Translations completed. ${totalCredits} credits deducted.`,
    })
  } catch (error) {
    console.error("Error translating post:", error)
    return c.json({ error: "Translation failed" }, { status: 500 })
  }
})

// Get translations for a post
app.get("/p/:id/translations", async (c) => {
  const member = await getMember(c)

  if (!member) {
    return c.json({ error: "Authentication required" }, { status: 401 })
  }

  const postId = c.req.param("id")
  const language = c.req.query("language")

  try {
    const where = language
      ? and(
          eq(tribePostTranslations.postId, postId),
          eq(tribePostTranslations.language, language),
        )
      : eq(tribePostTranslations.postId, postId)

    const translations = await db.query.tribePostTranslations.findMany({
      where,
      orderBy: (t, { desc }) => [desc(t.createdOn)],
    })

    return c.json({
      translations,
      count: translations.length,
    })
  } catch (error) {
    console.error("Error fetching translations:", error)
    return c.json({ error: "Failed to fetch translations" }, { status: 500 })
  }
})

export default app
