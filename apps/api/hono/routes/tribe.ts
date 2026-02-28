import type { tribePost } from "@chrryai/chrry/types"
import { isDevelopment } from "@chrryai/chrry/utils"
import { isE2E } from "@chrryai/chrry/utils/siteConfig"
import {
  and,
  db,
  redis as dbRedis,
  desc,
  eq,
  getApp,
  getPlaceHolder,
  getThread,
  getTribeFollows,
  getTribeLikes,
  getTribePosts,
  getTribeReactions,
  getTribes,
  sql,
} from "@repo/db"
import {
  apps,
  tribeComments,
  tribeLikes,
  tribePosts,
  tribes,
} from "@repo/db/src/schema"
import { Hono } from "hono"
import { PerformanceTracker } from "../../lib/analytics"
import { getGuest, getMember } from "../lib/auth"

const app = new Hono()

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
    const result = await tracker.track("tribe_list_getTribes", () =>
      getTribes({
        search,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20,
        page: page ? parseInt(page, 10) : 1,
        appId,
      }),
    )

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
    // Create cache key based on all query parameters
    // Include user ID for liked posts to prevent cross-user cache contamination
    const userKey =
      sortBy === "liked" ? member?.id || guest?.id || "anonymous" : "all"
    const tags = c.req.query("tags") // comma-separated tag list
    const cacheKey = `tribe:posts:${sortBy || "date"}:${order || "desc"}:${tribeId || "all"}:${appId || "all"}:${search || ""}:${characterProfileIds || ""}:${tags || ""}:${pageSize || 10}:${page || 1}:${userKey}`

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

    const data = {
      ...result,
      posts: result?.posts?.map((r: tribePost) => ({
        ...r,
        content: (() => {
          const hasMedia =
            (Array.isArray(r.images) ? r.images.length > 0 : !!r.images) ||
            (Array.isArray(r.videos) ? r.videos.length > 0 : !!r.videos)
          const limit = 300 * (hasMedia ? 2 : 1)
          return r.content && r.content.length > limit
            ? `${r.content.slice(0, limit)}...`
            : r.content
        })(),
        // App already includes store from database join
      })),
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
    const cacheKey = `tribe:post:${postId}`

    const _cachedPost = null

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

    const responseData = {
      success: true,
      placeholder: placeHolder?.text,
      post: {
        ...post,
        user: null,
        guest: null,
        app: await getApp({ id: post.appId, threadId: thread?.id }),
        comments: await Promise.all(
          comments.map(async (c) => ({
            ...c.comment,
            app: c.app
              ? await getApp({ id: c.app.id, threadId: thread?.id })
              : null,
          })),
        ),
        reactions: await Promise.all(
          reactions.map(async (c) => ({
            ...c,
            app: c.app
              ? await getApp({ id: c.app.id, threadId: thread?.id })
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
      const singlePostKey = `tribe:post:${postId}`
      await dbRedis.del(singlePostKey)

      // Delete all feed caches (they contain this post)
      const feedKeys = await dbRedis.keys("tribe:posts:*")
      if (feedKeys.length > 0) {
        await dbRedis.del(...feedKeys)
      }
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

    // Delete the comment
    await db.delete(tribeComments).where(eq(tribeComments.id, commentId))

    // Decrement post commentsCount
    await db.transaction(async (tx) => {
      await tx.delete(tribeComments).where(eq(tribeComments.id, commentId))

      await tx
        .update(tribePosts)
        .set({
          commentsCount: sql`GREATEST(${tribePosts.commentsCount} - 1, 0)`,
        })
        .where(eq(tribePosts.id, comment.postId))
    })

    return c.json({
      success: true,
      message: "Comment deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting comment:", error)
    return c.json({ error: "Failed to delete comment" }, { status: 500 })
  }
})

export default app
