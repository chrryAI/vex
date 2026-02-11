import { Hono } from "hono"
import {
  getTribeReactions,
  getTribeFollows,
  getTribeLikes,
  getTribePosts,
  getTribes,
  db,
  eq,
  desc,
  redis as dbRedis,
} from "@repo/db"
import { tribePosts, tribeComments } from "@repo/db/src/schema"
import { PerformanceTracker } from "../../lib/analytics"
import { getGuest, getMember } from "../lib/auth"
import { isDevelopment } from "@chrryai/chrry/utils"
import { isE2E } from "@chrryai/chrry/utils/siteConfig"

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

  try {
    const result = await tracker.track("tribe_list_getTribes", () =>
      getTribes({
        search,
        pageSize: pageSize ? parseInt(pageSize) : 20,
        page: page ? parseInt(page) : 1,
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
  const userId = c.req.query("userId")
  const guestId = c.req.query("guestId")
  const limit = c.req.query("limit")

  try {
    const reactions = await tracker.track(
      "tribe_reactions_getTribeReactions",
      () =>
        getTribeReactions({
          postId,
          commentId,
          userId,
          guestId,
          limit: limit ? parseInt(limit) : 50,
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
        limit: limit ? parseInt(limit) : 100,
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
  const userId = c.req.query("userId")
  const guestId = c.req.query("guestId")
  const limit = c.req.query("limit")

  try {
    const likes = await tracker.track("tribe_likes_getTribeLikes", () =>
      getTribeLikes({
        postId,
        userId,
        guestId,
        limit: limit ? parseInt(limit) : 100,
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
  const appId = c.req.query("appId")
  const userId = c.req.query("userId")
  const guestId = c.req.query("guestId")
  const search = c.req.query("search")
  const characterProfileIds = c.req.query("characterProfileIds")
  const pageSize = c.req.query("pageSize")
  const page = c.req.query("page")
  const sortBy = c.req.query("sortBy") as
    | "date"
    | "hot"
    | "comments"
    | undefined

  const member = await tracker.track(
    "tribe_post_request_post_auth_member",
    () => getMember(c),
  )
  const guest = await tracker.track("tribe_posts_auth_guest", () => getGuest(c))

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

  const skipCache = c.req.query("skipCache") === "true"

  try {
    // Create cache key based on all query parameters
    const cacheKey = `tribe:posts:${sortBy || "date"}:${tribeId || "all"}:${appId || "all"}:${search || ""}:${characterProfileIds || ""}:${pageSize || 10}:${page || 1}`

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
          characterProfileIds: characterProfileIds
            ? characterProfileIds.split(",")
            : undefined,
          pageSize: pageSize ? parseInt(pageSize) : 10,
          page: page ? parseInt(page) : 1,
          sortBy: sortBy || "date",
        }),
      )

      // Store in Redis cache with 5 minute TTL
      if (!isDevelopment && !isE2E) {
        await redis.setex(cacheKey, 300, JSON.stringify(result))
        console.log(`💾 Cached tribe posts: ${cacheKey}`)
      }
    }

    const data = {
      ...result,
      posts: result?.posts?.map((r) => ({
        ...r,
        content:
          r.content?.length > 300
            ? `${r.content?.slice(0, 300)}...`
            : r.content,
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

  // Redis setup (skip in dev/e2e)
  const redis =
    isDevelopment || isE2E
      ? {
          get: async (key: string) => null,
          setex: async (key: string, ttl: number, value: string) => {},
          del: async (key: string) => {},
        }
      : dbRedis

  const skipCache = c.req.query("skipCache") === "true"

  try {
    // Create cache key for single post
    const cacheKey = `tribe:post:${postId}`

    const cachedPost = null

    // Check Redis cache first
    if (!skipCache && !isDevelopment && !isE2E) {
      const cached = await redis.get(cacheKey)
      if (cached) {
        console.log(`✅ Tribe post cache hit: ${postId}`)
        return c.json(JSON.parse(cached))
      }
    }

    console.log(`📝 Fetching fresh tribe post: ${postId}`)

    // Get post details by ID
    const [postData] = await tracker.track("tribe_post_request_post", () =>
      db
        .select({
          post: tribePosts,
        })
        .from(tribePosts)
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

    const post = postData.post

    // Get comments for this post
    const comments = await tracker.track("tribe_post_comments", () =>
      db
        .select({
          comment: tribeComments,
        })
        .from(tribeComments)
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

    const responseData = {
      success: true,
      post: {
        ...post,
        comments: comments.map((c) => c.comment),
        reactions,
        likes,
        stats: {
          commentsCount: post.commentsCount,
          likesCount: post.likesCount,
          sharesCount: post.sharesCount,
          reactionsCount: reactions.length,
        },
      },
    }

    // Store in Redis cache with 5 minute TTL
    if (!isDevelopment && !isE2E) {
      await redis.setex(cacheKey, 300, JSON.stringify(responseData))
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

export default app
