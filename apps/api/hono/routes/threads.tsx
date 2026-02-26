import { defaultLocale } from "@chrryai/chrry/locales"
import { FRONTEND_URL, getMaxFiles, isE2E } from "@chrryai/chrry/utils"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import { render } from "@react-email/render"
import {
  canCollaborate,
  type collaboration,
  createCollaboration,
  deleteThread as deleteThreadDb,
  getApp,
  getCharacterProfile,
  getInvitation,
  getMessages,
  getTask,
  getThread,
  getThreads,
  getUser,
  isOwner,
  type thread,
  updateCharacterProfile,
  updateInvitation,
  updateTask,
  updateThread as updateThreadDb,
  type user,
} from "@repo/db"
import { PROMPT_LIMITS } from "@repo/db/src/schema"
import { Hono } from "hono"
import sanitizeHtml from "sanitize-html"
import { validate } from "uuid"
import Collaboration from "../../components/emails/Collaboration"
import { uploadArtifacts } from "../../lib/actions/uploadArtifacts"
import { captureException } from "../../lib/captureException"
import { deleteFile } from "../../lib/minio"
import {
  checkGenerationRateLimit,
  checkRateLimit,
} from "../../lib/rateLimiting"
import { redact } from "../../lib/redaction"
import { scanFileForMalware } from "../../lib/security"
import { sendEmail } from "../../lib/sendEmail"
import {
  generateThreadInstructions,
  generateThreadTitle,
} from "../../utils/titleGenerator"
import {
  getGuest as getGuestAction,
  getMember as getMemberAction,
} from "../lib/auth"

export const threads = new Hono()

// GET /threads - List threads
threads.get("/", async (c) => {
  const request = c.req.raw
  const member = await getMemberAction(c, { full: true, skipCache: true })
  const guest = await getGuestAction(c, { skipCache: true })

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
  const _slug = c.req.query("slug")
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

  const redactedUsername = await redact(userName)

  // Sanitize username input
  const sanitizedUserName = redactedUsername
    ? sanitizeHtml(redactedUsername, {
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
      }) &&
      thread?.visibility === "private"
    ) {
      return c.json(
        { error: "Unauthorized access to private thread", status: 401 },
        401,
      )
    }
  }

  const _app = await getApp({
    id: appId,
    userId: member?.id,
    guestId: guest?.id,
  })

  const pageSize = Number(c.req.query("pageSize") || "100")
  const search = c.req.query("search")

  const guestId = thread ? thread.guestId || undefined : guest?.id
  const userId = thread ? thread.userId || undefined : member?.id

  if (!userId && !guestId && !sanitizedUserName) {
    return c.json({ error: "Authentication required", status: 401 }, 401)
  }

  const getVisibilityFilter: () => ("public" | "private")[] | undefined =
    () => {
      // Viewing own profile - show all
      if (isSameUser) return undefined

      // Thread context - check collaboration access
      if (thread) {
        const hasAccess = isOwner(thread, {
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

  if (pendingCollaborations?.totalCount) {
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
      userFromUserName?.characterProfilesEnabled &&
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
  const guest = await getGuestAction(c, { skipCache: true })

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
  const _request = c.req.raw

  if (!id || !validate(id)) {
    return c.json({ error: "Thread not found", status: 404 }, 404)
  }

  const member = await getMemberAction(c, { full: true, skipCache: true })
  const guest = await getGuestAction(c, { skipCache: true })

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
      moltUrl: formData.get("moltUrl") as string,
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
    for (const [_key, value] of formData.entries()) {
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

  const member = await getMemberAction(c, { full: true, skipCache: true })
  const guest = await getGuestAction(c, { skipCache: true })

  if (!member && !guest) {
    return c.json({ error: "Unauthorized", status: 401 }, 401)
  }

  const MAX_FILES = getMaxFiles({ user: member, guest })

  // Level 5: Silent Slicing (User Experience optimization)
  // Instead of erroring out, we take what we can and skip the rest
  let processedFiles = files
  if (files.length > MAX_FILES) {
    console.warn(
      `⚠️ User tried to upload ${files.length} files. Slicing to ${MAX_FILES}.`,
    )
    processedFiles = files.slice(0, MAX_FILES)
  }

  // Scan files for malware
  console.log("🔍 Scanning files for malware...")
  for (const file of processedFiles) {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const scanResult = await scanFileForMalware(buffer, {
      filename: file.name,
    })

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
  const moltUrl = requestData.moltUrl
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

      if (inviter?.email && !isE2E && apiKey) {
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
      userId: member?.id,
      guestId: guest?.id,
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

  const rawInstructions =
    instructions === "" ? null : instructions || thread.instructions

  const redactedInstructions = rawInstructions
    ? await redact(rawInstructions)
    : null

  const sanitizedInstructions = redactedInstructions
    ? sanitizeHtml(redactedInstructions, {
        // Sato minimalist config - sadece gerekli tag'ler
        allowedTags: [
          "b",
          "i",
          "em",
          "strong",
          "a",
          "code",
          "pre",
          "blockquote",
          "ul",
          "ol",
          "li",
          "p",
          "br",
          "span",
          "h1",
          "h2",
          "h3",
        ],
        allowedAttributes: {
          a: ["href", "target", "rel"],
          span: ["class"],
          "*": ["style"], // conditional - eğer CSS support gerekliyse
        },
        allowedSchemes: ["http", "https", "mailto"],
        // Sato performance optimization
        parseStyleAttributes: false, // Style parsing disable - performance için
      })
    : null

  const redactedTitle = title ? await redact(title) : thread.title

  await updateThreadDb({
    ...thread,
    appId: appId ?? thread.appId,
    star: star === 0 ? null : star,
    moltUrl,
    title: sanitizeHtml(redactedTitle || thread.title),
    visibility: visibility || thread.visibility,
    bookmarks: newBookmarks,
    instructions: sanitizedInstructions,
  })

  // Process uploaded artifacts if any
  if (processedFiles && processedFiles.length > 0) {
    const updatedThread = await getThread({ id })
    if (updatedThread) {
      await uploadArtifacts({
        files: processedFiles,
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
