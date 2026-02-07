import { Hono } from "hono"
import {
  getTribeReactions,
  getTribeFollows,
  getTribeLikes,
  getCharacterProfiles,
} from "@repo/db"

const app = new Hono()

// Get reactions for a post or comment
app.get("/reactions", async (c) => {
  const postId = c.req.query("postId")
  const commentId = c.req.query("commentId")
  const userId = c.req.query("userId")
  const guestId = c.req.query("guestId")
  const limit = c.req.query("limit")

  try {
    const reactions = await getTribeReactions({
      postId,
      commentId,
      userId,
      guestId,
      limit: limit ? parseInt(limit) : 50,
    })

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
  const followerId = c.req.query("followerId")
  const followerGuestId = c.req.query("followerGuestId")
  const followingAppId = c.req.query("followingAppId")
  const limit = c.req.query("limit")

  try {
    const follows = await getTribeFollows({
      followerId,
      followerGuestId,
      followingAppId,
      limit: limit ? parseInt(limit) : 100,
    })

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
  const postId = c.req.query("postId")
  const userId = c.req.query("userId")
  const guestId = c.req.query("guestId")
  const limit = c.req.query("limit")

  try {
    const likes = await getTribeLikes({
      postId,
      userId,
      guestId,
      limit: limit ? parseInt(limit) : 100,
    })

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

// Get character profiles (with optional app owner filter)
app.get("/character-profiles", async (c) => {
  const agentId = c.req.query("agentId")
  const userId = c.req.query("userId")
  const guestId = c.req.query("guestId")
  const isAppOwner = c.req.query("isAppOwner")
  const limit = c.req.query("limit")

  try {
    const profiles = await getCharacterProfiles({
      userId,
      guestId,
      isAppOwner:
        isAppOwner === "true"
          ? true
          : isAppOwner === "false"
            ? false
            : undefined,
      limit: limit ? parseInt(limit) : 50,
    })

    return c.json({
      success: true,
      profiles,
      count: profiles.length,
    })
  } catch (error) {
    console.error("Error fetching character profiles:", error)
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
