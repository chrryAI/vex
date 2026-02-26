import { MAX_FILE_LIMITS } from "@chrryai/chrry/utils"
import {
  createMessage,
  createThread,
  deleteMessage,
  getAiAgent,
  getMessage,
  getMessages,
  getMood,
  getPureApp,
  getScheduledJob,
  getTask,
  getThread,
  type guest,
  isDevelopment,
  isE2E as isE2EInternal,
  isOwner,
  type subscription,
  updateMessage,
  updateTask,
  updateThread,
  type user,
  VEX_LIVE_FINGERPRINTS,
} from "@repo/db"
import { PROMPT_LIMITS, type webSearchResultType } from "@repo/db/src/schema"
import { Hono } from "hono"
import sanitizeHtml from "sanitize-html"
import { v4 as uuidv4, validate } from "uuid"
import { getDailyImageLimit, isCollaborator } from "../../lib"
import { processMessageForRAG } from "../../lib/actions/ragService"
import { uploadArtifacts } from "../../lib/actions/uploadArtifacts"
import { captureException } from "../../lib/captureException"
import { deleteFile } from "../../lib/minio"
import { notifyOwnerAndCollaborations } from "../../lib/notify"
import { checkRateLimit } from "../../lib/rateLimiting"
import { redact } from "../../lib/redaction"
import { scanFileForMalware } from "../../lib/security"
import { streamControllers } from "../../lib/streamControllers"
import { generateThreadTitle, trimTitle } from "../../utils/titleGenerator"
import { getGuest, getMember } from "../lib/auth"

export const messages = new Hono()

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

// File upload rate limiting configuration
const FILE_UPLOAD_LIMITS = {
  guest: {
    maxFilesPerHour: 3,
    maxFilesPerDay: 10,
    maxTotalSizeMBPerDay: 50,
    maxFileSizeMB: 10,
  },
  member: {
    maxFilesPerHour: 10,
    maxFilesPerDay: 30,
    maxTotalSizeMBPerDay: 200,
    maxFileSizeMB: 25,
  },
  subscriber: {
    maxFilesPerHour: 30,
    maxFilesPerDay: 150,
    maxTotalSizeMBPerDay: 1000,
    maxFileSizeMB: 200,
  },
}

const getUploadLimitsForUser = ({
  user,
  guest,
}: {
  user?: user & { subscription?: subscription }
  guest?: guest & { subscription?: subscription }
}) => {
  if (!user && !guest) return null
  if (user?.subscription || guest?.subscription) {
    return FILE_UPLOAD_LIMITS.subscriber
  }
  return user ? FILE_UPLOAD_LIMITS.member : FILE_UPLOAD_LIMITS.guest
}

const getFileUploadQuota = async ({
  user,
  guest,
}: {
  user?: user & { subscription?: subscription }
  guest?: guest & { subscription?: subscription }
}) => {
  if (!user && !guest) {
    return null
  }

  const limits = getUploadLimitsForUser({ user, guest })

  if (!limits) {
    return null
  }

  const now = new Date()
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const thisHourUTC = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
    ),
  )

  const subject = user || guest

  if (!subject) {
    return null
  }

  const lastReset = subject.lastFileUploadReset
    ? new Date(subject.lastFileUploadReset)
    : null
  const needsDailyReset = !lastReset || lastReset < todayUTC
  const needsHourlyReset = !lastReset || lastReset < thisHourUTC

  let currentHourlyUploads = subject.fileUploadsThisHour || 0
  let currentDailyUploads = subject.fileUploadsToday || 0
  let currentDailySize = subject.totalFileSizeToday || 0
  let currentDailyImages = subject.imagesGeneratedToday || 0

  if (needsDailyReset) {
    currentDailyUploads = 0
    currentDailySize = 0
    currentDailyImages = 0
    currentHourlyUploads = 0
  } else if (needsHourlyReset) {
    currentHourlyUploads = 0
  }

  const nextHour = new Date(thisHourUTC.getTime() + ONE_HOUR_MS)
  const tomorrow = new Date(todayUTC.getTime() + ONE_DAY_MS)

  const dailyImageLimit = getDailyImageLimit({ member: user, guest })

  return {
    hourly: {
      used: currentHourlyUploads,
      limit: limits.maxFilesPerHour,
      resetTime: nextHour.toISOString(),
    },
    daily: {
      used: currentDailyUploads,
      limit: limits.maxFilesPerDay,
      resetTime: tomorrow.toISOString(),
    },
    dailySize: {
      used: Math.round(currentDailySize * 10) / 10,
      limit: limits.maxTotalSizeMBPerDay,
      resetTime: tomorrow.toISOString(),
    },
    images: {
      used: currentDailyImages,
      limit: dailyImageLimit,
      resetTime: tomorrow.toISOString(),
    },
  }
}

// GET /messages - Fetch messages or quota info
messages.get("/", async (c) => {
  const member = await getMember(c)
  const guest = await getGuest(c)
  if (!member && !guest) {
    console.log("❌ No valid credentials")
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const { success } = await checkRateLimit(c.req.raw, { member, guest })

  if (!success) {
    return c.json({ error: "Too many requests" }, 429)
  }

  const pageSize = c.req.query("pageSize")
  const threadId = c.req.query("threadId")
  const quota = c.req.query("quota")

  if (quota === "true") {
    const quotaInfo = await getFileUploadQuota({
      user: member,
      guest,
    })
    return c.json({ quotaInfo })
  }

  const messages = await getMessages({
    pageSize: Number.parseInt(pageSize || "24", 10),
    userId: member?.id,
    guestId: guest?.id,
    threadId: threadId || undefined,
  })

  return c.json(messages)
})

// POST /messages - Create new message (and potentially thread)
messages.post("/", async (c) => {
  const member = await getMember(c)
  const guest = member ? undefined : await getGuest(c)
  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const fingerprint = member?.fingerprint || guest?.fingerprint
  const isE2E =
    fingerprint && !VEX_LIVE_FINGERPRINTS.includes(fingerprint) && isE2EInternal

  const { success } = await checkRateLimit(c.req.raw, { member, guest })

  if (!success) {
    return c.json({ error: "Too many requests" }, 429)
  }

  const contentType = c.req.header("content-type") || ""
  let requestData: any
  const files: File[] = []

  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody({ all: true })
    requestData = {
      moodId: body.moodId as string,
      notify: body.notify,
      appId: body.appId as string,
      molt: body.isMolt === "true",
      tribe: body.tribe === "true",
      content: body.content as string,
      retro: body.retro === "true",
      pear: body.pear === "true",
      agentId: body.agentId as string,
      debateAgentId: body.debateAgentId as string,
      threadId: body.threadId as string,
      isIncognito: body.isIncognito === "true",
      actionEnabled: body.actionEnabled === "true",
      instructions: body.instructions as string,
      language: (body.language as string) || "en",
      isTasksEnabled: body.isTasksEnabled === "true",
      isAgent: body.isAgent === "true",
      imageGenerationEnabled: body.imageGenerationEnabled === "true",
      attachmentType: body.attachmentType as string,
      clientId: body.clientId as string,
      deviceId: body.deviceId as string,
      taskId: body.taskId as string,
      jobId: body.jobId as string,
      tribePostId: body.tribePostId as string,
      moltId: body.moltId as string,
    }

    // Extract files - parseBody returns files as File objects in the body map
    // We need to iterate over values and find Files.
    // However, parseBody keys are field names. We must assume we don't know the field names for files OR we look for generic file fields.
    // In Next.js code: for (const [key, value] of formData.entries()) { if (value instanceof File) ... }
    // Hono parseBody returns { key: value | value[] }.
    for (const key in body) {
      const val = body[key]
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item instanceof File) {
            files.push(item)
          }
        }
      } else if (val instanceof File) {
        files.push(val)
      }
    }
  } else {
    const jsonBody = await c.req.json()
    requestData = {
      ...jsonBody,
      // Parse boolean fields for JSON requests (same as multipart)
      molt: jsonBody.molt === "true" || jsonBody.molt === true,
      tribe: jsonBody.tribe === "true" || jsonBody.tribe === true,
    }
  }

  if (files.length > MAX_FILE_LIMITS.artifacts) {
    return c.json(
      { error: `Maximum ${MAX_FILE_LIMITS.artifacts} files allowed` },
      400,
    )
  }

  // Scan files for malware
  console.log("🔍 Scanning files for malware...")

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const scanResult = await scanFileForMalware(buffer, {
      filename: file.name,
      fingerprint,
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

  const {
    stopStreamId,
    content,
    agentId,
    debateAgentId,
    threadId,
    isIncognito,
    instructions,
    language,
    moltId,
    isAgent,
    appId,
    imageGenerationEnabled,
    clientId: clientIdInternal,
    deviceId,
    taskId,
    moodId,
    pear,
    molt,
    tribe,
    retro,
    jobId,
    tribePostId,
    ...rest
  } = requestData

  console.log("📨 Messages Endpoint received:", {
    molt,
    retro,
    contentPreview: content?.substring(0, 20),
    jobId,
  })

  const notify = requestData.notify !== false && requestData.notify !== "false"

  const task = taskId ? await getTask({ id: taskId }) : undefined
  const mood = moodId ? await getMood({ id: moodId }) : undefined
  const app = appId ? await getPureApp({ id: appId }) : undefined
  const job = jobId ? await getScheduledJob({ id: jobId }) : undefined

  // Handle scheduled job requests
  if (jobId && !job) {
    return c.json({ error: "Job not found" }, 404)
  }

  const isMolt = job?.jobType ? job.jobType?.startsWith("molt") : molt
  const isTribe = job?.jobType ? job.jobType?.startsWith("tribe") : tribe

  if (member && app && (isTribe || isMolt) && !isAgent && !jobId) {
    const COOLDOWN_MS = isDevelopment ? 0 : 30 * 60 * 1000 // 30 minutes
    const cooldownType = isTribe ? "tribe" : "molt"
    const recentMessages = await getMessages({
      userId: member.id,
      appId: app.id,
      isTribe: isTribe || undefined,
      isMolt: isMolt || undefined,
      pageSize: 1,
      isAsc: false,
    })
    const lastMessage = recentMessages.messages[0]?.message
    if (lastMessage?.createdOn) {
      const elapsed = Date.now() - new Date(lastMessage.createdOn).getTime()
      if (elapsed < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000)
        return c.json(
          {
            error: `${cooldownType === "tribe" ? "Tribe" : "Molt"} cooldown active. Please wait ${Math.ceil(remainingSeconds / 60)} more minute(s).`,
            cooldown: { remaining: remainingSeconds, type: cooldownType },
          },
          429,
        )
      }
    }
  }

  if (stopStreamId) {
    const controller = streamControllers.get(stopStreamId)
    if (controller) {
      try {
        controller.close()
      } catch (error) {
        captureException(error)
        console.log("Stream already closed or errored", error)
      }
      streamControllers.delete(stopStreamId)
    }
    return c.json({ success: true })
  }

  const webSearchEnabled = rest.webSearchEnabled && !isAgent
  const attachmentType = rest.attachmentType

  if (instructions && instructions.length > PROMPT_LIMITS.INSTRUCTIONS) {
    return c.json({ error: "Instructions too long" }, 400)
  }

  // Redact PII before sanitizing HTML
  const redactedContent = await redact(content)
  let messageContent = redactedContent
    ? sanitizeHtml(redactedContent)
    : undefined

  if (!content && !attachmentType) {
    return c.json({ error: "Please provide a message or attachment" }, 400)
  }

  if (attachmentType && !content) {
    messageContent =
      "Please provide a detailed analysis of the attached file(s). Describe what you see, any notable content, patterns, or insights.."
  }

  if (!messageContent || messageContent.trim() === "") {
    messageContent =
      "Please provide a detailed analysis of the attached file(s). Describe what you see, any notable content, patterns, or insights.."
  }

  const selectedAgent = agentId ? await getAiAgent({ id: agentId }) : undefined
  const selectedDebateAgent = debateAgentId
    ? await getAiAgent({ id: debateAgentId })
    : undefined

  let currentThreadId = threadId

  if (!currentThreadId) {
    const threadTitle = trimTitle(messageContent)
    const newThread = await createThread({
      taskId: task?.id,
      title: threadTitle,
      aiResponse: "",
      userId: member?.id,
      guestId: guest?.id,
      isIncognito,
      instructions,
      appId: app?.id,
      isMolt,
      isTribe,
    })

    if (!newThread) {
      return c.json({ error: "Failed to create thread" }, 500)
    }

    if (task) {
      await updateTask({
        ...task,
        threadId: newThread.id,
      })
    }

    currentThreadId = newThread.id

    if (!isE2E) {
      try {
        console.log("🤖 Generating AI title...")
        const newTitle = await generateThreadTitle({
          messages: [messageContent],
          instructions,
          language: language || "en",
          threadId: newThread.id,
          fingerprint,
        })
        await updateThread({
          id: newThread.id,
          title: newTitle,
          updatedOn: new Date(),
        })
      } catch (error) {
        captureException(error)
      }
    }
  }

  const thread = currentThreadId
    ? await getThread({ id: currentThreadId })
    : undefined

  if (!thread) {
    return c.json({ error: "Thread not found" }, 404)
  }

  if (
    thread &&
    !isOwner(thread, { userId: member?.id, guestId: guest?.id }) &&
    !isCollaborator(thread, member?.id, "active") &&
    !member &&
    thread.visibility !== "public"
  ) {
    return c.json(
      { error: "You don't have permission to access this thread" },
      403,
    )
  }

  const webSearchResults: webSearchResultType[] = []
  const clientId = validate(clientIdInternal) ? clientIdInternal : uuidv4()

  if (isAgent && selectedAgent) {
    const agentMessage = await createMessage({
      moodId: mood?.id,
      id: clientId,
      content: messageContent,
      threadId: currentThreadId,
      userId: member?.id,
      guestId: guest?.id,
      webSearchResult: webSearchResults,
      agentId: selectedAgent.id,
      agentVersion: selectedAgent.version,
      appId: app?.id,
      isMolt,
      isTribe,
      jobId,
      moltId,
      tribePostId,
    })

    if (!agentMessage) {
      return c.json({ error: "Failed to create user message" }, 500)
    }
    const message = await getMessage({ id: agentMessage.id })
    if (!message) {
      return c.json({ error: "Failed to create user message" }, 500)
    }
    return c.json({ message })
  }

  const userMessage = await createMessage({
    content: messageContent,
    moodId: mood?.id,
    threadId: currentThreadId,
    userId: member?.id,
    guestId: guest?.id,
    clientId,
    webSearchResult: webSearchResults,
    selectedAgentId: selectedAgent?.id,
    isWebSearchEnabled: webSearchEnabled,
    isImageGenerationEnabled: imageGenerationEnabled,
    isPear: pear || false, // Track Pear feedback submissions
    debateAgentId: selectedDebateAgent?.id,
    appId: app?.id,
    isMolt,
    isTribe,
    jobId: job?.id,
    moltId,
    tribePostId,
  })

  if (userMessage) {
    await uploadArtifacts({
      files,
      thread,
      member,
      guest,
    })
  }

  if (!userMessage) {
    return c.json({ error: "Failed to create user message" }, 500)
  }

  const m = await getMessage({ id: userMessage.id })

  if (m?.message && !isE2E) {
    processMessageForRAG({
      messageId: m.message.id,
      content: m.message.content,
      threadId: m.message.threadId,
      userId: m.message.userId || undefined,
      guestId: m.message.guestId || undefined,
      role: "user",
      app,
    }).catch((error) => {
      captureException(error)
    })
  }

  notify &&
    notifyOwnerAndCollaborations({
      c,
      notifySender: true,
      pushNotification: true,
      thread,
      payload: {
        type: "message",
        data: {
          deviceId,
          message: m,
          isFinal: true,
          isWebSearchEnabled: webSearchEnabled,
          isImageGenerationEnabled: imageGenerationEnabled,
        },
      },
      member,
      guest,
    })

  return c.json({
    message: m,
    isWebSearchEnabled: webSearchEnabled,
    isImageGenerationEnabled: imageGenerationEnabled,
  })
})

// GET /messages/:id - Get single message
messages.get("/:id", async (c) => {
  const id = c.req.param("id")
  if (!id) return c.json({ error: "ID is required" }, 400)

  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const message = await getMessage({
    id,
    userId: member?.id,
    guestId: guest?.id,
  })

  if (!message) {
    return c.json({ error: "Message not found" }, 404)
  }

  return c.json(message)
})

// PATCH /messages/:id - Update message (reactions)
messages.patch("/:id", async (c) => {
  const id = c.req.param("id")
  if (!id) return c.json({ error: "ID is required" }, 400)

  const body = await c.req.json()
  const { like, clientId, moltUrl } = body

  if (clientId && !validate(clientId)) {
    return c.json({ error: "Invalid client ID" }, 400)
  }

  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const existingMessage = await getMessage({ id })

  if (!existingMessage) {
    return c.json({ error: "Message not found" }, 404)
  }

  const newReactions =
    like === undefined
      ? existingMessage.message.reactions
      : like === null
        ? existingMessage.message.reactions?.filter(
            (b) => b.userId !== member?.id && b.guestId !== guest?.id,
          ) || []
        : like === true
          ? existingMessage.message.reactions?.some(
              (b) =>
                (b.userId === member?.id || b.guestId === guest?.id) && b.like,
            )
            ? existingMessage.message.reactions
            : [
                ...(existingMessage.message.reactions?.filter(
                  (b) => b.userId !== member?.id && b.guestId !== guest?.id,
                ) || []),
                {
                  like: true,
                  dislike: false,
                  userId: member?.id,
                  guestId: guest?.id,
                  createdOn: new Date().toISOString(),
                },
              ]
          : existingMessage.message.reactions?.some(
                (b) =>
                  (b.userId === member?.id || b.guestId === guest?.id) &&
                  b.dislike,
              )
            ? existingMessage.message.reactions
            : [
                ...(existingMessage.message.reactions?.filter(
                  (b) => b.userId !== member?.id && b.guestId !== guest?.id,
                ) || []),
                {
                  like: false,
                  dislike: true,
                  userId: member?.id,
                  guestId: guest?.id,
                  createdOn: new Date().toISOString(),
                },
              ]

  const message = await updateMessage({
    ...existingMessage.message,
    reactions: newReactions,
    clientId: clientId ?? existingMessage.message.clientId,
    moltUrl: moltUrl ?? existingMessage.message.moltUrl,
  })

  if (!message) {
    return c.json({ error: "Failed to update message" }, 500)
  }

  return c.json({ message })
})

// DELETE /messages/:id - Delete message
messages.delete("/:id", async (c) => {
  const id = c.req.param("id")
  if (!id) return c.json({ error: "ID is required" }, 400)

  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const existingMessage = await getMessage({ id })

  if (!existingMessage) {
    return c.json({ error: "Message not found" }, 404)
  }

  const thread = await getThread({
    id: existingMessage.thread.id,
  })

  if (!thread) {
    return c.json({ error: "Thread not found" }, 404)
  }

  // Permission check
  if (
    !isOwner(existingMessage.message, {
      userId: member?.id,
      guestId: guest?.id,
    })
  ) {
    if (
      !isOwner(existingMessage.thread, {
        userId: member?.id,
        guestId: guest?.id,
      })
    ) {
      return c.json({ error: "Unauthorized" }, 403)
    }
  }

  // Delete associated files from MinIO
  const filesToDelete: string[] = []
  if (existingMessage.message.images) {
    existingMessage.message.images.forEach((img) => {
      img.url && filesToDelete.push(img.url)
    })
  }
  if (existingMessage.message.files) {
    existingMessage.message.files.forEach((f) => {
      f.url && filesToDelete.push(f.url)
    })
  }
  if (existingMessage.message.video) {
    existingMessage.message.video.forEach((v) => {
      v.url && filesToDelete.push(v.url)
    })
  }

  const deletePromises = filesToDelete.map((url) =>
    deleteFile(url).catch((err) => {
      captureException(err)
      console.error("Failed to delete file:", url, err)
    }),
  )

  await Promise.all(deletePromises)

  const message = await deleteMessage({ id })

  if (!message) {
    return c.json({ error: "Failed to delete message" }, 500)
  }

  notifyOwnerAndCollaborations({
    c,
    thread,
    payload: {
      type: "delete_message",
      data: {
        id,
      },
    },
    member,
    guest,
  })

  return c.json({ message: "Message deleted successfully" })
})
