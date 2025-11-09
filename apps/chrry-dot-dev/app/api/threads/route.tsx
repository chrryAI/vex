import {
  collaboration,
  getApp,
  getThread,
  getThreads,
  getUser,
  thread,
  user,
} from "@repo/db"
import getGuest from "../../actions/getGuest"
import getMember from "../../actions/getMember"
import { NextResponse } from "next/server"
import sanitizeHtml from "sanitize-html"
import { checkRateLimit } from "../../../lib/rateLimiting"
import { validate } from "uuid"
// Initialize rate limiter

export async function GET(request: Request) {
  const member = await getMember()
  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    console.log("❌ No valid credentials")
    return NextResponse.json({ error: "Invalid credentials" })
  }

  const { success } = await checkRateLimit(request, { member, guest })

  if (!success) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Apply rate limiting

  const url = new URL(request.url)
  const searchParams = url.searchParams

  const threadId = searchParams.get("threadId")
  const slug = searchParams.get("slug") as string | null
  const appId = searchParams.get("appId") as string | null

  const starred = request.url.includes("starred")
  const sort = searchParams.get("sort") as "bookmark" | "date"
  const userName = searchParams.get("userName") || undefined
  const collaborationStatus = searchParams.get("collaborationStatus") as
    | "active"
    | "pending"
    | undefined
  const myPendingCollaborations =
    searchParams.get("myPendingCollaborations") === "true"

  if (
    collaborationStatus &&
    !["active", "pending"].includes(collaborationStatus)
  ) {
    return NextResponse.json(
      { error: "Invalid collaboration status", status: 400 },
      { status: 400 },
    )
  }

  const app = appId
    ? validate(appId)
      ? await getApp({ id: appId, userId: member?.id, guestId: guest?.id })
      : await getApp({ slug: appId, userId: member?.id, guestId: guest?.id })
    : slug
      ? validate(slug)
        ? await getApp({ id: slug, userId: member?.id, guestId: guest?.id })
        : await getApp({ slug, userId: member?.id, guestId: guest?.id })
      : undefined

  // Sanitize username input
  let sanitizedUserName = userName
    ? sanitizeHtml(userName, {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: "escape",
      })
    : undefined

  const userFromUserName =
    sanitizedUserName && member?.userName !== sanitizedUserName
      ? await getUser({ userName: sanitizedUserName })
      : undefined

  let thread:
    | (thread & {
        collaborations?: { collaboration: collaboration; user: user }[]
      })
    | undefined
  // Authorization check for thread context
  if (threadId) {
    thread = await getThread({ id: threadId })

    // Block unauthorized access to private threads
    if (
      thread &&
      thread.visibility === "private" &&
      thread.guestId !== guest?.id &&
      thread.userId !== member?.id &&
      !thread?.collaborations?.some(
        (collaboration) => collaboration.user.id === member?.id,
      )
    ) {
      return NextResponse.json(
        { error: "Unauthorized access to private thread", status: 401 },
        { status: 401 },
      )
    }
  }

  const pageSize = Number(searchParams.get("pageSize") || "100")
  const search = searchParams.get("search")

  const guestId = thread ? thread.guestId || undefined : guest?.id
  const userId = thread ? thread.userId || undefined : member?.id

  if (!userId && !guestId && !sanitizedUserName) {
    return NextResponse.json(
      { error: "Authentication required", status: 401 },
      { status: 401 },
    )
  }

  // Fetch threads based on context
  const threads = await getThreads({
    appId: app?.id,
    isIncognito: false,
    // Only apply collaboration filtering for registered members, not guests
    collaborationStatus:
      collaborationStatus && member?.id ? [collaborationStatus] : undefined,
    pageSize,
    ...(!sanitizedUserName
      ? {
          guestId,
          userId,
        }
      : {}),
    search: search || undefined,
    starred,
    sort: sort || "bookmark",
    visibility:
      (sanitizedUserName && member?.userName !== sanitizedUserName) ||
      (thread && thread?.userId !== member?.id && thread?.guestId !== guest?.id)
        ? ["public"]
        : undefined,
    userName: sanitizedUserName,
    myPendingCollaborations: myPendingCollaborations ? true : undefined,
  })

  return NextResponse.json({
    ...threads,
    user:
      userFromUserName &&
      userFromUserName.characterProfilesEnabled &&
      userFromUserName.characterProfiles.some(
        (profile) => profile.visibility === "public",
      )
        ? {
            id: userFromUserName.id,
            name: userFromUserName.name,
            userName: userFromUserName.userName,
            image: userFromUserName.image,
            characterProfiles: userFromUserName.characterProfiles.filter(
              (profile) => profile.visibility === "public",
            ),
          }
        : member?.userName === sanitizedUserName
          ? member
          : undefined,
  })
}
