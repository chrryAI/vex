import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { NextResponse } from "next/server"
import sanitizeHtml from "sanitize-html"
import { getUser, getUsers } from "@repo/db"

export async function GET(request: Request) {
  const member = getMember()

  const url = new URL(request.url)
  const searchParams = url.searchParams
  const userNameOrEmail = sanitizeHtml(searchParams.get("search") || "")
  const find = sanitizeHtml(searchParams.get("find") || "")
  const pageSize = Number(searchParams.get("pageSize") || "10")
  const similarTo = sanitizeHtml(searchParams.get("similarTo") || "")

  const guest = !member ? getGuest() : undefined

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = userNameOrEmail
    ? (await getUser({ userName: userNameOrEmail })) ||
      (await getUser({ email: userNameOrEmail }))
    : undefined

  if (!user && userNameOrEmail) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const users = userNameOrEmail
    ? []
    : await getUsers({
        pageSize,
        search: sanitizeHtml(find),
        isPublic: true,
        similarTo,
      })

  return NextResponse.json({
    users,
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
}
