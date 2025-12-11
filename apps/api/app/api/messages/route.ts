import getGuest from "../../actions/getGuest"
import getMember from "../../actions/getMember"
import { NextResponse } from "next/server"
import { v4 as uuidv4, validate } from "uuid"
import { getMood, getPureApp, getTask, guest, updateTask } from "@repo/db"

// Initialize with a pretrained model

interface StreamController {
  close: () => void
  desiredSize: number | null
  enqueue: (chunk: any) => void
  error: (e?: any) => void
}

// At top of file

const streamControllers = new Map<string, StreamController>()

interface EnhancedSearchResult {
  title: string
  url: string
  snippet: string
  relevanceScore: number
}

import {
  getMessages,
  createMessage,
  getAiAgent,
  createThread,
  getMessage,
  subscription,
  updateThread,
  getThread,
} from "@repo/db"
import { user } from "@repo/db"
import { isE2E, isOwner, MAX_FILE_LIMITS } from "chrry/utils"
import { PROMPT_LIMITS, webSearchResultType } from "@repo/db/src/schema"
import sanitizeHtml from "sanitize-html"

import { generateThreadTitle, trimTitle } from "../../../utils/titleGenerator"
import { notifyOwnerAndCollaborations } from "../../../lib/notify"
import { processMessageForRAG } from "../../actions/ragService"
import { isCollaborator, getDailyImageLimit } from "../../../lib"
import { uploadArtifacts } from "../../actions/uploadArtifacts"
import { checkRateLimit } from "../../../lib/rateLimiting"
import captureException from "../../../lib/captureException"
import { scanFileForMalware } from "../../../lib/security"
import { trackSignup } from "../../../lib/ads"

// Enhanced streaming helper for consistent E2E testing across all AI models

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

// Check if message needs web search

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

// Get current file upload quota info for a user
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

  // Check if we need to reset counters
  const lastReset = subject.lastFileUploadReset
    ? new Date(subject.lastFileUploadReset)
    : null
  const needsDailyReset = !lastReset || lastReset < todayUTC
  const needsHourlyReset = !lastReset || lastReset < thisHourUTC

  let currentHourlyUploads = subject.fileUploadsThisHour || 0
  let currentDailyUploads = subject.fileUploadsToday || 0
  let currentDailySize = subject.totalFileSizeToday || 0
  let currentDailyImages = subject.imagesGeneratedToday || 0

  // Reset counters if needed
  if (needsDailyReset) {
    currentDailyUploads = 0
    currentDailySize = 0
    currentDailyImages = 0
    currentHourlyUploads = 0
  } else if (needsHourlyReset) {
    currentHourlyUploads = 0
  }

  // Calculate reset times
  const nextHour = new Date(thisHourUTC.getTime() + ONE_HOUR_MS)
  const tomorrow = new Date(todayUTC.getTime() + ONE_DAY_MS)

  // Get daily image limit for user
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

export async function GET(request: Request) {
  const member = await getMember()
  const guest = !member ? await getGuest() : undefined
  if (!member && !guest) {
    console.log("❌ No valid credentials")
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }
  const { success } = await checkRateLimit(request, { member, guest })

  if (!success) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })
  }

  const url = new URL(request.url)
  const searchParams = url.searchParams
  const pageSize = searchParams.get("pageSize")
  const threadId = searchParams.get("threadId")
  const quota = searchParams.get("quota")

  // If quota parameter is present, return quota info
  if (quota === "true") {
    const quotaInfo = await getFileUploadQuota({ user: member, guest })
    return NextResponse.json({ quotaInfo })
  }

  const messages = await getMessages({
    pageSize: parseInt(pageSize || "24"),
    userId: member?.id,
    guestId: guest?.id,
    threadId: threadId || undefined,
  })

  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  const member = await getMember()
  const guest = member ? undefined : await getGuest()
  if (!member && !guest) {
    return NextResponse.json({ error: "Invalid credentials" })
  }
  const { success } = await checkRateLimit(request, { member, guest })

  if (!success) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Check if request contains files (multipart/form-data) or JSON
  const contentType = request.headers.get("content-type") || ""
  let requestData: any
  let files: File[] = []

  if (contentType.includes("multipart/form-data")) {
    // Handle file uploads
    const formData = (await request.formData()) as unknown as FormData
    requestData = {
      moodId: formData.get("moodId") as string,
      appId: formData.get("appId") as string,
      content: formData.get("content") as string,
      agentId: formData.get("agentId") as string,
      debateAgentId: formData.get("debateAgentId") as string,
      threadId: formData.get("threadId") as string,
      isIncognito: formData.get("isIncognito") === "true",
      actionEnabled: formData.get("actionEnabled") === "true",
      instructions: formData.get("instructions") as string,
      language: (formData.get("language") as string) || "en",
      isTasksEnabled: formData.get("isTasksEnabled") === "true",
      isAgent: formData.get("isAgent") === "true",
      imageGenerationEnabled: formData.get("imageGenerationEnabled") === "true",
      attachmentType: formData.get("attachmentType") as string,
      clientId: formData.get("clientId") as string,
      deviceId: formData.get("deviceId") as string,
      taskId: formData.get("taskId") as string,
    }

    // Extract files from form data
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        files.push(value)
      }
    }
  } else {
    // Handle JSON requests (no files)
    requestData = await request.json()
  }

  if (files.length > MAX_FILE_LIMITS.artifacts) {
    return new Response(
      JSON.stringify({
        error: `Maximum ${MAX_FILE_LIMITS.artifacts} files allowed`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
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
      return NextResponse.json(
        {
          error: `File '${file.name}' failed security scan${scanResult.threat ? `: ${scanResult.threat}` : ""}`,
        },
        { status: 400 },
      )
    }
  }
  console.log("✅ All files passed malware scan")

  let {
    stopStreamId,
    content,
    agentId,
    debateAgentId,
    threadId,
    isIncognito,
    actionEnabled,
    instructions,
    language,
    isAgent,
    appId,
    imageGenerationEnabled,
    clientId: clientIdInternal,
    deviceId,
    taskId,
    moodId,
    ...rest
  } = requestData

  const task = taskId ? await getTask({ id: taskId }) : undefined

  const mood = moodId ? await getMood({ id: moodId }) : undefined

  const app = appId ? await getPureApp({ id: appId }) : undefined

  if (stopStreamId) {
    const controller = streamControllers.get(stopStreamId)

    if (controller) {
      try {
        controller.close() // Close the stream
      } catch (error) {
        // Stream might already be closed
        console.log("Stream already closed or errored")
      }
      streamControllers.delete(stopStreamId) // Remove from map
    }

    return NextResponse.json({ success: true })
  }

  const webSearchEnabled = rest.webSearchEnabled && !isAgent
  const attachmentType = rest.attachmentType

  if (instructions && instructions.length > PROMPT_LIMITS.INSTRUCTIONS) {
    return NextResponse.json(
      { error: "Instructions too long" },
      { status: 400 },
    )
  }

  console.log("📝 Request data:", {
    content: content?.substring(0, 100),
    agentId,
    debateAgentId,
    threadId,
    isIncognito,
    attachmentType,
    webSearchEnabled,
    actionEnabled,
    isAgent,
    imageGenerationEnabled,
  })

  console.log("👤 Auth check:", { hasMember: !!member, hasGuest: !!guest })

  // Validate content and provide defaults for file-only uploads
  let messageContent = sanitizeHtml(content)

  if (!content && !attachmentType) {
    console.log("❌ No content or attachment provided")
    return NextResponse.json(
      { error: "Please provide a message or attachment" },
      { status: 400 },
    )
  }

  // For file-only uploads (attachmentType without content), provide default message
  if (attachmentType && !content) {
    messageContent = "Please analyze the attached file(s)."
    console.log(
      "📁 File-only upload detected, using default message:",
      messageContent,
    )
  }

  // Ensure we always have non-empty content for database
  if (!messageContent || messageContent.trim() === "") {
    messageContent = "Please analyze the attached file(s)."
    console.log(
      "⚠️ Empty content detected, using default message:",
      messageContent,
    )
  }

  const selectedAgent = agentId ? await getAiAgent({ id: agentId }) : undefined

  const selectedDebateAgent = debateAgentId
    ? await getAiAgent({ id: debateAgentId })
    : undefined

  webSearchEnabled
    ? console.log("🌐 Web search enabled")
    : console.log("❌ Web search disabled")

  selectedAgent && selectedAgent.capabilities.webSearch
    ? console.log("🤖 Agent supports web search")
    : console.log("❌ Agent does not support web search")

  // Perform web search if user enabled it, agent supports it, message needs search, and no files attached
  let searchContext = ""
  const shouldPerformWebSearch =
    webSearchEnabled && selectedAgent?.capabilities.webSearch

  shouldPerformWebSearch
    ? console.log("🚀 Should perform web search with")
    : console.log("❌ Should not perform web search")

  // Create thread if not provided
  let currentThreadId = threadId

  console.log("🧵 Thread handling:", { providedThreadId: threadId })
  if (!currentThreadId) {
    console.log("🆕 Creating new thread...")

    // Generate intelligent title using AI
    let threadTitle = trimTitle(messageContent)

    const newThread = await createThread({
      taskId: task?.id,
      title: threadTitle,
      aiResponse: "", // Will be updated when AI responds
      userId: member?.id,
      guestId: guest?.id,
      isIncognito,
      instructions,
      appId: app?.id,
    })

    if (!newThread) {
      return NextResponse.json(
        { error: "Failed to create thread" },
        { status: 500 },
      )
    }

    task &&
      (await updateTask({
        ...task,
        threadId: newThread.id,
      }))

    currentThreadId = newThread.id

    // Generate title immediately to avoid race condition with AI response
    if (!isE2E) {
      try {
        console.log("🤖 Generating AI title...")
        const newTitle = await generateThreadTitle({
          messages: [messageContent],
          instructions,
          language: language || "en",
          threadId: newThread.id,
        })
        console.log("✅ Generated title:", newTitle)

        // Update thread with new title
        await updateThread({
          ...newThread,
          title: newTitle,
        })
      } catch (error) {
        captureException(error)
        console.error("❌ Title generation failed:", error)
      }
    }
    currentThreadId = newThread?.id
    console.log("✅ New thread created:", {
      threadId: currentThreadId,
      title: threadTitle,
    })

    // Track thread creation as usage conversion (shows engagement)
    if (member?.id || guest?.id) {
      const trackingId = member?.id || guest?.id || "unknown"
      await trackSignup(trackingId).catch((err) =>
        console.error("Failed to track thread creation:", err),
      )
      console.log("🎯 Tracked thread creation:", trackingId)
    }
  } else {
    // await new Promise((resolve) => setTimeout(resolve, 7000))
  }

  let thread = currentThreadId
    ? await getThread({ id: currentThreadId })
    : undefined

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 })
  }

  if (
    thread &&
    !isOwner(thread, { userId: member?.id, guestId: guest?.id }) &&
    !isCollaborator(thread, member?.id, "active") &&
    !member &&
    thread.visibility !== "public"
  ) {
    return NextResponse.json(
      { error: "You don't have permission to access this thread" },
      { status: 403 }, // 403 Forbidden is more appropriate than 401
    )
  }

  // Create user message first
  console.log("💾 Saving user message...")

  let webSearchResults: webSearchResultType[] = []

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
      searchContext,
    })
    console.log("✅ User message saved")
    console.timeEnd("messageProcessing")

    if (!agentMessage) {
      return NextResponse.json(
        { error: "Failed to create user message" },
        { status: 500 },
      )
    }

    const message = await getMessage({ id: agentMessage.id })
    if (!message) {
      return NextResponse.json(
        { error: "Failed to create user message" },
        { status: 500 },
      )
    }

    return NextResponse.json({ message })
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
    debateAgentId: selectedDebateAgent?.id,
    searchContext,
  })

  userMessage &&
    (await uploadArtifacts({
      files,
      thread,
    }))

  console.log("✅ User message saved with initial credit estimate")

  // Background AI analysis for accurate credit calculation

  if (!userMessage) {
    return NextResponse.json(
      { error: "Failed to create user message" },
      { status: 500 },
    )
  }

  const m = await getMessage({ id: userMessage.id })

  // Process message for RAG embeddings in background
  if (m?.message && !isE2E) {
    processMessageForRAG({
      messageId: m.message.id,
      content: m.message.content,
      threadId: m.message.threadId,
      userId: m.message.userId || undefined,
      guestId: m.message.guestId || undefined,
      role: "user",
    }).catch((error) => {
      captureException(error)
      console.error("❌ Message RAG processing failed:", error)
      // Don't block user experience on RAG processing failure
    })
  }

  thread &&
    notifyOwnerAndCollaborations({
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

  // Notify thread guest if they are not the sender

  return NextResponse.json({
    message: m,
    isWebSearchEnabled: webSearchEnabled,
    isImageGenerationEnabled: imageGenerationEnabled,
  })
}
