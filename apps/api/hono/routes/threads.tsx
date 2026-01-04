import { Hono } from "hono"
import {
  canCollaborate,
  collaboration,
  getApp,
  getThread,
  getThreads,
  getUser,
  isOwner,
  thread,
  user,
  getMessages,
  deleteThread as deleteThreadDb,
  updateThread as updateThreadDb,
  getTask,
  updateTask,
  getInvitation,
  createCollaboration,
  updateInvitation,
  getCharacterProfile,
  updateCharacterProfile,
} from "@repo/db"
import {
  getMember as getMemberAction,
  getGuest as getGuestAction,
} from "../lib/auth"
import sanitizeHtml from "sanitize-html"
import {
  checkRateLimit,
  checkGenerationRateLimit,
} from "../../lib/rateLimiting"
import { validate } from "uuid"
import { PROMPT_LIMITS } from "@repo/db/src/schema"
import {
  generateThreadInstructions,
  generateThreadTitle,
} from "../../utils/titleGenerator"
import { FRONTEND_URL, isE2E, MAX_FILE_LIMITS } from "@chrryai/chrry/utils"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import { render } from "@react-email/render"
import Collaboration from "../../components/emails/Collaboration"
import { defaultLocale } from "@chrryai/chrry/locales"
import captureException from "../../lib/captureException"
import { scanFileForMalware } from "../../lib/security"
import { deleteFile } from "../../lib/minio"
import { uploadArtifacts } from "../../lib/actions/uploadArtifacts"
import { sendEmail } from "../../lib/sendEmail"

export const threads = new Hono()

// GET /threads - List threads
threads.get("/", async (c) => {
  const request = c.req.raw
  const member = await getMemberAction(c, { full: true, skipCache: true })
  const guest = !member
    ? await getGuestAction(c, { skipCache: true })
    : undefined

  if (!member && !guest) {
    console.log("❌ No valid credentials")
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const { success } = await checkRateLimit(request, {
    member: member ?? undefined,
    guest: guest ?? undefined,
  })

  if (!success) {
    return c.json({ error: "Too many requests" }, 429)
  }

  const threadId = c.req.query("threadId")
  const slug = c.req.query("slug")
  const appId = c.req.query("appId")
  const starred = request.url.includes("starred")
  const sort = c.req.query("sort") as "bookmark" | "date" | undefined
  const userName = c.req.query("userName") || undefined
  let collaborationStatus = c.req.query("collaborationStatus") as
    | "active"
    | "pending"
    | "null"
    | undefined
  const myPendingCollaborations =
    c.req.query("myPendingCollaborations") === "true"

  if (
    collaborationStatus &&
    !["active", "pending", "null"].includes(collaborationStatus)
  ) {
    collaborationStatus = undefined
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
  const sanitizedUserName = userName
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
      !canCollaborate({
        thread,
        userId: member?.id,
        guestId: guest?.id,
      })
    ) {
      return c.json(
        { error: "Unauthorized access to private thread", status: 401 },
        401,
      )
    }
  }

  const pageSize = Number(c.req.query("pageSize") || "100")
  const search = c.req.query("search")

  const guestId = thread ? thread.guestId || undefined : guest?.id
  const userId = thread ? thread.userId || undefined : member?.id

  if (!userId && !guestId && !sanitizedUserName) {
    return c.json({ error: "Authentication required", status: 401 }, 401)
  }

  const getVisibilityFilter: () =>
    | ("public" | "private")[]
    | undefined = () => {
    // Viewing own profile - show all
    if (isSameUser) return undefined

    // Thread context - check collaboration access
    if (thread) {
      const hasAccess = canCollaborate({
        thread,
        userId: member?.id,
        guestId: guest?.id,
      })
      return hasAccess ? undefined : ["public"]
    }

    // Viewing pending collaborations - show all
    if (myPendingCollaborations) return undefined

    // Viewing another user's profile - public only
    return userFromUserName ? ["public"] : undefined
  }

  const isSameUser = sanitizedUserName && sanitizedUserName === member?.userName

  const collaborationStatusFinal =
    collaborationStatus === "null"
      ? undefined
      : collaborationStatus && member?.id
        ? [collaborationStatus]
        : undefined

  const payload = {
    isIncognito: false,
    pageSize,
    search: search || undefined,
    starred,
    sort: sort || "bookmark",
    myPendingCollaborations: myPendingCollaborations ? true : undefined,
  }

  const pendingCollaborations =
    (collaborationStatus !== "null" && !collaborationStatusFinal) ||
    myPendingCollaborations
      ? await getThreads({
          collaborationStatus: ["pending"],
          userId,
          guestId,
          ...payload,
          myPendingCollaborations: true,
        })
      : undefined

  if (pendingCollaborations && pendingCollaborations.totalCount) {
    return c.json({
      ...pendingCollaborations,
      user: member,
    })
  }

  // Fetch threads based on context
  const threadsResult = await getThreads({
    ...payload,
    // appId: collaborationStatusFinal ? undefined : app?.id,
    collaborationStatus: collaborationStatusFinal,
    ...(!sanitizedUserName
      ? {
          guestId,
          userId,
        }
      : {
          memberId: undefined,
          guestId: undefined,
        }),
    visibility: getVisibilityFilter(),
    userName: sanitizedUserName,
    myPendingCollaborations: myPendingCollaborations ? true : undefined,
  })

  return c.json({
    ...threadsResult,
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
        : isSameUser
          ? member
          : undefined,
  })
})

// GET /threads/:id - Get single thread
threads.get("/:id", async (c) => {
  const id = c.req.param("id")
  const request = c.req.raw
  const liked = request.url.includes("liked")

  if (!validate(id)) {
    return c.json({ error: "Thread not found", status: 404 }, 404)
  }

  const member = await getMemberAction(c, { full: true, skipCache: true })
  const guest = !member
    ? await getGuestAction(c, { skipCache: true })
    : undefined

  const pageSize = Number(c.req.query("pageSize") || "100")

  const thread = await getThread({ id })

  if (!thread) {
    return c.json({ error: "Thread not found", status: 404 }, 404)
  }

  // Allow access if thread is public
  if (thread.visibility !== "public") {
    if (!member && !guest) {
      return c.json({ error: "Unauthorized", status: 401 }, 401)
    }

    if (
      !canCollaborate({
        thread,
        userId: member?.id,
        guestId: guest?.id,
      })
    ) {
      return c.json({ error: "Unauthorized", status: 401 }, 401)
    }
  }

  const messages = await getMessages({
    threadId: id,
    pageSize,
    likedBy: liked ? member?.id || guest?.id : undefined,
  })

  return c.json({ thread, messages })
})

// DELETE /threads/:id - Delete thread
threads.delete("/:id", async (c) => {
  const id = c.req.param("id")
  const request = c.req.raw

  if (!id || !validate(id)) {
    return c.json({ error: "Thread not found", status: 404 }, 404)
  }

  const member = await getMemberAction(c, { full: true, skipCache: true })
  const guest = !member
    ? await getGuestAction(c, { skipCache: true })
    : undefined

  if (!member && !guest) {
    return c.json({ error: "Unauthorized", status: 401 }, 401)
  }

  const thread = await getThread({
    id,
    userId: member?.id,
    guestId: guest?.id,
  })

  if (!thread) {
    return c.json({ error: "Thread not found", status: 404 }, 404)
  }

  const messages = await getMessages({
    threadId: id,
    pageSize: 100000,
    hasAttachments: true,
  })

  await Promise.all(
    messages.messages.map((message) => {
      if (message.message.files) {
        message.message.files.forEach((file) => {
          if (file.url) {
            deleteFile(file.url)
          }
        })

        if (message.message.images) {
          message.message.images.forEach((image) => {
            if (image.url) {
              deleteFile(image.url)
            }
          })
        }

        if (message.message.video) {
          message.message.video.forEach((video) => {
            if (video.url) {
              deleteFile(video.url)
            }
          })
        }

        if (message.message.audio) {
          message.message.audio.forEach((audio) => {
            if (audio.url) {
              deleteFile(audio.url)
            }
          })
        }
      }
    }),
  )

  await deleteThreadDb({ id })

  return c.json({ thread })
})

// PATCH /threads/:id - Update thread
threads.patch("/:id", async (c) => {
  const id = c.req.param("id")
  const request = c.req.raw

  // Check if request contains files (multipart/form-data) or JSON
  const contentType = c.req.header("content-type") || ""
  let requestData: any
  const files: File[] = []

  if (contentType.includes("multipart/form-data")) {
    // Handle file uploads
    const formData = await c.req.formData()
    const rawAppId = formData.get("appId")

    requestData = {
      language: formData.get("language") as string,
      regenerateTitle: formData.get("regenerateTitle") === "true",
      instructions: formData.get("instructions") as string,
      title: formData.get("title") as string,
      regenerateInstructions: formData.get("regenerateInstructions") === "true",
      visibility: formData.get("visibility") as string,
      bookmarked: formData.get("bookmarked") === "true",
      pinCharacterProfile: formData.get("pinCharacterProfile"),
      appId: rawAppId && validate(rawAppId as string) ? rawAppId : null,
    }

    // Extract files from form data
    for (const [key, value] of formData.entries()) {
      if (
        typeof value === "object" &&
        value !== null &&
        (value as unknown as File) instanceof File
      ) {
        files.push(value)
      }
    }
  } else {
    // Handle JSON requests (no files)
    requestData = await c.req.json()
  }

  if (files.length > MAX_FILE_LIMITS.artifacts) {
    return c.json(
      {
        error: `Maximum ${MAX_FILE_LIMITS.artifacts} files allowed`,
      },
      400,
    )
  }

  // Scan files for malware
  console.log("🔍 Scanning files for malware...")
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const scanResult = await scanFileForMalware(buffer)

    if (!scanResult.safe) {
      console.error(`🚨 Malware detected in ${file.name}: ${scanResult.threat}`)
      return c.json(
        {
          error: `File '${file.name}' failed security scan${scanResult.threat ? `: ${scanResult.threat}` : ""}`,
        },
        400,
      )
    }
  }
  console.log("✅ All files passed malware scan")

  const star = Number(requestData.star) || null
  const bookmarked = requestData.bookmarked ?? undefined
  const instructions = requestData.instructions
  const language = requestData.language || "en"
  const title = requestData.title
  const visibility = requestData.visibility
  const regenerateTitle = requestData.regenerateTitle === true
  const regenerateInstructions = requestData.regenerateInstructions === true
  const pinCharacterProfile = requestData.pinCharacterProfile
  const characterProfileVisibility = requestData.characterProfileVisibility
  const appId =
    requestData.appId && validate(requestData.appId as string)
      ? requestData.appId
      : null

  if (instructions && instructions.length > PROMPT_LIMITS.INSTRUCTIONS) {
    return c.json({ error: "Instructions too long" }, 400)
  }

  if (!id || !validate(id)) {
    return c.json({ error: "Thread not found", status: 404 }, 404)
  }

  const member = await getMemberAction(c, { full: true, skipCache: true })
  const guest = !member
    ? await getGuestAction(c, { skipCache: true })
    : undefined

  if (!member && !guest) {
    return c.json({ error: "Unauthorized", status: 401 }, 401)
  }

  const thread = await getThread({ id })

  if (!thread) {
    return c.json({ error: "Thread not found", status: 404 }, 404)
  }

  const task = thread?.taskId ? await getTask({ id: thread.taskId }) : undefined

  const invitation = member?.email
    ? await getInvitation({
        email: member.email,
        threadId: id,
      })
    : undefined

  if (member && invitation && invitation.status === "pending") {
    await createCollaboration({
      threadId: id,
      userId: member?.id,
      role: "collaborator",
      status: "active",
    })

    await updateInvitation({
      ...invitation,
      status: "accepted",
    })

    const siteConfig = getSiteConfig()

    // Send email asynchronously (no await in Hono)
    ;(async () => {
      const inviter = invitation.userId
        ? await getUser({ id: invitation.userId })
        : undefined

      const apiKey = process.env.ZEPTOMAIL_API_KEY

      if (inviter && inviter.email && !isE2E && apiKey) {
        const emailHtml = await render(
          Collaboration({
            origin: FRONTEND_URL,
            thread: thread,
            user: member,
            language: member.language || defaultLocale,
          }),
        )

        try {
          await sendEmail({
            c,
            from: `"${siteConfig.name} Team" <no-reply@${siteConfig.domain}>`,
            to: inviter.email,
            subject: `Let's get started with ${siteConfig.name}!`,
            html: emailHtml,
            headers: {
              "List-Unsubscribe": `<mailto:unsubscribe@${siteConfig.domain}>`,
              "X-Mailer": `${siteConfig.name} Collaboration System`,
            },
          })
        } catch (error) {
          captureException(error)
          console.error("ZeptoMail API error:", error)
        }
      }
    })()
  }

  const owner = isOwner(thread, {
    userId: member?.id,
    guestId: guest?.id,
  })

  if (
    (owner && pinCharacterProfile === true) ||
    pinCharacterProfile === false
  ) {
    const characterProfile = await getCharacterProfile({
      threadId: id,
    })

    if (characterProfile) {
      await updateCharacterProfile({
        ...characterProfile,
        pinned: pinCharacterProfile,
        visibility: !pinCharacterProfile
          ? "private"
          : characterProfileVisibility,
      })
    }

    return c.json({
      thread: await getThread({ id }),
      pinCharacterProfile,
      characterProfileVisibility,
    })
  }

  const newBookmarks =
    bookmarked === undefined
      ? thread.bookmarks
      : bookmarked
        ? thread.bookmarks?.some(
            (b) =>
              b.userId === member?.id || (guest && b.guestId === guest?.id),
          )
          ? thread.bookmarks
          : [
              ...(thread.bookmarks?.filter(
                (b) => b.userId !== member?.id && b.guestId !== guest?.id,
              ) || []),
              {
                userId: member?.id,
                guestId: guest?.id,
                createdOn: new Date().toISOString(),
              },
            ]
        : thread.bookmarks?.filter(
            (b) => b.userId !== member?.id && b.guestId !== guest?.id,
          ) || []

  if (!owner) {
    if (bookmarked !== undefined) {
      await updateThreadDb({
        ...thread,
        bookmarks: newBookmarks,
      })
    } else {
      return c.json({ error: "Unauthorized", status: 401 }, 401)
    }
  }

  const messages =
    regenerateTitle || regenerateInstructions
      ? await getMessages({ threadId: id, page: 1, pageSize: 30 })
      : undefined

  if (regenerateTitle && messages && messages.messages.length > 0) {
    const rateLimitResult = await checkGenerationRateLimit(request, {
      member: member ?? undefined,
      guest: guest ?? undefined,
      threadId: id,
    })

    if (!rateLimitResult.success) {
      return c.json({ error: rateLimitResult.errorMessage }, 429)
    }

    const newTitle = await generateThreadTitle({
      messages: messages.messages.map((m) => m.message.content),
      instructions,
      language,
      threadId: id,
      fingerprint: member?.fingerprint || guest?.fingerprint,
    })

    if (task) {
      await updateTask({
        ...task,
        title: newTitle,
      })
    }

    return c.json({
      thread: {
        ...thread,
        title: newTitle,
      },
      titleGenerationsRemaining: rateLimitResult.remaining,
    })
  }

  if (regenerateInstructions && messages && messages.messages.length > 0) {
    // Check rate limit for instruction generation
    const rateLimitResult = await checkGenerationRateLimit(request, {
      member: member ?? undefined,
      guest: guest ?? undefined,
      threadId: id,
    })

    if (!rateLimitResult.success) {
      return c.json({ error: rateLimitResult.errorMessage }, 429)
    }

    return c.json({
      thread: {
        ...thread,
        instructions: await generateThreadInstructions({
          messages: messages.messages.map((m) => m.message.content),
          currentInstructions: instructions,
          language,
          threadId: id,
          fingerprint: member?.fingerprint || guest?.fingerprint,
        }),
      },
      titleGenerationsRemaining: rateLimitResult.remaining,
    })
  }

  if (task) {
    await updateTask({
      ...task,
      title: title || thread.title,
    })
  }

  await updateThreadDb({
    ...thread,
    appId: appId ?? thread.appId,
    star: star === 0 ? null : star,
    title: title || thread.title,
    visibility: visibility || thread.visibility,
    bookmarks: newBookmarks,
    instructions:
      instructions === "" ? null : instructions || thread.instructions,
  })

  // Process uploaded artifacts if any
  if (files && files.length > 0) {
    const updatedThread = await getThread({ id })
    if (updatedThread) {
      await uploadArtifacts({
        files,
        thread: updatedThread,
        member,
        guest,
      })
    }
  }

  return c.json({
    thread: await getThread({ id }),
  })
})

// DELETE /threads/:id/collaborations - Delete all collaborations for a thread
threads.delete("/:id/collaborations", async (c) => {
  const id = c.req.param("id")

  if (!id || !validate(id)) {
    return c.json({ error: "Thread not found", status: 404 }, 404)
  }

  const member = await getMemberAction(c)
  const guest = member ? undefined : await getGuestAction(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized", status: 401 }, 401)
  }

  const thread = await getThread({ id })

  if (!thread) {
    return c.json({ error: "Thread not found", status: 404 }, 404)
  }

  // Check if user is the thread owner (either member or guest)
  const isThreadOwner =
    (member && thread.userId === member.id) ||
    (guest && thread.guestId === guest.id)

  if (!isThreadOwner) {
    return c.json({ error: "Unauthorized", status: 401 }, 401)
  }

  const { getCollaborations, deleteCollaboration } = await import("@repo/db")
  const collaborations = await getCollaborations({ threadId: id })

  if (!collaborations.length) {
    return c.json({ error: "Collaboration not found", status: 404 }, 404)
  }

  await Promise.all(
    collaborations.map((c) => deleteCollaboration({ id: c.collaboration.id })),
  )

  return c.json({ thread })
})
