import type { user } from "@repo/db"
import { getUser } from "@repo/db"
import { Hono } from "hono"
import sanitizeHtml from "sanitize-html"
import { getGuest, getMember } from "../lib/auth"

export const users = new Hono()

// Helper to sanitize user object and remove sensitive fields
const sanitizeUser = (user?: user) => {
  if (!user) return undefined
  return {
    id: user.id,
    userName: user.userName,
    email: user.email,
    image: user.image,
  }
}

// GET /users - Search for users or get user by username/email
users.get("/", async (c) => {
  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const userNameOrEmail = sanitizeHtml(c.req.query("search") || "")
  const _pageSize = Number(c.req.query("pageSize") || "10")
  const _similarTo = sanitizeHtml(c.req.query("similarTo") || "")

  const user = userNameOrEmail
    ? (await getUser({ userName: userNameOrEmail })) ||
      (await getUser({ email: userNameOrEmail }))
    : undefined

  if (!user) {
    return c.json({ error: "User not found" }, 404)
  }

  return c.json({
    user: sanitizeUser(user),
  })
})
