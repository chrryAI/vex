import { locales } from "@chrryai/chrry/locales"
import type { tribePost } from "@chrryai/chrry/types"
import {
  calculateTranslationCredits,
  isDevelopment,
} from "@chrryai/chrry/utils"
import { isE2E } from "@chrryai/chrry/utils/siteConfig"
import {
  and,
  db,
  redis as dbRedis,
  desc,
  eq,
  getAiAgent,
  getApp as getAppDb,
  getPlaceHolder,
  getSimpleApp,
  getThread,
  getTribeFollows,
  getTribeLikes,
  getTribePosts,
  getTribeReactions,
  getTribes,
  inArray,
  logCreditUsage,
  sql,
} from "@repo/db"
import {
  apps,
  tribeComments,
  tribeCommentTranslations,
  tribeLikes,
  tribePosts,
  tribePostTranslations,
  tribes,
  users,
} from "@repo/db/src/schema"
import { Hono } from "hono"
import OpenAI from "openai"
import { cleanAiResponse } from "../../lib/ai/cleanAiResponse"
import { PerformanceTracker } from "../../lib/analytics"
import { captureException } from "../../lib/captureException"
import { getGuest, getMember } from "../lib/auth"

const app = new Hono()

const CHATGPT_API_KEY = process.env.CHATGPT_API_KEY
if (!CHATGPT_API_KEY) {
  console.error("❌ CHATGPT_API_KEY environment variable is not set")
}

const openai = CHATGPT_API_KEY
  ? new OpenAI({
      apiKey: CHATGPT_API_KEY,
    })
  : null

const redis =
  isDevelopment || isE2E
    ? {
        get: async (key: string) => null,
        setex: async (key: string, ttl: number, value: string) => {},
        del: async (...keys: string[]) => {},
        scan: async (
          cursor: string,
          matchKey: string,
          pattern: string,
          countKey: string,
          count: number,
        ): Promise<[string, string[]]> => ["0", []],
      }
    : dbRedis

const clearFeed = async (postId?: string) => {
  const BATCH_SIZE = 100

  if (postId) {
    // Use SCAN instead of KEYS for production safety
    const postKeys: string[] = []
    let cursor = "0"

    do {
      const result = await redis.scan(
        cursor,
        "MATCH",
        `tribe:post:${postId}*`,
        "COUNT",
        BATCH_SIZE,
      )
      cursor = result[0]
      const keys = result[1]
      postKeys.push(...keys)
    } while (cursor !== "0")

    // Delete in batches
    if (postKeys.length > 0) {
      for (let i = 0; i < postKeys.length; i += BATCH_SIZE) {
        const batch = postKeys.slice(i, i + BATCH_SIZE)
        await redis.del(...batch)
      }
    }
  }

  // Delete all feed caches (they contain this post)
  const feedKeys: string[] = []
  let cursor = "0"

  do {
    const result = await redis.scan(
      cursor,
      "MATCH",
      "tribe:posts:*",
      "COUNT",
      BATCH_SIZE,
    )
    cursor = result[0]
    const keys = result[1]
    feedKeys.push(...keys)
  } while (cursor !== "0")

  // Delete in batches
  if (feedKeys.length > 0) {
    for (let i = 0; i < feedKeys.length; i += BATCH_SIZE) {
      const batch = feedKeys.slice(i, i + BATCH_SIZE)
      await redis.del(...batch)
    }
  }
}

// Get tribes list with pagination and search
app.get("/", async (c) => {
  const tracker = new PerformanceTracker("tribe_list_request")

  const member = await tracker.track("tribe_list_auth_member", () =>
    getMember(c),
  )
  const guest = await tracker.track("tribe_list_auth_guest", () => getGuest(c))

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const search = c.req.query("search")
  const pageSize = c.req.query("pageSize")
  const page = c.req.query("page")
  const appId = c.req.query("appId")

  try {
    const cacheKey = `tribe:list:appId:${appId || "all"}:search:${search || ""}:pageSize:${pageSize || 20}:page:${page || 1}`
    let result = null

    if (!isDevelopment && !isE2E) {
      const cached = await redis.get(cacheKey)
      if (cached) {
        console.log(`✅ Tribe list cache hit: ${cacheKey}`)
        result = JSON.parse(cached)
      }
    }

    if (!result) {
      result = await tracker.track("tribe_list_getTribes", () =>
        getTribes({
          search,
          pageSize: pageSize ? parseInt(pageSize, 10) : 20,
          page: page ? parseInt(page, 10) : 1,
          appId,
        }),
      )

      // 5 min TTL — tribe list changes less frequently than posts
      if (!isDevelopment && !isE2E) {
        await redis.setex(cacheKey, 300, JSON.stringify(result))
        console.log(`💾 Cached tribe list: ${cacheKey}`)
      }
    }

    return c.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("Error fetching tribes:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})

// Get reactions for a post or comment
app.get("/reactions", async (c) => {
  const tracker = new PerformanceTracker("tribe_reactions_request")

  const member = await tracker.track("tribe_reactions_auth_member", () =>
    getMember(c),
  )
  const guest = await tracker.track("tribe_reactions_auth_guest", () =>
    getGuest(c),
  )

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const postId = c.req.query("postId")
  const commentId = c.req.query("commentId")
  const limit = c.req.query("limit")

  try {
    const reactions = await tracker.track(
      "tribe_reactions_getTribeReactions",
      () =>
        getTribeReactions({
          postId,
          commentId,
          limit: limit ? parseInt(limit, 10) : 50,
        }),
    )

    return c.json({
      success: true,
      reactions,
      count: reactions.length,
    })
  } catch (error) {
    console.error("Error fetching tribe reactions:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})

// Get follows for a user/guest or app
app.get("/follows", async (c) => {
  const tracker = new PerformanceTracker("tribe_follows_request")

  const member = await tracker.track("tribe_follows_auth_member", () =>
    getMember(c),
  )
  const guest = await tracker.track("tribe_follows_auth_guest", () =>
    getGuest(c),
  )

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const followerId = c.req.query("followerId")
  const followerGuestId = c.req.query("followerGuestId")
  const followingAppId = c.req.query("followingAppId")
  const limit = c.req.query("limit")

  try {
    const follows = await tracker.track("tribe_follows_getTribeFollows", () =>
      getTribeFollows({
        followerId,
        followerGuestId,
        followingAppId,
        limit: limit ? parseInt(limit, 10) : 100,
      }),
    )

    return c.json({
      success: true,
      follows,
      count: follows.length,
    })
  } catch (error) {
    console.error("Error fetching tribe follows:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})

// Get likes for a post
app.get("/likes", async (c) => {
  const tracker = new PerformanceTracker("tribe_likes_request")

  const member = await tracker.track("tribe_likes_auth_member", () =>
    getMember(c),
  )
  const guest = await tracker.track("tribe_likes_auth_guest", () => getGuest(c))

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const postId = c.req.query("postId")
  const limit = c.req.query("limit")

  try {
    const likes = await tracker.track("tribe_likes_getTribeLikes", () =>
      getTribeLikes({
        postId,
        limit: limit ? parseInt(limit, 10) : 100,
      }),
    )

    return c.json({
      success: true,
      likes,
      count: likes.length,
    })
  } catch (error) {
    console.error("Error fetching tribe likes:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})

// Get tribe posts list with pagination
app.get("/p", async (c) => {
  const tracker = new PerformanceTracker("tribe_posts_request")
  const tribeId = c.req.query("tribeId")
  const language = c.req.query("language")
  const tribeSlug = c.req.query("tribeSlug")
  const appId = c.req.query("appId")
  const search = c.req.query("search")
  const characterProfileIds = c.req.query("characterProfileIds")
  const pageSize = c.req.query("pageSize")
  const page = c.req.query("page")
  const sortBy = c.req.query("sortBy") as "date" | "hot" | "liked" | undefined
  const order = c.req.query("order") as "asc" | "desc" | undefined

  const member = await tracker.track(
    "tribe_post_request_post_auth_member",
    () => getMember(c),
  )
  const guest = await tracker.track("tribe_posts_auth_guest", () => getGuest(c))

  // Use authenticated user ID, not query parameter (for security)
  const userId = member?.id
  const guestId = guest?.id

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, { status: 401 })
  }

  // Redis setup (skip in dev/e2e)

  const skipCache = false

  try {
    // Create cache key based on all query parameters
    // Include user ID for liked posts to prevent cross-user cache contamination
    const userKey =
      sortBy === "liked" ? member?.id || guest?.id || "anonymous" : "all"
    const tags = c.req.query("tags") // comma-separated tag list
    const id = c.req.query("id")
    const cacheKey = `tribe:posts:sortBy:${sortBy || "date"}:order:${order || "desc"}:tribeId:${tribeId || "all"}:tribeSlug:${tribeSlug || "all"}:appId:${appId || "all"}:id:${id || "all"}:search:${search || ""}:characterProfileIds:${characterProfileIds || ""}:tags:${tags?.split(",") || ""}:pageSize:${pageSize || 10}:page:${page || 1}:userKey:${userKey}:language:${language || "en"}`

    let result = null

    // Check Redis cache first
    if (!skipCache && !isDevelopment && !isE2E) {
      const cachedPosts = await redis.get(cacheKey)
      if (cachedPosts) {
        console.log(`✅ Tribe posts cache hit: ${cacheKey}`)
        result = JSON.parse(cachedPosts)
      }
    }

    // Fetch from database if not cached
    if (!result) {
      console.log(`📝 Fetching fresh tribe posts: ${cacheKey}`)
      result = await tracker.track("tribe_posts_request_getTribePosts", () =>
        getTribePosts({
          tribeId,
          appId,
          userId,
          guestId,
          search,
          tribeSlug,
          characterProfileIds: characterProfileIds
            ? characterProfileIds.split(",")
            : undefined,
          tags: tags ? tags.split(",") : undefined,
          pageSize: pageSize ? parseInt(pageSize, 10) : 10,
          page: page ? parseInt(page, 10) : 1,
          sortBy: sortBy || "date",
          order: order || "desc",
        }),
      )

      // Store in Redis cache with 15 minute TTL
      if (!isDevelopment && !isE2E && !skipCache) {
        await redis.setex(cacheKey, 900, JSON.stringify(result))
        console.log(`💾 Cached tribe posts: ${cacheKey}`)
      }
    }

    // Fetch translations if language is specified

    const data = {
      ...result,
      posts: await Promise.all(
        result?.posts?.map(async (r: tribePost) => {
          const postTranslations =
            await db.query.tribePostTranslations.findMany({
              where: eq(tribePostTranslations.postId, r.id),
            })

          const postTranslation = postTranslations.find(
            (t) => t.language === language,
          )
          const postContent = postTranslation?.content || r.content
          const title = postTranslation?.title || r.title

          const postLanguages = postTranslations?.map((x) => x.language)

          return {
            ...r,
            comments: await Promise.all(
              r?.comments?.map(async (c) => {
                const commentTranslations =
                  await db.query.tribeCommentTranslations.findMany({
                    where: eq(tribeCommentTranslations.commentId, c.id),
                  })
                const commentTranslation = commentTranslations.find(
                  (t) => t.language === language,
                )
                const commentContent = commentTranslation?.content || c.content

                const commentLanguages = commentTranslations.map(
                  (x) => x.language,
                )

                return {
                  ...c,
                  content: commentContent,
                  languages: commentLanguages.length
                    ? commentLanguages.includes("en")
                      ? commentLanguages
                      : commentLanguages.concat("en")
                    : ["en"],
                  language: commentTranslation?.language || "en",
                }
              }) ?? [],
            ),
            languages: postLanguages.length
              ? postLanguages.includes("en")
                ? postLanguages
                : postLanguages.concat("en")
              : ["en"],
            title,
            language: postTranslation?.language || "en",
            content: (() => {
              const hasMedia =
                (Array.isArray(r.images) ? r.images.length > 0 : !!r.images) ||
                (Array.isArray(r.videos) ? r.videos.length > 0 : !!r.videos)
              const limit = 300 * (hasMedia ? 2 : 1)
              return postContent && postContent.length > limit
                ? `${postContent.slice(0, limit)}...`
                : postContent
            })(),
            // App already includes store from database join
          }
        }),
      ),
    }

    return c.json({
      success: true,
      ...data,
    })
  } catch (error) {
    console.error("Error fetching tribe posts:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})

// Get single tribe post with full details (comments, reactions, likes)
app.get("/p/:id", async (c) => {
  const tracker = new PerformanceTracker("tribe_post_request")
  const language = c.req.query("language")
  const member = await tracker.track("tribe_post_auth_member", () =>
    getMember(c),
  )
  const guest = await tracker.track("tribe_post_auth_guest", () => getGuest(c))

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const postId = c.req.param("id")

  if (!postId || postId === "undefined") {
    return c.json(
      {
        success: false,
        error: "Post ID is required",
      },
      400,
    )
  }

  // Redis setup (skip in dev/e2e)
  const redis =
    isDevelopment || isE2E
      ? {
          get: async (key: string) => null,
          setex: async (key: string, ttl: number, value: string) => {},
          del: async (key: string) => {},
        }
      : dbRedis

  const skipCache = false

  try {
    // Create cache key for single post
    const cacheKey = `tribe:post:${postId}:language:${language || "en"}`

    // Check Redis cache first
    if (!skipCache && !isDevelopment && !isE2E) {
      const cached = await redis.get(cacheKey)
      if (cached) {
        console.log(`✅ Tribe post cache hit: ${postId}`)
        return c.json(JSON.parse(cached))
      }
    }

    console.log(`📝 Fetching fresh tribe post: ${postId}`)

    // Get post details by ID with app data
    const [postData] = await tracker.track("tribe_post_request_post", () =>
      db
        .select({
          post: tribePosts,
          app: apps,
          tribe: tribes,
        })
        .from(tribePosts)
        .leftJoin(apps, eq(tribePosts.appId, apps.id))
        .leftJoin(tribes, eq(tribePosts.tribeId, tribes.id))
        .where(eq(tribePosts.id, postId))
        .limit(1),
    )

    if (!postData) {
      return c.json(
        {
          success: false,
          error: "Post not found",
        },
        404,
      )
    }

    const post = {
      ...postData.post,
      user: null,
      guest: null,
      tribe: postData.tribe,
    }

    // Get comments for this post with app data
    const comments = await tracker.track("tribe_post_comments", () =>
      db
        .select({
          comment: tribeComments,
          app: apps,
        })
        .from(tribeComments)
        .leftJoin(apps, eq(tribeComments.appId, apps.id))
        .where(eq(tribeComments.postId, postId))
        .orderBy(desc(tribeComments.createdOn))
        .limit(100),
    )

    // Get reactions for this post
    const reactions = await tracker.track("tribe_post_reactions", () =>
      getTribeReactions({
        postId,
        limit: 100,
      }),
    )

    // Get likes for this post
    const likes = await tracker.track("tribe_post_likes", () =>
      getTribeLikes({
        postId,
        limit: 100,
      }),
    )

    const thread = await getThread({
      tribePostId: post.id,
    })

    const placeHolder = await getPlaceHolder({
      tribePostId: post.id,
    })

    // Get available translations for this post
    const translations = await tracker.track("tribe_post_translations", () =>
      db.query.tribePostTranslations.findMany({
        where: eq(tribePostTranslations.postId, postId),
        columns: {
          language: true,
          createdOn: true,
        },
      }),
    )

    // Get translation if language is specified
    let translatedTitle = post.title
    let translatedContent = post.content
    if (language && language !== "en") {
      const translation = await db.query.tribePostTranslations.findFirst({
        where: and(
          eq(tribePostTranslations.postId, postId),
          eq(tribePostTranslations.language, language),
        ),
      })
      if (translation) {
        translatedTitle = translation.title || post.title
        translatedContent = translation.content
      }
    }

    const postLanguages = translations.map((t) => t.language)

    const responseData = {
      success: true,
      placeholder: placeHolder?.text,
      post: {
        ...post,
        title: translatedTitle,
        content: translatedContent,
        user: null,
        guest: null,
        languages: postLanguages.length
          ? postLanguages.includes("en")
            ? postLanguages
            : postLanguages.concat("en")
          : ["en"],
        app: await getAppDb({ id: post.appId, threadId: thread?.id }),
        comments: await Promise.all(
          comments.map(async (c) => {
            // Fetch comment translations
            const commentTranslations =
              await db.query.tribeCommentTranslations.findMany({
                where: eq(tribeCommentTranslations.commentId, c.comment.id),
              })

            const commentTranslation =
              language && language !== "en"
                ? commentTranslations.find((t) => t.language === language)
                : undefined

            const commentLanguages = commentTranslations.map((t) => t.language)

            return {
              ...c.comment,
              content: commentTranslation?.content ?? c.comment.content,
              languages: commentLanguages.length
                ? commentLanguages.includes("en")
                  ? commentLanguages
                  : commentLanguages.concat("en")
                : ["en"],
              app: c.app
                ? await getSimpleApp({ id: c.app.id, threadId: thread?.id })
                : null,
            }
          }),
        ),
        reactions: await Promise.all(
          reactions.map(async (c) => ({
            ...c,
            app: c.app
              ? await getSimpleApp({ id: c.app.id, threadId: thread?.id })
              : null,
          })),
        ),
        likes,
        stats: {
          commentsCount: post.commentsCount,
          likesCount: post.likesCount,
          sharesCount: post.sharesCount,
          reactionsCount: reactions.length,
        },
      },
    }

    // Store in Redis cache with 15 minute TTL
    if (!isDevelopment && !isE2E) {
      await redis.setex(cacheKey, 900, JSON.stringify(responseData))
      console.log(`💾 Cached tribe post: ${postId}`)
    }

    return c.json(responseData)
  } catch (error) {
    console.error("Error fetching tribe post:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})

// Toggle like on a post
app.post("/p/:id/like", async (c) => {
  const tracker = new PerformanceTracker("tribe_post_like_request")

  const member = await tracker.track("tribe_post_like_auth_member", () =>
    getMember(c),
  )
  const guest = await tracker.track("tribe_post_like_auth_guest", () =>
    getGuest(c),
  )

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const postId = c.req.param("id")

  if (!postId || postId === "undefined") {
    return c.json(
      {
        success: false,
        error: "Post ID is required",
      },
      400,
    )
  }

  // Use transaction to prevent race conditions
  const result = await db.transaction(async (tx) => {
    // Check if like already exists
    const existingLike = await tx
      .select()
      .from(tribeLikes)
      .where(
        and(
          eq(tribeLikes.postId, postId),
          member
            ? eq(tribeLikes.userId, member.id)
            : eq(tribeLikes.guestId, guest!.id),
        ),
      )
      .limit(1)

    if (existingLike.length > 0) {
      const existingLikeId = existingLike?.[0]?.id
      // Unlike: delete the existing like
      existingLikeId &&
        (await tx.delete(tribeLikes).where(eq(tribeLikes.id, existingLikeId)))

      // Atomic decrement of likes count (ensuring it doesn't go below 0)
      const [updated] = await tx
        .update(tribePosts)
        .set({
          likesCount: sql`GREATEST(0, ${tribePosts.likesCount} - 1)`,
        })
        .where(eq(tribePosts.id, postId))
        .returning({ likesCount: tribePosts.likesCount })

      return { liked: false, likesCount: updated?.likesCount ?? 0 }
    } else {
      // Like: create new like
      await tx.insert(tribeLikes).values({
        postId,
        userId: member?.id,
        guestId: guest?.id,
      })

      // Atomic increment of likes count
      const [updated] = await tx
        .update(tribePosts)
        .set({
          likesCount: sql`${tribePosts.likesCount} + 1`,
        })
        .where(eq(tribePosts.id, postId))
        .returning({ likesCount: tribePosts.likesCount })

      return { liked: true, likesCount: updated?.likesCount ?? 0 }
    }
  })

  return c.json({
    success: true,
    liked: result.liked,
    likesCount: result.likesCount,
  })
})

// Delete tribe post (owner or admin only)
app.delete("/p/:id", async (c) => {
  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const postId = c.req.param("id")

  try {
    // Get the post to check ownership
    const post = await db.query.tribePosts.findFirst({
      where: eq(tribePosts.id, postId),
    })

    if (!post) {
      return c.json({ error: "Post not found" }, { status: 404 })
    }

    // Check if user is post owner or admin
    const isOwner = post.userId === member?.id || post.guestId === guest?.id
    const isAdmin = isDevelopment || member?.role === "admin"

    if (!isOwner && !isAdmin) {
      return c.json(
        { error: "Only post owner or tribe admin can delete posts" },
        { status: 403 },
      )
    }

    // Delete the post (comments and reactions will cascade delete if FK constraints are set)
    await db.delete(tribePosts).where(eq(tribePosts.id, postId))

    // Decrement tribe postsCount
    if (post.tribeId) {
      await db
        .update(tribes)
        .set({ postsCount: sql`GREATEST(${tribes.postsCount} - 1, 0)` })
        .where(eq(tribes.id, post.tribeId))
    }

    // Invalidate cache - delete single post and all feed caches
    if (!isDevelopment && !isE2E) {
      // Delete all language variations of the single post
      await clearFeed(postId)
      console.log(`🗑️ Invalidated cache for deleted post: ${postId}`)
    }

    return c.json({
      success: true,
      message: "Post deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting post:", error)
    return c.json({ error: "Failed to delete post" }, { status: 500 })
  }
})

// Delete tribe comment (owner or admin only)
app.delete("/c/:id", async (c) => {
  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const commentId = c.req.param("id")

  try {
    // Get the comment to check ownership
    const comment = await db.query.tribeComments.findFirst({
      where: eq(tribeComments.id, commentId),
    })

    if (!comment) {
      return c.json({ error: "Comment not found" }, { status: 404 })
    }

    // Check if user is comment owner or admin
    const isOwner =
      comment.userId === member?.id || comment.guestId === guest?.id
    const isAdmin = isDevelopment || member?.role === "admin"

    if (!isOwner && !isAdmin) {
      return c.json(
        { error: "Only comment owner or tribe admin can delete comments" },
        { status: 403 },
      )
    }

    // Use transaction to delete the comment and decrement post commentsCount atomically
    await db.transaction(async (tx) => {
      await tx.delete(tribeComments).where(eq(tribeComments.id, commentId))

      await tx
        .update(tribePosts)
        .set({
          commentsCount: sql`GREATEST(${tribePosts.commentsCount} - 1, 0)`,
        })
        .where(eq(tribePosts.id, comment.postId))
    })

    // Invalidate cache after comment deletion
    if (!isDevelopment && !isE2E) {
      await clearFeed(comment.postId)
    }

    return c.json({
      success: true,
      message: "Comment deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting comment:", error)
    return c.json({ error: "Failed to delete comment" }, { status: 500 })
  }
})

// Calculate credits based on content length
function calculateCredits(contentLength: number): number {
  return calculateTranslationCredits({ contentLength })
}

// Translate tribe post
app.post("/p/:id/translate", async (c) => {
  if (!openai) {
    return c.json({ error: "Translation service unavailable" }, { status: 503 })
  }
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
    const app = await getSimpleApp({
      id: post.appId,
    })

    if (!app) {
      return c.json({ error: "App not found" }, { status: 404 })
    }

    // Check if user is post owner or admin
    const isOwner = app.userId === member.id

    const isAdmin = isDevelopment || member.role === "admin"
    const canTranslateFree = isOwner || isAdmin

    // Check which languages actually need translation
    const existingTranslations = await db.query.tribePostTranslations.findMany({
      where: and(
        eq(tribePostTranslations.postId, postId),
        inArray(tribePostTranslations.language, languages),
      ),
    })

    const existingLangs = existingTranslations.map((t) => t.language)
    const missingLanguages = languages.filter(
      (lang) => !existingLangs.includes(lang),
    )

    if (missingLanguages.length === 0) {
      return c.json({
        success: true,
        translations: existingTranslations,
        creditsUsed: 0,
        message: "All requested translations already exist.",
      })
    }

    // Calculate total credits needed for MISSING languages
    const contentLength =
      (post.title?.length || 0) + (post.content?.length || 0)
    const creditsPerLanguage = calculateCredits(contentLength)
    const totalCredits = creditsPerLanguage * missingLanguages.length

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

      // Atomically check and deduct credits (prevents overdraft)
      const [deductResult] = await db
        .update(users)
        .set({ credits: sql`${users.credits} - ${totalCredits}` })
        .where(
          and(
            eq(users.id, member.id),
            sql`${users.credits} >= ${totalCredits}`,
          ),
        )
        .returning({ credits: users.credits })

      if (!deductResult) {
        return c.json(
          { error: "Insufficient credits (concurrent request)" },
          { status: 402 },
        )
      }
    }

    const translations = [...existingTranslations]

    // Translate ONLY the missing languages
    for (const lang of missingLanguages) {
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
          max_tokens: 4096,
          response_format: { type: "json_object" },
        })

        if (response.choices[0]?.finish_reason === "length") {
          console.error(
            `❌ Translation for ${lang} was truncated due to length.`,
          )
          return c.json(
            { error: `Translation truncated for ${lang} - content too long` },
            { status: 500 },
          )
        }

        const rawContent = response?.choices?.at(0)?.message?.content || "{}"
        let translated: any = {}

        try {
          translated = JSON.parse(cleanAiResponse(rawContent))
        } catch (parseErr) {
          console.error(`❌ Translation failed to parse JSON for ${lang}`)
          console.error("Raw content:", rawContent)
          throw parseErr
        }

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
          .onConflictDoNothing()
          .returning()

        // If insert was skipped due to conflict, fetch existing translation
        if (!newTranslation) {
          const existingTranslation =
            await db.query.tribePostTranslations.findFirst({
              where: and(
                eq(tribePostTranslations.postId, postId),
                eq(tribePostTranslations.language, lang),
              ),
            })
          if (existingTranslation) {
            translations.push(existingTranslation)
          }
        } else {
          translations.push(newTranslation)
        }

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        captureException(error)
        console.error(`Error translating to ${lang}:`, error)
        return c.json(
          { error: `Translation failed for ${lang}` },
          { status: 500 },
        )
      }
    }

    // Only log credit usage if translation costs credits
    if (!canTranslateFree && totalCredits > 0) {
      await logCreditUsage({
        userId: member.id,
        agentId: agent.id,
        creditCost: totalCredits,
        messageType: "tribe_post_translate",
      })
    }

    // Invalidate cache after translation
    if (!isDevelopment && !isE2E) {
      await clearFeed(postId)
    }

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
  if (!openai) {
    return c.json({ error: "Translation service unavailable" }, { status: 503 })
  }

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

    const app = comment.appId
      ? await getSimpleApp({
          id: comment.appId,
        })
      : null

    // Check if user is post owner or admin
    const isOwner = app && app.userId === member.id
    const isAdmin = isDevelopment || member.role === "admin"
    const canTranslateFree = isOwner || isAdmin

    // Check which languages actually need translation
    const existingTranslations =
      await db.query.tribeCommentTranslations.findMany({
        where: and(
          eq(tribeCommentTranslations.commentId, commentId),
          inArray(tribeCommentTranslations.language, languages),
        ),
      })

    const existingLangs = existingTranslations.map((t) => t.language)
    const missingLanguages = languages.filter(
      (lang) => !existingLangs.includes(lang),
    )

    if (missingLanguages.length === 0) {
      return c.json({
        success: true,
        translations: existingTranslations,
        creditsUsed: 0,
        message: "All requested translations already exist.",
      })
    }

    // Calculate total credits needed for MISSING languages
    const contentLength = comment.content?.length || 0
    const creditsPerLanguage = calculateCredits(contentLength)
    const totalCredits = creditsPerLanguage * missingLanguages.length

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

      // Atomically check and deduct credits (prevents overdraft)
      const [deductResult] = await db
        .update(users)
        .set({ credits: sql`${users.credits} - ${totalCredits}` })
        .where(
          and(
            eq(users.id, member.id),
            sql`${users.credits} >= ${totalCredits}`,
          ),
        )
        .returning({ credits: users.credits })

      if (!deductResult) {
        return c.json(
          { error: "Insufficient credits (concurrent request)" },
          { status: 402 },
        )
      }
    }

    const translations = [...existingTranslations]

    // Translate ONLY missing languages
    for (const lang of missingLanguages) {
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
          max_tokens: 4096,
          response_format: { type: "json_object" },
        })

        if (response.choices[0]?.finish_reason === "length") {
          console.error(
            `❌ Comment translation for ${lang} was truncated due to length.`,
          )
          return c.json(
            {
              error: `Comment translation truncated for ${lang} - content too long`,
            },
            { status: 500 },
          )
        }

        const rawContent = response?.choices?.at(0)?.message?.content || "{}"
        let translated: any = {}

        try {
          translated = JSON.parse(cleanAiResponse(rawContent))
        } catch (parseErr) {
          console.error(`❌ Translation failed to parse JSON for ${lang}`)
          console.error("Raw content:", rawContent)
          throw parseErr
        }

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
          .onConflictDoNothing()
          .returning()

        // If insert was skipped due to conflict, fetch existing translation
        if (!newTranslation) {
          const existingTranslation =
            await db.query.tribeCommentTranslations.findFirst({
              where: and(
                eq(tribeCommentTranslations.commentId, commentId),
                eq(tribeCommentTranslations.language, lang),
              ),
            })
          if (existingTranslation) {
            translations.push(existingTranslation)
          }
        } else {
          translations.push(newTranslation)
        }

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

    // Only log credit usage if translation costs credits
    if (!canTranslateFree && totalCredits > 0) {
      await logCreditUsage({
        userId: member.id,
        agentId: agent.id,
        creditCost: totalCredits,
        messageType: "tribe_post_comment_translate",
      })
    }

    // Invalidate cache after comment translation
    if (!isDevelopment && !isE2E) {
      await clearFeed(comment.postId)
    }

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
