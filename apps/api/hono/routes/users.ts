import { Hono } from "hono"
import sanitizeHtml from "sanitize-html"
import { getUser, getUsers } from "@repo/db"
import { getMember, getGuest } from "../lib/auth"

export const users = new Hono()

// GET /users - Search for users or get user by username/email
users.get("/", async (c) => {
  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const userNameOrEmail = sanitizeHtml(c.req.query("search") || "")
  const find = sanitizeHtml(c.req.query("find") || "")
  const pageSize = Number(c.req.query("pageSize") || "10")
  const similarTo = sanitizeHtml(c.req.query("similarTo") || "")

  const user = userNameOrEmail
    ? (await getUser({ userName: userNameOrEmail })) ||
      (await getUser({ email: userNameOrEmail }))
    : undefined

  if (!user && userNameOrEmail) {
    return c.json({ error: "User not found" }, 404)
  }

  const usersList = userNameOrEmail
    ? []
    : await getUsers({
        pageSize,
        search: sanitizeHtml(find),
        isPublic: true,
        similarTo,
      })

  return c.json({
    users: usersList,
    user: user
      ? {
          id: user.id,
          name: user.name,
          image: user.image,
          userName: user.userName,
          email: user.email,
        }
      : undefined,
  })
})
