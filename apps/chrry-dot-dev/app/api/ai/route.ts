import getGuest from "../../actions/getGuest"
import getMember from "../../actions/getMember"
import { after, NextResponse } from "next/server"
import { expenseCategory, expenseCategoryType } from "chrry/utils"
import { v4 as uuidv4 } from "uuid"
import Handlebars from "handlebars"
import { message } from "@repo/db"

import {
  getMemories,
  getMessages,
  createMessage,
  getAiAgent,
  getMessage,
  updateThread,
  getThread,
  updateMessage,
  thread,
  collaboration,
  logCreditUsage,
  user,
  guest,
  reinforceMemory,
  getPlaceHolder,
  getCalendarEvents,
  updateApp,
  memory,
  getPureApp,
  app,
} from "@repo/db"

import { perplexity } from "@ai-sdk/perplexity"

import {
  processFileForRAG,
  buildEnhancedRAGContext,
  processMessageForRAG,
} from "../../actions/ragService"
import { getLatestNews, getNewsBySource } from "../../../lib/newsFetcher"
import { getAppKnowledge } from "../../../lib/appRAG"
import { streamText, generateText, ModelMessage } from "ai"
import { z } from "zod"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { faker } from "@faker-js/faker"
import { isE2E, isDevelopment, isOwner, MAX_FILE_SIZES } from "chrry/utils"
import Replicate from "replicate"
import { webSearchResultType } from "@repo/db/src/schema"
import {
  CHATGPT_API_KEY,
  CLAUDE_API_KEY,
  extractPDFText,
  GEMINI_API_KEY,
  REPLICATE_API_KEY,
  isCollaborator,
  getHourlyLimit,
} from "../../../lib"
import { scanFileForMalware } from "../../../lib/security"
import { upload } from "../../../lib/uploadthing-server"
import slugify from "slug"
import { notifyOwnerAndCollaborations } from "../../../lib/notify"
import { wait } from "../../../tests"
import { checkRateLimit } from "../../../lib/rateLimiting"
import { captureException } from "@sentry/nextjs"
import generateAIContent from "../../../lib/generateAIContent"
import { checkThreadSummaryLimit } from "../../../lib"
import extractVideoFrames from "../../../lib/extractVideoFrames"
import checkFileUploadLimits from "../../../lib/checkFileUploadLimits"
import { getTools } from "../../../lib/tools"
import { appFormData } from "chrry/schemas/appSchema"

interface StreamController {
  close: () => void
  desiredSize: number | null
  enqueue: (chunk: any) => void
  error: (e?: any) => void
}

const streamControllers = new Map<string, StreamController>()

const estimateTokens = (content?: string): number => {
  if (!content) return 0
  return Math.ceil(content.length / 4) // 4 chars ≈ 1 token
}

const getContextWindow = async (
  messages: { role: string; content: string }[],
  maxPromptSize: number,
) => {
  let tokens = 0
  const context = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i]?.content)
    if (tokens + msgTokens > maxPromptSize * 0.8) break // 20% buffer
    context.unshift(messages[i])
    tokens += msgTokens
  }
  return context
}

async function getRelevantMemoryContext({
  userId,
  guestId,
  appId,
  pageSize = 15,
  threadId,
}: {
  userId?: string
  guestId?: string
  appId?: string
  pageSize?: number
  threadId?: string
}): Promise<{ context: string; memoryIds: string[] }> {
  if (!userId && !guestId && !appId) return { context: "", memoryIds: [] }

  try {
    // Get user memories scattered across different threads (exclude current thread)
    const userMemoriesResult =
      userId || guestId
        ? await getMemories({
            userId,
            guestId,
            pageSize,
            orderBy: "importance",
            excludeThreadId: threadId, // Don't load memories from current thread
            scatterAcrossThreads: true, // Get diverse memories from different conversations
          })
        : { memories: [], totalCount: 0, hasNextPage: false, nextPage: null }

    // Get app-specific memories
    const appMemoriesResult = appId
      ? await getMemories({
          appId,
          pageSize: Math.ceil(pageSize / 2), // Allocate half the space for app memories
          orderBy: "importance",
          excludeThreadId: threadId,
          scatterAcrossThreads: true,
        })
      : { memories: [], totalCount: 0, hasNextPage: false, nextPage: null }

    // Combine user and app memories
    const allMemories = [
      ...(userMemoriesResult.memories || []),
      ...(appMemoriesResult.memories || []),
    ]

    const memoriesResult = {
      memories: allMemories,
      totalCount:
        (userMemoriesResult.totalCount || 0) +
        (appMemoriesResult.totalCount || 0),
      hasNextPage:
        userMemoriesResult.hasNextPage || appMemoriesResult.hasNextPage,
      nextPage: userMemoriesResult.nextPage || appMemoriesResult.nextPage,
    }

    if (!memoriesResult.memories || memoriesResult.memories.length === 0) {
      return { context: "", memoryIds: [] }
    }

    // Sort by importance (highest first) and take top 5
    if (memoriesResult.memories.length === 0)
      return { context: "", memoryIds: [] }

    // Extract memory IDs for reinforcement
    const memoryIds = memoriesResult.memories.map((m) => m.id)

    // Build context from memories
    const userMemories = memoriesResult.memories.filter((m) => !m.appId)
    const appMemories = memoriesResult.memories.filter((m) => m.appId)

    const userMemoryContext = userMemories
      .map((memory) => {
        const categoryEmoji = {
          preference: "⚙️",
          fact: "📌",
          context: "💭",
          instruction: "📝",
          relationship: "👥",
          goal: "🎯",
        }[memory.category || "context"]

        return `${categoryEmoji} ${memory.content}`
      })
      .join("\n")

    const appMemoryContext = appMemories
      .map((memory) => {
        const categoryEmoji = {
          preference: "⚙️",
          fact: "📌",
          context: "💭",
          instruction: "📝",
          relationship: "👥",
          goal: "🎯",
        }[memory.category || "context"]

        return `${categoryEmoji} ${memory.content}`
      })
      .join("\n")

    // Count unique threads for scatter analysis
    const uniqueThreads = new Set(
      memoriesResult.memories
        .map((m) => m.sourceThreadId)
        .filter((id): id is string => id !== null),
    ).size

    console.log(
      `🧠 Retrieved ${memoriesResult.memories.length} memories (${userMemories.length} user, ${appMemories.length} app) from ${uniqueThreads} different threads`,
    )

    let context = ""
    if (userMemoryContext) {
      context += `\n\nRELEVANT CONTEXT ABOUT THE USER:\n${userMemoryContext}\n\nUse this context to personalize your responses when relevant.`
    }
    if (appMemoryContext) {
      context += `\n\nAPP-SPECIFIC KNOWLEDGE:\n${appMemoryContext}\n\nThis is knowledge that this app has learned over time. Use it to provide more informed and consistent responses.`
    }
    return { context, memoryIds }
  } catch (error) {
    console.error("❌ Error retrieving memory context:", error)
    return { context: "", memoryIds: [] }
  }
}

async function enhancedStreamChunk({
  chunk,
  chunkNumber,
  totalChunks,
  streamingMessage,
  member,
  guest,
  thread,
  clientId,
  streamId,
}: {
  chunk: string
  chunkNumber: number
  totalChunks: number
  streamingMessage: any
  member?: user
  guest?: guest
  thread: thread & {
    user: user | null
    guest: guest | null
    collaborations?: {
      collaboration: collaboration
      user: user
    }[]
  }
  clientId?: string
  streamId?: string
}) {
  console.log(
    `📤 Sending chunk ${chunkNumber}/${totalChunks}:`,
    chunk.substring(0, 20) + "...",
  )

  // Send lightweight notification - only metadata, NOT full content
  // This prevents 413 Payload Too Large errors

  thread &&
    notifyOwnerAndCollaborations({
      notifySender: true,
      thread,
      payload: {
        type: "stream_chunk",
        data: {
          message: {
            ...streamingMessage,
            message: {
              ...streamingMessage.message,
              content: "",
            },
          },
          chunk,
          isFinal: false,
          clientId,
          streamId,
        },
      },
      member,
      guest,
    })

  // Add delay between chunks for proper delivery order
  await wait(30)
}

/**
 * Get news context based on app name
 * - CNN agent → Only CNN news
 * - Bloomberg agent → Only Bloomberg news
 * - Generic agents → All news sources
 */
async function getNewsContext(slug?: string | null): Promise<string> {
  try {
    let news

    // Map app names to news sources
    const sourceMap: Record<string, string> = {
      cnn: "cnn",
      bloomberg: "bloomberg",
      nyt: "nyt",
      techcrunch: "techcrunch",
    }

    const appLower = slug?.toLowerCase()
    const source = appLower ? sourceMap[appLower] : null

    if (source) {
      // Branded agent → Lots of their news (user wants this!)
      news = await getNewsBySource(source, 20)
    } else {
      // Generic agent → Just top headlines (supplementary context)
      news = await getLatestNews(5)
    }

    if (!news || news.length === 0) {
      return ""
    }

    // Format news for context
    const newsContext = news
      .map(
        (article, i) =>
          `${i + 1}. ${article.title}\n   Source: ${article.source.toUpperCase()}\n   Published: ${new Date(article.publishedAt).toLocaleDateString()}\n   ${article.description || ""}`,
      )
      .join("\n\n")

    const today = new Date().toLocaleDateString()
    return `\n\n## Recent News Context (Last 7 Days):\nToday's date: ${today}\n\n${newsContext}\n\nIMPORTANT: These are RECENT news articles (published within the last 7 days). When referencing them, use present tense or recent past tense (e.g., "According to recent reports..." or "Today, CNN reports..."). Always cite the source and check the published date.`
  } catch (error) {
    console.error("Error fetching news context:", error)
    return ""
  }
}

/**
 * Get intro message for first message in conversation
 */
function getIntroMessage(app: any, language: string): string {
  if (!app) {
    return `"I'm Vex, your personal AI assistant! 🥰 I'm here to help you get things done faster—whether it's answering questions, handling files, or collaborating with teammates. How can I assist you today?"`
  }

  const intros: Record<string, string> = {
    Atlas: `"I'm Atlas, your travel companion! ✈️ I can help you plan trips, find flights, book hotels, and discover amazing destinations. Where would you like to go?"`,
    Bloom: `"I'm Bloom, your wellness coach! 🌸 I can help you track fitness, plan meals, monitor health, and build sustainable habits. What are your wellness goals?"`,
    Peach: `"I'm Peach, your social connection assistant! 🍑 I can help you find like-minded people, plan activities, and build meaningful relationships. How can I help you connect?"`,
    Vault: `"I'm Vault, your finance advisor! 💰 I can help you track spending, create budgets, understand investments, and achieve financial goals. What would you like to work on?"`,
  }

  return intros[app.name] || `"I'm ${app.name}! How can I help you today?"`
}

/**
 * Render system prompt template with Handlebars
 */
function renderSystemPrompt(params: {
  template: string
  app: app | null | undefined
  appKnowledge: any
  userName?: string
  language: string
  isFirstMessage: boolean
  isSpeechActive: boolean
  timezone: string
  weather: any
  location?: { city?: string | null; country?: string | null }
  threadInstructions?: string
}): string {
  const {
    template,
    app,
    appKnowledge,
    userName,
    language,
    isFirstMessage,
    isSpeechActive,
    timezone,
    weather,
    location,
    threadInstructions,
  } = params

  try {
    // Compile template
    const compiledTemplate = Handlebars.compile(template)

    // Prepare weather data with age calculation
    const weatherData = weather
      ? {
          location: weather.location,
          country: weather.country,
          temperature: weather.temperature,
          condition: weather.condition,
          weatherAge: (() => {
            const minutesAgo = Math.round(
              (Date.now() - new Date(weather.lastUpdated).getTime()) /
                (1000 * 60),
            )
            if (minutesAgo < 15) return `${minutesAgo} minutes ago (current)`
            if (minutesAgo < 60)
              return `${minutesAgo} minutes ago (recent, may have changed)`
            return `${Math.round(minutesAgo / 60)} hours ago (outdated - suggest checking latest forecast if discussing weather)`
          })(),
        }
      : null

    // Render template with data
    return compiledTemplate({
      app: {
        name: app?.name || "Vex",
        title: app?.title,
        description: app?.description,
        highlights: app?.highlights,
      },
      appKnowledgeBase: !!(
        appKnowledge &&
        (appKnowledge.messages?.length > 0 ||
          appKnowledge.memories?.length > 0 ||
          appKnowledge.instructions ||
          appKnowledge.artifacts?.length > 0)
      ),
      appKnowledge: appKnowledge
        ? {
            instructions: appKnowledge.instructions,
            artifacts: appKnowledge.artifacts
              ?.slice(0, 25)
              .map((artifact: any, i: number) => ({
                name: artifact.name,
                type: artifact.type,
              })),
            memories: appKnowledge.memories?.slice(0, 10).map((mem: any) => ({
              appName: mem.appName,
              content: mem.content,
            })),
            messages: appKnowledge.messages?.slice(-10).map((msg: any) => ({
              role: msg.role,
              content:
                msg.content?.substring(0, 120) +
                (msg.content?.length > 120 ? "..." : ""),
            })),
          }
        : null,
      user: userName ? { name: userName } : null,
      language,
      introMessage: getIntroMessage(app, language),
      isFirstMessage,
      isSpeechActive,
      timezone,
      weather: weatherData,
      location,
      threadInstructions,
    })
  } catch (error) {
    // Log the template error but don't crash
    console.error("❌ Template rendering error:", error)
    console.error("Template content:", template?.substring(0, 200))

    // Fallback to a basic system prompt
    const appName = app?.name || "Vex"
    const appTitle = app?.title || "AI Assistant"
    const appDesc =
      app?.description || "I help users accomplish their goals efficiently."

    // Extract error details for user-friendly message
    const errorMessage = error instanceof Error ? error.message : String(error)
    const lineMatch = errorMessage.match(/line (\d+)/i)
    const lineNumber = lineMatch ? lineMatch[1] : "unknown"

    // Try to extract the problematic part from the error message
    let problematicPart = ""
    if (errorMessage.includes("Parse error")) {
      const snippetMatch = errorMessage.match(/\.\.\.(.+?)\.\.\./)
      problematicPart = snippetMatch ? ` near "${snippetMatch[1]}"` : ""
    }

    // Add a note to inform the user about the template issue
    const templateErrorNote = `\n\n⚠️ Note: There was an issue loading the custom system prompt template (error on line ${lineNumber}${problematicPart}). Using a basic fallback prompt instead. The app creator should review the template syntax.`

    return `You are ${appName}, ${appTitle}. ${appDesc}

${userName ? `The user's name is ${userName}.` : ""}
${language !== "en" ? `Respond in ${language}.` : ""}
${timezone ? `User timezone: ${timezone}` : ""}
${location?.city ? `User location: ${location.city}${location.country ? `, ${location.country}` : ""}` : ""}
${weather ? `Current weather: ${weather.temperature}°C, ${weather.condition}` : ""}
${threadInstructions ? `\n## Thread Instructions:\n${threadInstructions}` : ""}

Be helpful, concise, and friendly.${templateErrorNote}`
  }
}

export async function POST(request: Request) {
  console.time("messageProcessing")

  const member = await getMember(true)
  const guest = member ? undefined : await getGuest()

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

  // Check if request contains files (multipart/form-data) or JSON
  const contentType = request.headers.get("content-type") || ""
  let requestData: any
  let files: File[] = []

  if (contentType.includes("multipart/form-data")) {
    // Handle file uploads
    const formData = (await request.formData()) as unknown as FormData
    requestData = {
      appId: formData.get("appId") as string,
      slug: formData.get("slug") as string,
      selectedAgentId: (formData.get("selectedAgentId") as string) || "",
      pauseDebate: formData.get("pauseDebate") === "true",
      debateAgentId: (formData.get("debateAgentId") as string) || "",
      appPart: formData.get("appPart") as string,
      agentId: (formData.get("agentId") as string) || "",
      messageId: (formData.get("messageId") as string) || "",
      language: (formData.get("language") as string) || "en",
      webSearchEnabled: formData.get("webSearchEnabled") === "true",
      actionEnabled: formData.get("actionEnabled") === "true",
      imageGenerationEnabled: formData.get("imageGenerationEnabled") === "true",
      stopStreamId: (formData.get("stopStreamId") as string) || "",
      isSpeechActive: formData.get("isSpeechActive") === "true",
      weather: formData.get("weather")
        ? JSON.parse(formData.get("weather") as string)
        : null,
      draft: formData.get("draft")
        ? JSON.parse(formData.get("draft") as string)
        : null,
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

  const {
    agentId,
    messageId,
    language = "en",
    imageGenerationEnabled,
    pauseDebate,
    stopStreamId,
    selectedAgentId,
    isSpeechActive,
    weather,
    slug,
    ...rest
  } = requestData

  const draft = rest.draft as appFormData & {
    canSubmit?: boolean
  }

  const app = rest.appId
    ? await getPureApp({ id: rest.appId })
    : slug
      ? await getPureApp({ slug, isSafe: false })
      : undefined

  const isAppOwner =
    app && isOwner(app, { userId: member?.id, guestId: guest?.id })

  // Recursively build knowledge base from app.extends chain (max 5 levels)
  const buildAppKnowledgeBase = async (
    currentApp: typeof app,
    depth = 0,
  ): Promise<{
    messages: (typeof message)[]
    memories: memory[]
    instructions: string
    artifacts: any[]
  }> => {
    if (!currentApp || depth >= 5) {
      return { messages: [], memories: [], instructions: "", artifacts: [] }
    }

    // Get main thread for current app
    const thread = await getThread({
      appId: currentApp.id,
      isMainThread: true,
    })

    // Auto-set main thread if owner and not set
    const hasMainThread = isAppOwner && !!currentApp.mainThreadId

    // Detect if this is the first message after app creation (just saved)
    const isFirstThreadAfterAppCreation = isAppOwner && !hasMainThread && thread

    if (isFirstThreadAfterAppCreation && currentApp) {
      try {
        await updateThread({
          ...thread,
          isMainThread: true,
        })
        await updateApp({
          ...currentApp,
          mainThreadId: thread.id,
        })
      } catch (error) {
        captureException(error)
      }
    }

    // Get thread data
    const messagesData = thread
      ? await getMessages({ threadId: thread.id, pageSize: 20 })
      : null

    const messages = Array.isArray(messagesData)
      ? messagesData
      : messagesData?.messages || []

    // Only main app (depth 0) provides instructions and artifacts
    const instructions = depth === 0 ? thread?.instructions || "" : ""
    const artifacts = depth === 0 ? thread?.artifacts || [] : []

    // Get memories from thread summary
    const memories =
      thread?.summary?.userMemories?.slice(0, 5).map((m: any) => ({
        content: m.content || m, // Handle both object and string formats
        appName: currentApp.name,
        tags: m.tags || [],
        relevanceScore: m.relevanceScore || 0,
      })) || []

    // Recursively get parent apps knowledge if extend exists (array of parent IDs)
    let parentKnowledge = {
      messages: [] as any[],
      memories: [] as any[],
      instructions: "",
      artifacts: [] as any[],
    }

    if (
      currentApp.extend &&
      Array.isArray(currentApp.extend) &&
      currentApp.extend.length > 0
    ) {
      // Get knowledge from all parent apps (up to 5 total in chain)
      for (const parentId of currentApp.extend.slice(0, 5 - depth)) {
        const parentApp = await getPureApp({ id: parentId })
        if (parentApp) {
          const parentData = await buildAppKnowledgeBase(parentApp, depth + 1)
          parentKnowledge.messages.push(...parentData.messages)
          parentKnowledge.memories.push(...parentData.memories)
          parentKnowledge.instructions =
            parentKnowledge.instructions || parentData.instructions
          parentKnowledge.artifacts.push(...parentData.artifacts)
        }
      }
    }

    // Merge current and parent knowledge
    return {
      messages: [...messages, ...parentKnowledge.messages],
      memories: [...memories, ...parentKnowledge.memories],
      instructions: instructions || parentKnowledge.instructions,
      artifacts: [...artifacts, ...parentKnowledge.artifacts],
    }
  }

  const appKnowledge = app ? await buildAppKnowledgeBase(app) : null

  const appId = app?.id || null

  console.log("📝 Request data:", {
    agentId,
    messageId,
    language,
    filesCount: files.length,
    fileTypes: files.map((f) => f.type),
    pauseDebate,
    selectedAgentId,
    stopStreamId,
  })

  const timezone = member?.timezone || guest?.timezone

  // Get message and thread for instructions
  const message = await getMessage({
    id: messageId,
    userId: member?.id,
    guestId: guest?.id,
  })

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 })
  }

  const content = message.message.content
  const threadId = message.message.threadId

  const thread = await getThread({ id: message.message.threadId })

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 })
  }

  // Get placeholder context for AI awareness
  const homePlaceholder = await getPlaceHolder({
    userId: member?.id,
    guestId: guest?.id,
  })

  const threadPlaceholder = await getPlaceHolder({
    threadId: thread.id,
    userId: member?.id,
    guestId: guest?.id,
  })

  const agent = await getAiAgent({ id: agentId })

  if (stopStreamId && agent) {
    if (
      !isOwner(message?.message, { userId: member?.id, guestId: guest?.id })
    ) {
      return NextResponse.json(
        { error: "You don't have permission to stop this stream" },
        { status: 403 },
      )
    }

    const controller = streamControllers.get(stopStreamId)

    if (controller) {
      try {
        controller.close() // Close the stream
      } catch (error) {
        // Stream might already be closed
        console.log("Stream already closed or errored")
      }
      streamControllers.delete(stopStreamId) // Remove from map

      logCreditUsage({
        appId: app?.id,
        userId: member?.id,
        guestId: guest?.id,
        creditCost: message.message.creditCost * agent.creditCost,
        messageType: "ai",
        agentId,
        messageId: message.message.id,
      })
    }

    return NextResponse.json({ success: true, message: message.message })
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

  const streamId = uuidv4()

  let response: NextResponse | undefined

  const debateAgentId = message.message.debateAgentId

  const debateAgent = debateAgentId
    ? await getAiAgent({ id: debateAgentId })
    : undefined

  if (debateAgentId && !debateAgent) {
    return NextResponse.json(
      { error: "Debate agent not found" },
      { status: 404 },
    )
  }

  const selectedAgent = message.message.selectedAgentId
    ? await getAiAgent({ id: message.message.selectedAgentId })
    : undefined

  const clientId = message.message.clientId

  const threadInstructions = thread?.instructions

  const getLocationContext = (
    city?: string | null,
    country?: string | null,
  ) => {
    if (!city && !country) return ""

    const location = city && country ? `${city}, ${country}` : city || country

    return `
    - User location: ${location}
    - When providing local information (restaurants, events, services, laws, regulations), prioritize ${location}-specific results
    - For time-sensitive queries, consider local business hours and cultural context in ${location}
    - When suggesting activities or services, focus on what's available locally in ${location}
    - If asked about local regulations, laws, or procedures, specify that information is for ${location} and may vary by jurisdiction`
  }

  const memoriesEnabled = (member || guest)?.memoriesEnabled || isAppOwner
  const characterProfilesEnabled =
    (member || guest)?.characterProfilesEnabled || isAppOwner

  // Feature status context for AI
  const featureStatusContext = `

## USER'S PERSONALIZATION FEATURES STATUS:

${
  memoriesEnabled
    ? `
✅ **Cross-Conversation Memory: ENABLED**
- You have access to memories from past conversations
- You can reference what the user has shared before
- Memories are automatically extracted and saved
- Use this to provide personalized, context-aware responses
`
    : `
❌ **Cross-Conversation Memory: DISABLED**
- User has disabled memory features
- You only have context from the current conversation
- DO NOT reference past conversations or claim to remember anything
- If user asks about personalization, explain: "You have memory features disabled. Enable them in settings to let me remember our conversations and provide more personalized assistance!"
`
}

${
  characterProfilesEnabled
    ? `
✅ **Character Profiling: ENABLED**
- The system analyzes user's communication style and preferences
- Character profiles help personalize future interactions
- Profiles are generated automatically from conversations
`
    : `
❌ **Character Profiling: DISABLED**
- User has disabled character profiling
- No personality analysis is being performed
- If user asks about profiles, explain: "Character profiling is disabled. Enable it in settings to let me analyze your communication style and create personalized AI profiles!"
`
}

${
  !memoriesEnabled && !characterProfilesEnabled
    ? `
💡 **SUGGESTION FOR USER:**
If user seems interested in personalization, you can mention:
"I notice you have memory and character profiling disabled. Enabling these features would allow me to:
- Remember our past conversations across all threads
- Understand your preferences and communication style
- Provide more personalized and context-aware assistance
- Generate custom AI instruction templates tailored to you

You can enable these in your settings anytime!"
`
    : ""
}
`

  // Fetch thread messages first (needed to determine if first message)
  const threadMessages = await getMessages({
    pageSize: message.message.isWebSearchEnabled ? 30 : 100, // More context since memories are scattered
    threadId: message.message.threadId,
    userId: member?.id,
    guestId: guest?.id,
  })

  // Get system prompt template from database (or use default Vex template)
  // If no app, fetch the default Vex app from database
  const defaultVexApp = !app
    ? await getPureApp({ slug: "vex", isSafe: false })
    : null
  const templateSource = app?.systemPrompt || defaultVexApp?.systemPrompt

  // If no template in database, use fallback
  const fallbackTemplate = `You are {{app.name}}{{#if app.title}}, {{app.title}}{{/if}}{{#if app.description}}. {{app.description}}{{/if}}

{{#if app.highlights}}
## 🎯 YOUR CORE CAPABILITIES:
{{#each app.highlights}}
{{this.emoji}} **{{this.title}}**: {{this.content}}
{{/each}}

**IMPORTANT**: When users ask what you can do or who you are, reference these specific capabilities instead of giving generic responses. Show them the concrete features and value you provide!
{{/if}}

{{#if app.tips}}
## 💡 {{app.tipsTitle}}:
{{#each app.tips}}
{{this.emoji}} {{this.content}}
{{/each}}

**USE THESE TIPS**: When appropriate, share these helpful tips with users to guide them on how to get the most value from this app. Don't dump all tips at once - mention them naturally when relevant to the conversation.
{{/if}}

{{#if threadInstructions}}
## ⚠️ PRIORITY: CUSTOM INSTRUCTIONS FOR THIS CHAT

**CRITICAL**: The user has provided specific instructions for this conversation. These instructions take ABSOLUTE PRIORITY over all default behaviors, including introductions and greetings.

{{threadInstructions}}

**YOU MUST:**
- Follow these instructions from the very first message
- Skip generic introductions if instructions specify a task or role
- Respond according to the instructions immediately, not after introducing yourself
- Treat these instructions as your primary directive for this entire conversation

{{/if}}

{{#if user.name}}
- The user's name is {{user.name}}. Address them personally when appropriate.
{{/if}}

- You are helpful, friendly, and concise.
- You can handle text, images, and files with multimodal capabilities.
- You support real-time collaboration - users can work with teammates in shared conversations.

{{#if isFirstMessage}}
{{#unless threadInstructions}}
- For the FIRST message in a new conversation, introduce yourself in {{language}}: {{introMessage}}
{{#if app.highlights}}
- After introducing yourself, briefly mention 2-3 of your key capabilities from the list above to show users what you can help them with.
{{/if}}
{{/unless}}
{{#if threadInstructions}}
- This is the first message, but the user has provided custom instructions. Follow those instructions immediately instead of introducing yourself.
{{/if}}
{{else}}
- In subsequent responses, don't introduce yourself again.
{{/if}}

- User prefers {{language}} as their primary language.
- Timezone: {{timezone}}`

  const userName = (member as any)?.name || (guest as any)?.name

  // Render system prompt using Handlebars template
  const baseSystemPrompt = renderSystemPrompt({
    template: templateSource || fallbackTemplate,
    app: app || defaultVexApp,
    appKnowledge,
    userName,
    language,
    isFirstMessage: threadMessages.messages.length === 0,
    isSpeechActive,
    timezone: timezone || "UTC",
    weather,
    location:
      member?.city || guest?.city
        ? {
            city: member?.city || guest?.city,
            country: member?.country || guest?.country,
          }
        : undefined,
    threadInstructions: threadInstructions || undefined,
  })

  // Get relevant memory context for personalization
  // Dynamic sizing: short threads need MORE memories, long threads need FEWER
  const memoryPageSize = (() => {
    const messageCount = threadMessages.messages.length

    if (messageCount <= 5) return 25 // New thread - load lots of diverse context
    if (messageCount <= 15) return 20 // Growing thread - moderate context
    if (messageCount <= 30) return 15 // Established thread - balanced
    if (messageCount <= 50) return 12 // Long thread - some context
    if (messageCount <= 75) return 8 // Very long - minimal context
    return 5 // Extremely long - just essentials
  })()

  const { context: memoryContext, memoryIds } = await getRelevantMemoryContext({
    userId: member?.id,
    guestId: guest?.id,
    appId: app?.id,
    pageSize: memoryPageSize,
    threadId: message.message.threadId, // Pass current thread to exclude
  })

  // Add placeholder context for AI awareness
  const placeholderContext =
    homePlaceholder || threadPlaceholder
      ? `

## PERSONALIZED CONVERSATION STARTERS:
You recently generated these personalized suggestions for the user:
${homePlaceholder ? `- Home placeholder: "${homePlaceholder.text}"` : ""}
${threadPlaceholder ? `- Thread placeholder: "${threadPlaceholder.text}"` : ""}

These reflect the user's interests and recent conversations. If the user seems uncertain about what to discuss or asks for suggestions, you can naturally reference these topics. Be conversational about it - don't just list them, weave them into your response naturally.
`
      : ""

  // Fetch calendar events for context (past 7 days + next 30 days)
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const calendarEvents = await getCalendarEvents({
    userId: member?.id,
    guestId: guest?.id,
    startTime: sevenDaysAgo,
    endTime: thirtyDaysFromNow,
  })

  // Fetch Vault data for context (expenses, budgets, shared expenses)
  const { getExpenses, getBudgets, getSharedExpenses } = await import(
    "@repo/db"
  )

  const vaultExpenses =
    app?.name === "Vault"
      ? await getExpenses({
          userId: member?.id,
          guestId: guest?.id,
          pageSize: 50, // Last 50 expenses
        })
      : null

  const vaultBudgets =
    app?.name === "Vault"
      ? await getBudgets({
          userId: member?.id,
          guestId: guest?.id,
        })
      : null

  const vaultSharedExpenses =
    app?.name === "Vault"
      ? await getSharedExpenses({
          threadId: message.message.threadId,
        })
      : null

  // Build calendar context (limit to 15 most relevant events)
  const calendarContext =
    calendarEvents && calendarEvents.length > 0
      ? `

## 📅 User's Calendar Events

You have access to the user's calendar. Here are their upcoming and recent events:

${calendarEvents
  .slice(0, 15)
  .map((event) => {
    const start = new Date(event.startTime)
    const end = new Date(event.endTime)
    const isPast = start < now
    const isToday = start.toDateString() === now.toDateString()
    const isTomorrow =
      start.toDateString() ===
      new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString()

    let timeLabel = isPast
      ? "(Past)"
      : isToday
        ? "(Today)"
        : isTomorrow
          ? "(Tomorrow)"
          : ""

    return `- **${event.title}** ${timeLabel}
  ${event.isAllDay ? "All day" : `${start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
  ${start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
  ${event.location ? `📍 ${event.location}` : ""}
  ${event.description ? `📝 ${event.description.slice(0, 100)}${event.description.length > 100 ? "..." : ""}` : ""}`
  })
  .join("\n\n")}

${calendarEvents.length > 15 ? `\n...and ${calendarEvents.length - 15} more events` : ""}

**How to use calendar context:**
- Help users remember upcoming events when relevant
- Suggest scheduling around their calendar
- Remind them of conflicts when they mention plans
- Be proactive but not pushy about their schedule
- Reference specific events naturally in conversation

Example: "I see you have a meeting with the Tokyo team tomorrow at 2 PM. Would you like to prepare anything for that?"
`
      : ""

  // Build Vault context (expenses, budgets, shared expenses)
  const vaultContext =
    app?.name === "Vault" &&
    (vaultExpenses?.expenses.length ||
      vaultBudgets?.budgets.length ||
      vaultSharedExpenses?.sharedExpenses.length)
      ? `

## 💰 User's Financial Overview

${
  vaultExpenses?.expenses.length
    ? `### Recent Expenses (Last ${vaultExpenses.expenses.length})
${vaultExpenses.expenses
  .slice(0, 10)
  .map((exp) => {
    const amount = (exp.amount / 100).toFixed(2)
    const date = new Date(exp.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
    return `- **$${amount}** - ${exp.description} (${exp.category}) - ${date}`
  })
  .join("\n")}
${vaultExpenses.expenses.length > 10 ? `\n...and ${vaultExpenses.expenses.length - 10} more expenses` : ""}

**Total spent**: $${(vaultExpenses.expenses.reduce((sum, e) => sum + e.amount, 0) / 100).toFixed(2)}
`
    : ""
}

${
  vaultBudgets?.budgets.length
    ? `### Active Budgets
${vaultBudgets.budgets
  .map((budget) => {
    const budgetAmount = (budget.amount / 100).toFixed(2)
    // Calculate spending for this category
    const categorySpending =
      vaultExpenses?.expenses
        .filter((e) => e.category === budget.category)
        .reduce((sum, e) => sum + e.amount, 0) || 0
    const spent = (categorySpending / 100).toFixed(2)
    const remaining = ((budget.amount - categorySpending) / 100).toFixed(2)
    const percentUsed = ((categorySpending / budget.amount) * 100).toFixed(0)
    const status =
      categorySpending > budget.amount
        ? "⚠️ OVER"
        : Number(percentUsed) > 80
          ? "⚡ HIGH"
          : "✅ OK"

    return `- **${budget.category}**: $${spent}/$${budgetAmount} (${percentUsed}% used) ${status}
  Remaining: $${remaining}`
  })
  .join("\n")}
`
    : ""
}

${
  vaultSharedExpenses?.sharedExpenses.length
    ? `### Shared Expenses (This Conversation)
${vaultSharedExpenses.sharedExpenses
  .map((se) => {
    const paidCount = se.splits.filter((s) => s.paid).length
    const unpaidCount = se.splits.filter((s) => !s.paid).length
    const totalOwed = se.splits
      .filter((s) => !s.paid)
      .reduce((sum, s) => sum + s.amount, 0)
    const totalPaid = se.splits
      .filter((s) => s.paid)
      .reduce((sum, s) => sum + s.amount, 0)

    return `- **Shared Expense** (${se.splits.length} splits)
  Paid: ${paidCount} people ($${(totalPaid / 100).toFixed(2)})
  Unpaid: ${unpaidCount} people ($${(totalOwed / 100).toFixed(2)})`
  })
  .join("\n")}
`
    : ""
}

**How to use financial context:**
- Reference spending patterns when relevant ("I see you've been spending a lot on dining out")
- Warn about budget overages proactively
- Suggest budget adjustments based on actual spending
- Remind about outstanding shared expenses
- Be helpful but not judgmental about spending habits
`
      : ""

  // Get news context based on app
  const newsContext = await getNewsContext(slug)

  // Get brand-specific knowledge base (dynamic RAG or hardcoded fallback)
  const brandKnowledge = await getAppKnowledge(
    app || null,
    slug,
    "", // Query will be used for semantic search if RAG is enabled
  )

  // Check if this is the first message in the app's main thread (user just started using their new app)
  const hasMainThread = isAppOwner && !!app?.mainThreadId
  const isFirstAppMessage =
    app && isAppOwner && !hasMainThread && appKnowledge?.messages.length === 0

  // AI Coach Context - Guide users through app creation OR first-time app usage
  let aiCoachContext = ""

  if (isFirstAppMessage) {
    aiCoachContext = `
## 🎉 First Time Using Your App!

This is the **first message** in your newly created app "${app.name}"! 

**Welcome Guide:**
- This conversation will become your app's **main thread** - the knowledge base for how this app works
- Everything you discuss here will help train and improve this app's behavior
- Future users (or you in other threads) will benefit from the context built here
- Consider this conversation as "teaching" your app its purpose and capabilities

**Suggested First Steps:**
1. **Test the core functionality** - Try the main features you designed
2. **Refine the behavior** - If responses aren't quite right, guide the app with examples
3. **Build context** - Share relevant information that will help the app serve its purpose
4. **Create artifacts** - Generate any templates, code, or documents this app should remember

**Remember:** This main thread is special - it's the "DNA" of your app. Make it count! 🚀

Now, how can I help you get started with ${app.name}?
`
  } else if (draft) {
    const isNewApp = !draft.id
    const isUpdate = !!draft.id
    const hasName = !!draft.name
    const hasTitle = !!draft.title
    const hasHighlights = draft?.highlights && draft.highlights.length > 0
    const hasSystemPrompt = !!draft?.systemPrompt
    const hasTools = draft?.tools && draft.tools.length > 0
    const hasExtends = draft?.extends && draft.extends.length > 0
    const hasDescription = !!draft?.description
    const hasThemeColor = !!draft?.themeColor
    const hasImage = !!draft?.image

    // Check if app was just saved (has ID and all required fields)
    const wasJustSaved = draft?.id && hasName && hasTitle && draft?.canSubmit

    // Check if ready to save
    const isReadyToSave = hasName && hasTitle && draft?.canSubmit

    // Detect missing recommended items
    const missingRecommended = []
    if (!hasSystemPrompt) missingRecommended.push("System Prompt")
    if (!hasHighlights || (draft?.highlights && draft?.highlights?.length < 3))
      missingRecommended.push("More suggestions (3-5 recommended)")
    if (!hasTools)
      missingRecommended.push("Tools (calendar, location, weather)")
    if (!hasDescription) missingRecommended.push("Description")
    if (!hasThemeColor) missingRecommended.push("Theme color")

    // Publishing-specific recommendations (not required for saving, but important for public apps)
    const publishingRecommendations = []
    if (!hasImage && draft?.visibility === "public")
      publishingRecommendations.push(
        "App image/logo (500x500px PNG recommended for professional appearance)",
      )

    // Template detection - check if highlights use any template variables
    const templatePatterns = {
      location: ["{{city}}", "{{country}}", "{{location}}"],
      weather: ["{{weather}}", "{{temp}}", "{{temperature}}"],
      calendar: ["{{date}}", "{{time}}", "{{event}}"],
    }

    const usesLocationTemplates = draft.highlights?.some((h: any) =>
      templatePatterns.location.some((pattern) =>
        h.description?.includes(pattern),
      ),
    )
    const usesWeatherTemplates = draft.highlights?.some((h: any) =>
      templatePatterns.weather.some((pattern) =>
        h.description?.includes(pattern),
      ),
    )
    const usesCalendarTemplates = draft.highlights?.some((h: any) =>
      templatePatterns.calendar.some((pattern) =>
        h.description?.includes(pattern),
      ),
    )

    // Base app knowledge - what each base app is for and what tools they need
    const baseAppRecommendations: Record<
      string,
      { description: string; tools: string[]; systemPromptHint?: string }
    > = {
      Atlas: {
        description: "location and travel app",
        tools: ["location", "weather"],
      },
      Vault: {
        description: "finance and expense tracking app",
        tools: ["calendar"],
      },
      Peach: {
        description: "dating and social connection app",
        tools: ["location"],
      },
      Bloom: {
        description: "wellness and mental health app",
        tools: ["calendar"],
        systemPromptHint: "supportive, encouraging, and empathetic",
      },
    }

    // Generate smart recommendations based on configuration
    const smartRecommendations: string[] = []

    // Template-based recommendations
    if (usesLocationTemplates && !draft.tools?.includes("location")) {
      smartRecommendations.push(
        "💡 I notice suggestions use location templates ({{city}}, {{location}}) - recommend enabling Location tool!",
      )
    }
    if (usesWeatherTemplates && !draft.tools?.includes("weather")) {
      smartRecommendations.push(
        "💡 I notice suggestions use weather templates ({{weather}}, {{temp}}) - recommend enabling Weather tool!",
      )
    }
    if (usesCalendarTemplates && !draft.tools?.includes("calendar")) {
      smartRecommendations.push(
        "💡 I notice suggestions use calendar templates ({{date}}, {{time}}) - recommend enabling Calendar tool!",
      )
    }

    // Base app extension recommendations
    draft.extends?.forEach((baseApp: string) => {
      const appConfig = baseAppRecommendations[baseApp]
      if (appConfig) {
        // Check for missing tools
        const missingTools = appConfig.tools.filter(
          (tool) => !draft.tools?.includes(tool),
        )
        if (missingTools.length > 0 && hasTools) {
          smartRecommendations.push(
            `💡 Since extending ${baseApp} (${appConfig.description}), recommend enabling ${missingTools.join(" + ")} tool${missingTools.length > 1 ? "s" : ""}!`,
          )
        } else if (missingTools.length > 0 && !hasTools) {
          smartRecommendations.push(
            `💡 Since extending ${baseApp} (${appConfig.description}), recommend enabling ${appConfig.tools.join(" + ")} tools!`,
          )
        }

        // System prompt hint
        if (appConfig.systemPromptHint && !hasSystemPrompt) {
          smartRecommendations.push(
            `💡 Since extending ${baseApp} (${appConfig.description}), create a ${appConfig.systemPromptHint} system prompt!`,
          )
        }
      }
    })

    // Model-specific recommendations
    if (draft.defaultModel === "claude" && !hasSystemPrompt) {
      smartRecommendations.push(
        "💡 Claude works best with detailed system prompts - suggest creating one!",
      )
    }
    if (
      draft?.defaultModel === "gemini" &&
      draft?.temperature &&
      draft.temperature < 0.7
    ) {
      smartRecommendations.push(
        "💡 Gemini performs better with temperature 0.7+ for creative responses!",
      )
    }
    if (draft.defaultModel === "perplexity") {
      smartRecommendations.push(
        "⚠️ WARNING: Perplexity ALWAYS tries web search first, even for simple questions. Only use for apps that need real-time web data. For general conversation, use ChatGPT or Claude instead!",
      )
    }

    // Capability-based recommendations
    const capabilityHighlightMap: Record<
      string,
      { keywords: string[]; suggestion: string }
    > = {
      imageGeneration: {
        keywords: ["image", "generate", "create", "draw"],
        suggestion:
          "💡 Image generation is enabled - suggest adding a highlight like 'Generate images' to showcase this!",
      },
      webSearch: {
        keywords: ["search", "find", "lookup", "browse"],
        suggestion:
          "💡 Web search is enabled - add a highlight like 'Search the web' to showcase this!",
      },
      codeExecution: {
        keywords: ["code", "run", "execute", "program"],
        suggestion:
          "💡 Code execution is enabled - add a highlight like 'Run code' to showcase this!",
      },
    }

    Object.entries(capabilityHighlightMap).forEach(([capability, config]) => {
      if (draft.capabilities?.[capability as keyof typeof draft.capabilities]) {
        const hasRelatedHighlight = draft.highlights?.some((h: any) =>
          config.keywords.some(
            (keyword) =>
              h.title?.toLowerCase().includes(keyword) ||
              h.description?.toLowerCase().includes(keyword),
          ),
        )
        if (!hasRelatedHighlight) {
          smartRecommendations.push(config.suggestion)
        }
      }
    })

    // Image recommendations
    if (!hasImage && draft?.visibility === "public") {
      smartRecommendations.push(
        "📸 PUBLISHING TIP: Add an app image/logo (500x500px PNG) for professional appearance in the app store! You can upload an image in chat and I'll analyze it to ensure it meets requirements.",
      )
    } else if (hasImage && draft?.visibility === "public") {
      smartRecommendations.push(
        "✅ Great! You have an app image. Make sure it's 500x500px PNG for best quality!",
      )
    } else if (!hasImage && draft?.visibility === "private") {
      smartRecommendations.push(
        "💡 App image not required for private apps, but you can add one later when you're ready to publish!",
      )
    }

    // Quality recommendations
    if (
      hasHighlights &&
      draft.highlights?.length &&
      draft.highlights.length > 5
    ) {
      smartRecommendations.push(
        `⚠️ You have ${draft.highlights.length} suggestions - consider keeping only the best 3-5 for clarity!`,
      )
    }
    if (
      hasSystemPrompt &&
      draft.systemPrompt?.length &&
      draft.systemPrompt.length < 100
    ) {
      smartRecommendations.push(
        `⚠️ System prompt is quite short (${draft.systemPrompt.length} chars) - consider adding more detail about personality, approach, and boundaries!`,
      )
    }
    if (!draft?.tone && hasSystemPrompt) {
      smartRecommendations.push(
        "💡 Set a tone (professional/casual/friendly/technical/creative) to match your system prompt!",
      )
    }
    if (!draft?.temperature && hasSystemPrompt) {
      smartRecommendations.push(
        "💡 Set temperature (0=focused, 2=creative) to control response style!",
      )
    }

    aiCoachContext = `

🎯 APP ${isUpdate ? "UPDATE" : "CREATION"} COACH MODE ACTIVE

${
  wasJustSaved
    ? `
✅ APP SUCCESSFULLY SAVED!

The user just saved their app "${draft.name}" (ID: ${draft.id}). The app is now live and ready to use!

YOUR RESPONSE SHOULD:
1. **Congratulate them** on creating/updating their app 🎉
2. **Summarize what they built** - highlight key features they configured
3. **Explain what the app does** - based on their title, system prompt, and suggestions
4. **Next steps** - suggest trying it out, sharing it, or adding more features
5. **Be enthusiastic and supportive** - this is a big accomplishment!

DO NOT suggest saving the app again - it's already saved!
`
    : `You are helping the user ${isNewApp ? "create a new app" : `update their existing app`}${draft.name ? ` called "${draft.name}"` : ""}.

${
  isUpdate
    ? `
⚠️ UPDATE MODE: This app already exists. You're helping improve it.
- Be careful about major changes (name, base model)
- Suggest enhancements and optimizations
- Review what's working vs what could be better
- Recommend A/B testing for significant changes
`
    : ""
}`
}

CURRENT APP STATE:
${isNewApp ? "✨ Creating new app" : `📝 Updating existing app (ID: ${draft.id})`}
${hasName ? `✅ Name: "${draft.name}" (${draft.name.length}/10 characters)` : "❌ Name: Not set (required, 3-10 characters)"}
${hasTitle ? `✅ Title: "${draft.title}" (${draft.title.length}/30 characters)` : "❌ Title: Not set (required, max 30 characters)"}
${hasDescription ? `✅ Description: Set (${draft.description?.length}/500 characters)` : "⚠️ Description: Not set (recommended for discoverability)"}
${hasHighlights ? `✅ Suggestions: ${draft.highlights?.length} added${draft.highlights?.length && draft.highlights?.length < 3 ? " (recommend 3-5)" : draft.highlights?.length && draft.highlights?.length > 5 ? " (consider reducing to 3-5 best ones)" : " (perfect!)"}` : "⚠️ Suggestions: None yet (recommended to add 3-5)"}
${hasSystemPrompt ? `✅ System Prompt: Set (${draft?.systemPrompt?.length} characters)${draft?.systemPrompt?.length && draft?.systemPrompt?.length < 100 ? " (consider adding more detail)" : ""}` : "⚠️ System Prompt: Not set (recommended for better responses)"}
${draft?.defaultModel ? `✅ Base Model: ${draft.defaultModel}` : "⚠️ Base Model: Not set (defaults to chatGPT)"}
${hasTools ? `✅ Tools enabled: ${draft.tools?.join(", ")}` : "⚠️ Tools: None enabled"}
${hasExtends ? `✅ Extends: ${draft.extends?.join(", ")}` : ""}
${hasThemeColor ? `✅ Theme Color: ${draft.themeColor}` : "⚠️ Theme Color: Not set (recommend choosing one)"}
${hasImage ? `✅ App Image: Uploaded` : "⚠️ App Image: Not uploaded (not required for private apps, but important for publishing)"}
${draft?.tone ? `✅ Tone: ${draft.tone}` : ""}
${draft?.temperature !== undefined ? `✅ Temperature: ${draft.temperature}` : ""}
${draft?.visibility ? `✅ Visibility: ${draft.visibility}` : ""}

READINESS STATUS:
${isReadyToSave ? "🚀 READY TO SAVE! All required fields complete." : "⏳ NOT READY - Missing required fields"}
${missingRecommended.length > 0 ? `\n💡 RECOMMENDED BEFORE SAVING:\n${missingRecommended.map((item) => `   - ${item}`).join("\n")}` : ""}
${publishingRecommendations.length > 0 ? `\n📱 PUBLISHING RECOMMENDATIONS (for public apps):\n${publishingRecommendations.map((item) => `   - ${item}`).join("\n")}` : ""}

SCHEMA REFERENCE FOR GUIDANCE:
- name: string (3-10 chars, short & memorable)
- title: string (max 30 chars, describes what it does)
- highlights: array of suggestions (3-5 recommended, can use templates like {{city}}, {{weather}}, {{location}})
- systemPrompt: string (defines behavior, tone, expertise)
- defaultModel: "chatGPT" | "claude" | "gemini" | "deepSeek" | "perplexity" | "flux"
- tools: ["calendar", "location", "weather"] - enable based on app needs
- extends: ["Atlas", "Peach", "Vault", "Bloom"] - inherit features from base apps
- capabilities: {webSearch, imageGeneration, fileAnalysis, voice, video, codeExecution}
- themeColor: hex color (e.g., #F97316 for orange)
- tone: "professional" | "casual" | "friendly" | "technical" | "creative"
- temperature: 0-2 (0=focused, 2=creative)

PLACEHOLDER TEMPLATES (explain when relevant):
- {{city}} - User's current city
- {{country}} - User's country
- {{location}} - Full location
- {{weather}} - Current weather description
- {{temp}} - Current temperature
- These templates auto-populate with real data when tools are enabled!

YOUR ROLE AS AI COACH:
1. **Guide progressively**: Help them complete missing required fields first (name → title → suggestions → system prompt)
2. **Explain benefits**: When suggesting tools/features, explain WHY they're useful for their app
3. **Analyze choices**: If they select suggestions with {{weather}}, recommend enabling weather tool
4. **Provide examples**: Give concrete examples based on their app type
5. **Encourage best practices**: Suggest 3-5 suggestions, meaningful system prompts, appropriate tools
6. **Be conversational**: Act like a helpful product manager, not a form validator
7. **Celebrate progress**: Acknowledge what they've completed
8. **Context-aware**: If they upload files, suggest how to reference them in system prompt
9. **Use emojis appropriately**: Make responses engaging and visual with relevant emojis (🎯 for goals, ✅ for completed items, 💡 for tips, 🚀 for next steps, etc.)
10. **Pre-save review**: When user asks "what else should I add" or "is it ready", provide comprehensive review with specific suggestions
11. **Update mode awareness**: ${isUpdate ? "This is an UPDATE - be careful about breaking changes, suggest A/B testing for major modifications" : "This is NEW - encourage experimentation and iteration"}
12. **Image analysis**: If user uploads an image for their app logo, analyze it for:
    - Size (recommend 500x500px PNG)
    - Quality (professional, clear, recognizable)
    - Branding (matches app theme and purpose)
    - Suggest improvements if needed
    - Offer to help create one if they don't have a proper image yet

SMART RECOMMENDATIONS:
${smartRecommendations.join("\n")}

NEXT STEPS GUIDANCE:
${!hasName ? "🎯 First, let's choose a short, memorable name (3-10 characters)" : !hasTitle ? "🎯 Great name! Now add a title that explains what it does" : !hasHighlights ? "🎯 Perfect! Now add 3-5 suggestions to showcase key features" : !hasSystemPrompt ? "🎯 Excellent! Last step: define how your app should behave with a system prompt" : isReadyToSave && missingRecommended.length === 0 ? "🎉 PERFECT! Your app is complete and ready to save! 🚀" : isReadyToSave ? `🚀 Ready to save! Optional improvements: ${missingRecommended.join(", ")}` : "⏳ Almost there! Complete the required fields to save"}

${
  isReadyToSave && isUpdate
    ? `
⚠️ UPDATE CHECKLIST BEFORE SAVING:
- Review changes carefully - existing users will see them immediately
- Major changes (name, base model) may confuse existing users
- Test new system prompts thoroughly before deploying
- Consider keeping a backup of the old version
- If changing tools, ensure suggestions still work
`
    : ""
}

Remember: Be encouraging, explain concepts clearly, and help them build an amazing app!${isUpdate ? " For updates, prioritize user experience continuity." : ""}
`
  }

  // Note: threadInstructions are already included in baseSystemPrompt via Handlebars template
  // But we keep this comment for clarity that they're part of every message
  const systemPrompt =
    baseSystemPrompt +
    featureStatusContext +
    memoryContext +
    placeholderContext +
    calendarContext +
    vaultContext +
    newsContext +
    // brandKnowledge +
    aiCoachContext

  const creditsLeft = member?.creditsLeft || guest?.creditsLeft

  if (!creditsLeft || creditsLeft <= 0) {
    return NextResponse.json({ error: "No credits left" }, { status: 403 })
  }

  const hourlyLimit =
    isDevelopment && !isE2E
      ? 50000
      : getHourlyLimit({
          member,
          guest,
        })

  const hourlyUsageLeft = member
    ? hourlyLimit - (member?.messagesLastHour || 0)
    : hourlyLimit - (guest?.messagesLastHour || 0)

  const hitHourlyLimit = hourlyUsageLeft <= 0

  if (hitHourlyLimit) {
    return NextResponse.json({ error: "Hourly limit reached" }, { status: 403 })
  }

  if (message.user?.id !== member?.id || message.guest?.id !== guest?.id) {
    if (
      !thread?.collaborations.some(
        (collaboration) => collaboration.user.id === member?.id,
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // Get the current message content
  const currentMessageContent = message.message.content

  // Filter out the current message from past messages to avoid duplication
  const contextMessages = await getContextWindow(
    threadMessages.messages
      .filter((msg) => msg.message.id !== messageId)
      .sort(
        (a, b) =>
          new Date(a.message.createdOn).getTime() -
          new Date(b.message.createdOn).getTime(),
      )
      .map((msg) => {
        let content = msg.message.content

        const userLiked = msg.message.reactions?.some(
          (r) =>
            r.like &&
            ((member?.id && r.userId === member.id) ||
              (guest?.id && r.userId === guest.id)),
        )

        if (userLiked) {
          content += `\n\n[USER LIKED THIS MESSAGE - This response was particularly helpful/accurate]`
        }

        msg.message?.files?.forEach((file) => {
          content += `\n\nSHARED FILES:\n\n${file.data}`
        })

        // msg.message?.webSearchResult?.forEach((file) => {
        //   content += `\n\nWEB SEARCH:\n\n${file.title}\n${file.snippet}\n${file.url}\n`
        // })

        return {
          role: (!msg.aiAgent ? "user" : "assistant") as "user" | "assistant",
          content,
        }
      })
      .filter((msg) => {
        // Filter out empty messages that would cause Claude to fail
        const content = msg.content?.trim()
        if (!content || content === "") {
          console.log(
            `🗑️ Filtering out empty message from conversation history`,
          )
          return false
        }
        return true
      }),
    agent?.maxPromptSize || 4000,
  )

  let suggestionMessages = undefined

  if (!characterProfilesEnabled) {
    const pastMessages = await getMessages({
      pageSize: 75, // Increased for better RAG context from message history
      userId: member?.id,
      guestId: guest?.id,
    })

    suggestionMessages = await getContextWindow(
      pastMessages.messages
        .filter((msg) => msg.message.id !== messageId)
        .sort(
          (a, b) =>
            new Date(a.message.createdOn).getTime() -
            new Date(b.message.createdOn).getTime(),
        )
        .map((msg) => {
          let content = msg.message.content

          msg.message?.files?.forEach((file) => {
            content += `\n\nSHARED FILES:\n\n${file.data}`
          })

          // msg.message?.webSearchResult?.forEach((file) => {
          //   content += `\n\nWEB SEARCH:\n\n${file.title}\n${file.snippet}\n${file.url}\n`
          // })

          return {
            role: (msg.user || msg.guest ? "user" : "assistant") as
              | "user"
              | "assistant",
            content,
          }
        })
        .filter((msg) => {
          // Filter out empty messages that would cause Claude to fail
          const content = msg.content?.trim()
          if (!content || content === "") {
            console.log(
              `🗑️ Filtering out empty message from conversation history`,
            )
            return false
          }
          return true
        }),
      agent?.maxPromptSize || 4000,
    )
  }

  // Process files and prepare content for AI
  let userContent: any = currentMessageContent

  if (files.length > 0) {
    // Check file upload rate limits
    // if (!member) {
    //   console.log(`❌ No member found for file upload rate limiting`)
    //   return NextResponse.json(
    //     { error: "Authentication required for file uploads" },
    //     { status: 401 },
    //   )
    // }

    const rateLimitCheck = await checkFileUploadLimits({
      member,
      files,
      guest,
    })

    if (!rateLimitCheck.allowed) {
      console.log(`❌ File upload rate limit exceeded:`, rateLimitCheck.error)
      if (!isDevelopment && !isE2E) {
        return NextResponse.json(
          {
            error: rateLimitCheck.error,
            message: rateLimitCheck.resetInfo,
            type: "rate_limit",
          },
          { status: 429 }, // 429 Too Many Requests
        )
      }
    }

    console.log(`✅ File upload rate limit check passed`)

    // Store quota info to include in response

    const agentLimits = (() => {
      switch (agent?.name) {
        case "deepSeek":
          return MAX_FILE_SIZES.deepSeek
        case "chatGPT":
          return MAX_FILE_SIZES.chatGPT
        case "claude":
          return MAX_FILE_SIZES.claude
        case "gemini":
          return MAX_FILE_SIZES.gemini
        default:
          return MAX_FILE_SIZES.deepSeek
      }
    })()

    // First check total size
    const totalFileSize = files.reduce((total, file) => total + file.size, 0)

    // Calculate maximum allowed total size (use only non-zero limits)
    const nonZeroLimits = Object.values(agentLimits).filter(
      (limit) => limit > 0,
    )
    const MAX_TOTAL_SIZE =
      nonZeroLimits.length > 0
        ? Math.max(...nonZeroLimits) * 3 // Multiply by max files allowed
        : 10 * 1024 * 1024 * 3 // Fallback: 30MB total

    if (totalFileSize > MAX_TOTAL_SIZE) {
      const maxTotalMB = (MAX_TOTAL_SIZE / (1024 * 1024)).toFixed(1)
      const currentTotalMB = (totalFileSize / (1024 * 1024)).toFixed(1)
      return NextResponse.json(
        {
          error: `Total file size (${currentTotalMB}MB) exceeds maximum limit of ${maxTotalMB}MB`,
        },
        { status: 400 },
      )
    }

    // Server-side file size validation (safety net)
    const MAX_FILE_SIZE = (() => {
      switch (agent?.name) {
        case "deepSeek":
          return MAX_FILE_SIZES.deepSeek
        case "chatGPT":
          return MAX_FILE_SIZES.chatGPT
        case "claude":
          return MAX_FILE_SIZES.claude
        case "gemini":
          return MAX_FILE_SIZES.gemini
        default:
          return MAX_FILE_SIZES.deepSeek
      }
    })()

    for (const file of files) {
      const fileType = file.type.toLowerCase()
      let maxSize = 0

      if (fileType.startsWith("image/")) maxSize = MAX_FILE_SIZE.image
      else if (fileType.startsWith("audio/")) maxSize = MAX_FILE_SIZE.audio
      else if (fileType.startsWith("video/")) maxSize = MAX_FILE_SIZE.video
      else if (fileType.startsWith("application/pdf"))
        maxSize = MAX_FILE_SIZE.pdf
      else if (fileType.startsWith("text/")) maxSize = MAX_FILE_SIZE.text

      if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1)
        console.warn(
          `🚫 File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB > ${maxSizeMB}MB)`,
        )
        return NextResponse.json(
          {
            error: `File '${file.name}' is too large. Maximum size: ${maxSizeMB}MB`,
          },
          { status: 400 },
        )
      }
    }

    // Scan files for malware
    console.log("🔍 Scanning files for malware...")
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const scanResult = await scanFileForMalware(buffer)

      if (!scanResult.safe) {
        console.error(
          `🚨 Malware detected in ${file.name}: ${scanResult.threat}`,
        )
        return NextResponse.json(
          {
            error: `File '${file.name}' failed security scan${scanResult.threat ? `: ${scanResult.threat}` : ""}`,
          },
          { status: 400 },
        )
      }
    }
    console.log("✅ All files passed malware scan")

    // Convert files to base64 and prepare multimodal content
    console.log("🔄 Converting files to base64...")
    const fileContents = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString("base64")
        const mimeType = file.type

        console.log(
          `✅ Processed ${file.name} (${mimeType}, ${(file.size / 1024).toFixed(1)}KB)`,
        )

        return {
          type: mimeType.startsWith("image/")
            ? "image"
            : mimeType.startsWith("audio/")
              ? "audio"
              : mimeType.startsWith("video/")
                ? "video"
                : mimeType.startsWith("application/pdf")
                  ? "pdf"
                  : mimeType.startsWith("text/")
                    ? "text"
                    : "file",
          mimeType,
          data: base64,
          filename: file.name,
          size: file.size,
        }
      }),
    )

    // Create multimodal content for AI providers that support it
    // Ensure text is never empty for providers like Claude that require non-empty text content
    const textContent =
      currentMessageContent.trim() || "Please analyze the attached file(s)."

    userContent = {
      text: textContent,
      files: fileContents,
    }

    console.log(`📎 Prepared multimodal content: ${fileContents.length} files`)
  }

  // Handle multimodal content properly for AI providers
  let userMessage: any
  if (typeof userContent === "string") {
    // Simple text message
    userMessage = { role: "user", content: userContent }
  } else {
    // Multimodal message with files
    // For Claude and other providers that support multimodal, use proper content structure
    const contentParts = []

    // Add text part (always required for Claude)
    if (userContent.text && userContent.text.trim()) {
      contentParts.push({
        type: "text",
        text: userContent.text,
      })
    }

    const uploadedImages = []
    const uploadedAudio = []
    const uploadedVideo = []
    const uploadedFiles = []

    // Add file parts
    if (userContent.files && userContent.files.length > 0) {
      for (const file of userContent.files) {
        if (file.type === "image") {
          const uploadResult = await upload({
            url: `data:${file.mimeType};base64,${file.data}`,
            messageId: slugify(file.filename.substring(0, 10)),
            options: {
              maxWidth: 600,
              maxHeight: 600,
              title: file.filename,
            },
          })

          uploadedImages.push({
            url: uploadResult.url,
            width: uploadResult.width,
            height: uploadResult.height,
            title: uploadResult.title,
            size: file.size,
          })

          contentParts.push({
            type: "image",
            image: `data:${file.mimeType};base64,${file.data}`,
          })
        } else if (file.type === "audio" || file.type === "video") {
          contentParts.push({
            type: "text",
            text: `[${file.type.toUpperCase()} FILE: ${file.filename} (${(file.size / 1024).toFixed(1)}KB)]`,
          })
          if (file.type === "audio") {
            const uploadResult = await upload({
              url: `data:${file.mimeType};base64,${file.data}`,
              messageId: slug(file.filename.substring(0, 10)),
              options: {
                title: file.filename,
                type: "audio",
              },
            })
            uploadedAudio.push({
              url: uploadResult.url,
              title: uploadResult.title,
              size: file.size,
            })
          } else {
            const uploadResult = await upload({
              url: `data:${file.mimeType};base64,${file.data}`,
              messageId: slug(file.filename.substring(0, 10)),
              options: {
                title: file.filename,
                type: "video",
              },
            })
            uploadedVideo.push({
              url: uploadResult.url,
              title: uploadResult.title,
              size: file.size,
              width: uploadResult.width,
              height: uploadResult.height,
            })
            // Extract key frames from video for AI analysis
            console.log(`🎥 Processing video: ${file.filename}`)
            try {
              const videoFrames = await extractVideoFrames(
                file.data,
                file.mimeType,
              )

              for (let i = 0; i < videoFrames.length; i++) {
                contentParts.push({
                  type: "image",
                  image: `data:image/png;base64,${videoFrames[i]}`,
                })
              }

              console.log(
                `✅ Extracted ${videoFrames.length} frames from ${file.filename}`,
              )
            } catch (error) {
              captureException(error)
              console.error(
                `❌ Failed to process video ${file.filename}:`,
                error,
              )
              // Fallback: upload video as file
              const uploadResult = await upload({
                url: `data:${file.mimeType};base64,${file.data}`,
                messageId: slug(file.filename.substring(0, 10)),
                options: {
                  title: file.filename,
                  type: "video",
                },
              })
              uploadedVideo.push({
                url: uploadResult.url,
                title: uploadResult.title,
                size: file.size,
              })
            }
          }
        } else if (file.type === "text") {
          const textContent =
            file.type === "text"
              ? Buffer.from(file.data, "base64").toString("utf8")
              : undefined

          // Process text file for RAG instead of appending entire content
          if (textContent) {
            await processFileForRAG({
              content: textContent,
              filename: file.filename,
              fileType: "text",
              fileSizeBytes: file.size,
              messageId: message.message.id,
              threadId: thread.id,
              userId: member?.id,
              guestId: guest?.id,
            })
          }

          uploadedFiles.push({
            data: textContent,
            title: file.filename,
            size: file.size,
            name: file.filename,
            type: file.type,
          })
          contentParts.push({
            type: "text",
            text: `[TEXT FILE: ${file.filename}] - Processed for intelligent search (${Math.round((textContent?.length || 0) / 1000)}k chars)`,
          })
        } else if (file.type === "pdf" || file.type === "application/pdf") {
          const uploadResult = await upload({
            url: `data:${file.mimeType};base64,${file.data}`,
            messageId: slug(file.filename.substring(0, 10)),
            options: {
              title: file.filename,
              type: "pdf",
            },
          })

          try {
            const pdfBuffer = Buffer.from(file.data, "base64")
            const extractedText = await extractPDFText(pdfBuffer)

            uploadedFiles.push({
              data: extractedText,
              url: uploadResult.url,
              title: uploadResult.title,
              size: file.size,
              name: file.filename,
              type: "pdf",
            })
            // Process PDF for RAG instead of appending entire content
            await processFileForRAG({
              content: extractedText,
              filename: file.filename,
              fileType: "pdf",
              fileSizeBytes: file.size,
              messageId: message.message.id,
              threadId: thread.id,
              userId: member?.id,
              guestId: guest?.id,
            })

            contentParts.push({
              type: "text",
              text: `[PDF FILE: ${file.filename}] - Processed for intelligent search (${Math.round(extractedText.length / 1000)}k chars)`,
            })
          } catch (error) {
            captureException(error)
            console.error("PDF extraction failed:", error)
            contentParts.push({
              type: "text",
              text: `[PDF FILE: ${file.filename}] - Could not extract text content.`,
            })
          }
        }
      }
    }

    if (
      uploadedFiles.length > 0 ||
      uploadedAudio.length > 0 ||
      uploadedVideo.length > 0 ||
      uploadedImages.length > 0
    ) {
      await updateMessage({
        ...message.message,
        video: uploadedVideo?.length
          ? uploadedVideo.map((video) => ({
              ...video,
              prompt: content,
              id: uuidv4(),
            }))
          : message.message.video,
        audio: uploadedAudio?.length
          ? uploadedAudio.map((audio) => ({
              ...audio,
              prompt: content,
              id: uuidv4(),
            }))
          : message.message.audio,
        files: uploadedFiles?.length
          ? uploadedFiles.map((file) => ({
              ...file,
              prompt: content,
              id: uuidv4(),
            }))
          : message.message.files,
        images: uploadedImages?.length
          ? uploadedImages // Exclude video frames from preview
              .map((image) => ({
                ...image,
                prompt: content,
                id: uuidv4(),
              }))
          : message.message.images,
      })

      const fullMessage = await getMessage({
        id: message.message.id,
      })

      notifyOwnerAndCollaborations({
        notifySender: true,
        member,
        guest,
        thread,
        payload: {
          type: "message_update",
          data: {
            message: fullMessage,
          },
        },
      })
    }

    // Ensure we always have at least one content part
    if (contentParts.length === 0) {
      contentParts.push({
        type: "text",
        text: "Please analyze the attached file(s).",
      })
    }

    userMessage = {
      role: "user",
      content: contentParts,
    }
  }

  const lastMessageContent = (
    await getMessages({
      threadId: thread.id,
      pageSize: 1,
      userId: member?.id,
      guestId: guest?.id,
      agentId: null,
    })
  ).messages.at(0)?.message.content

  const debatePrompt =
    debateAgent && selectedAgent
      ? `
You are ${selectedAgent.name} in a structured debate with ${debateAgent.name}.

**Debate Rules:**
1. Alternate turns (this is your turn)
2. Keep responses concise
3. Directly engage with the last point made
4. Provide evidence/reasoning
5. Conclude after 3 exchanges max
6. Use your own Identity don't Vex identity 

**User's Original Prompt:**
${lastMessageContent}

**Your Role:**
- Maintain ${selectedAgent.name}'s perspective
- Counter ${debateAgent.name}'s last point
- Advance the discussion meaningfully
- Signal when debate should conclude
`
      : ""

  // Build enhanced RAG context from uploaded documents and message history
  const ragContext = await buildEnhancedRAGContext(content, thread.id)

  // Add RAG context to system prompt if available
  const ragSystemPrompt = ragContext
    ? `${systemPrompt}\n\nRELEVANT CONTEXT FROM UPLOADED DOCUMENTS:\n${ragContext}\n\nUse this context to provide more accurate and informed responses when relevant.`
    : systemPrompt

  // Add calendar tool instructions if calendar tools are available
  const calendarInstructions =
    app?.slug === "calendar" || app?.slug === "vex"
      ? `\n\n🔥 CRITICAL CALENDAR TOOL RULES:
1. EXECUTE IMMEDIATELY - Call the tool functions RIGHT NOW, not later
2. USE PAST TENSE - Always say "I've scheduled" or "I've created", NEVER "I'll schedule" or "Let me"
3. NO CONFIRMATION REQUESTS - Don't ask permission, just do it and report results
4. BE SPECIFIC - Include all details (time, title, attendees) in your confirmation
5. MULTI-STEP ACTIONS - If checking conflicts and rescheduling, do BOTH actions in one response

✅ CORRECT Examples:
- "I've scheduled 'Daily Sync' for tomorrow at 10 AM for 30 minutes and invited emma.brown@google.com"
- "I've blocked your calendar every Friday 2-5 PM for the next month as 'Focus Time'"
- "I found a 3 PM call today and rescheduled it to tomorrow at 3 PM"

❌ WRONG Examples (NEVER use these):
- "I'll schedule that for you" 
- "Let me check your calendar"
- "Would you like me to..."
- "I can help you with that"

Execute tools immediately and report what you DID (past tense), not what you WILL do (future tense).`
      : ""

  const enhancedSystemPrompt = debatePrompt
    ? `${ragSystemPrompt}${calendarInstructions}\n\n${debatePrompt}` // Combine all
    : `${ragSystemPrompt}${calendarInstructions}`

  // User message remains unchanged - RAG context now in system prompt
  const enhancedUserMessage = userMessage

  // Function to merge consecutive user messages for Perplexity compatibility
  const mergeConsecutiveUserMessages = (
    msgs: ModelMessage[],
  ): ModelMessage[] => {
    if (agent?.name !== "perplexity") {
      return msgs // Only apply this for Perplexity
    }

    const merged: ModelMessage[] = []
    let currentUserContent: string[] = []

    for (const msg of msgs) {
      if (msg.role === "user") {
        // Accumulate user messages
        currentUserContent.push(
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
        )
      } else {
        // When we hit a non-user message, flush any accumulated user content
        if (currentUserContent.length > 0) {
          merged.push({
            role: "user",
            content: currentUserContent.join("\n\n---\n\n"), // Separate multiple user messages with divider
          })
          currentUserContent = []
        }
        merged.push(msg)
      }
    }

    // Don't forget to flush any remaining user content at the end
    if (currentUserContent.length > 0) {
      merged.push({
        role: "user",
        content: currentUserContent.join("\n\n---\n\n"),
      })
    }

    return merged
  }

  const rawMessages: ModelMessage[] = [
    { role: "system", content: enhancedSystemPrompt },
    ...contextMessages,
    enhancedUserMessage,
  ]

  const messages: ModelMessage[] = mergeConsecutiveUserMessages(rawMessages)

  // Log prompt size for debugging token usage
  const totalPromptLength = messages.reduce((total, msg) => {
    return (
      total +
      (typeof msg.content === "string"
        ? msg.content.length
        : JSON.stringify(msg.content).length)
    )
  }, 0)

  const estimatedTokens = Math.ceil(totalPromptLength / 4) // Rough estimate: 4 chars per token

  console.log(`📊 Prompt Analysis:`, {
    messagesCount: messages.length,
    totalCharacters: totalPromptLength,
    estimatedTokens,
    hasFiles: files.length > 0,
    filesSizes: files.map((f) => `${f.name}: ${(f.size / 1024).toFixed(1)}KB`),
    systemPromptLength: systemPrompt.length,
    contextMessagesCount: contextMessages.length,
    userContentLength:
      typeof userContent === "string"
        ? userContent.length
        : JSON.stringify(userContent).length,
  })

  // Define token limits per model (conservative estimates to prevent errors)
  const TOKEN_LIMITS = {
    deepSeek: 28000, // DeepSeek R1 has 32K context, use 28K to be safe
    chatGPT: 120000, // GPT-4 has 128K context, use 120K to be safe
    claude: 180000, // Claude has 200K context, use 180K to be safe
    gemini: 950000, // Gemini has 1M context, use 950K to be safe
  }

  if (estimatedTokens > 25000) {
    console.warn(
      `⚠️ High token usage detected: ~${estimatedTokens} tokens (approaching limits)`,
    )
  }

  console.log("🤖 Agent lookup:", { agentId, found: !!agent })

  if (!agent) {
    console.log("❌ Agent not found")
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  // Check token limit for the specific agent/model
  const modelLimit =
    TOKEN_LIMITS[agent.name as keyof typeof TOKEN_LIMITS] || 25000
  if (estimatedTokens > modelLimit) {
    console.log(
      `🚫 Token limit exceeded: ~${estimatedTokens} tokens > ${modelLimit} limit for ${agent.name}`,
    )
    captureException(
      `🚫 Token limit exceeded: ~${estimatedTokens} tokens > ${modelLimit} limit for ${agent.name}`,
    )
    return NextResponse.json(
      {
        error: "Request too large",
        message: `Your message is too long for ${agent.displayName}. Please reduce the file size, use fewer files, or shorten your message. Estimated tokens: ${estimatedTokens}, limit: ${modelLimit}`,
        estimatedTokens,
        limit: modelLimit,
      },
      { status: 413 }, // 413 Payload Too Large
    )
  }

  console.log("📁 Processing files:", {
    count: files.length,
    capabilities: agent.capabilities,
  })

  if (
    (!member &&
      !guest?.subscription &&
      guest &&
      ["user", "subscriber"].includes(agent.authorization)) ||
    (!member?.subscription && agent.authorization === "subscriber")
  ) {
    console.log("❌ Agent not available for non user requests")
    return NextResponse.json({
      error: "Agent not available for non user requests",
      status: 403,
    })
  }

  // Validate files against agent capabilities
  if (files.length > 0) {
    console.log("📁 Processing files:", {
      count: files.length,
      capabilities: agent.capabilities,
    })

    for (const file of files) {
      const fileType = file.type.toLowerCase()
      let supported = false

      if (fileType.startsWith("image/") && agent.capabilities.image) {
        supported = true
      } else if (fileType.startsWith("audio/") && agent.capabilities.audio) {
        supported = true
      } else if (fileType.startsWith("video/") && agent.capabilities.video) {
        supported = true
      } else if (fileType.startsWith("text/") && agent.capabilities.text) {
        supported = true
      } else if (
        fileType.startsWith("application/pdf") &&
        agent.capabilities.pdf
      ) {
        supported = true
      }

      if (!supported) {
        console.log(
          `❌ File type ${fileType} not supported by agent ${agent.name}`,
        )
        return NextResponse.json(
          {
            error: `File type ${fileType} is not supported by ${agent.name}. This agent supports: ${Object.entries(
              agent.capabilities,
            )
              .filter(([_, v]) => v)
              .map(([k]) => k)
              .join(", ")}`,
          },
          { status: 400 },
        )
      }
    }
  }

  if (!thread) {
    console.log("❌ Thread not found")
    return NextResponse.json({ error: "Thread not found" }, { status: 404 })
  }

  console.log("✅ Selected agent:", {
    name: agent.name,
    id: agent.id,
  })

  // Create thread if not provided
  let currentThreadId = threadId
  console.log("🧵 Thread handling:", { providedThreadId: threadId })

  // Create user message first

  // Initialize AI model based on selected agent
  // Priority: app.apiKeys > environment variables
  console.log("🔧 Initializing AI model for:", agent.name)
  const appApiKeys = app?.apiKeys || {}

  let model
  switch (agent.name) {
    case "deepSeek":
      console.log("🤖 Using DeepSeek model")
      const deepseekKey = appApiKeys.deepseek || process.env.DEEPSEEK_API_KEY
      if (appApiKeys.deepseek) {
        console.log("✅ Using app-specific DeepSeek API key")
      }
      const deepseekProvider = createDeepSeek({
        apiKey: deepseekKey,
      })
      model = deepseekProvider(agent.modelId)
      break
    case "chatGPT":
      console.log("🤖 Using ChatGPT model")
      const openaiKey = appApiKeys.openai || CHATGPT_API_KEY
      if (appApiKeys.openai) {
        console.log("✅ Using app-specific OpenAI API key")
      }
      const openaiProvider = createOpenAI({
        apiKey: openaiKey,
      })
      model = openaiProvider(agent.modelId)

      break
    case "claude":
      console.log("🤖 Using Claude model")
      const claudeKey = appApiKeys.anthropic || CLAUDE_API_KEY
      if (appApiKeys.anthropic) {
        console.log("✅ Using app-specific Claude API key")
      }
      const claudeProvider = createAnthropic({
        apiKey: claudeKey,
      })
      model = claudeProvider(agent.modelId)
      break
    case "gemini":
      console.log("🤖 Using Gemini model")
      const geminiKey = appApiKeys.google || GEMINI_API_KEY
      if (appApiKeys.google) {
        console.log("✅ Using app-specific Gemini API key")
      }
      const geminiProvider = createGoogleGenerativeAI({
        apiKey: geminiKey,
      })
      model = geminiProvider(agent.modelId)
      break

    case "flux":
      console.log("🎨 Using Flux model for image generation")
      if (!imageGenerationEnabled) {
        console.log("❌ Flux agent requires image generation to be enabled")
        return NextResponse.json(
          { error: "Flux agent can only be used for image generation" },
          { status: 400 },
        )
      }
      // Use DeepSeek as fallback for any text operations (like prompt enhancement)
      const deepseekKeyFlux =
        appApiKeys.deepseek || process.env.DEEPSEEK_API_KEY
      const deepseekProviderFlux = createDeepSeek({
        apiKey: deepseekKeyFlux,
      })
      model = deepseekProviderFlux("deepseek-reasoner")
      break
    case "perplexity":
      console.log("🤖 Using Perplexity Sonar model")
      const perplexityKey =
        appApiKeys.perplexity || process.env.PERPLEXITY_API_KEY
      if (appApiKeys.perplexity) {
        console.log("✅ Using app-specific Perplexity API key")
      }
      // Perplexity doesn't have a createPerplexity, uses env var
      if (appApiKeys.perplexity) {
        process.env.PERPLEXITY_API_KEY = appApiKeys.perplexity
      }
      model = perplexity(agent.modelId) // "sonar"
      break
    default:
      // Handle custom OpenAI-compatible models
      console.log("🤖 Using custom OpenAI-compatible model:", agent.name)
      if (!agent.apiURL) {
        console.log("❌ Custom agent missing apiURL:", agent.name)
        return NextResponse.json(
          { error: "Custom agent requires an API URL" },
          { status: 400 },
        )
      }

      // Parse stored format: "baseURL|apiKey"
      const [customBaseURL, customApiKey] = agent.apiURL.includes("|")
        ? agent.apiURL.split("|")
        : ["https://api.openai.com/v1", agent.apiURL]

      console.log("🔗 Custom model base URL:", customBaseURL)
      console.log("🎯 Custom model ID:", agent.modelId)
      console.log("🔑 Has API key:", !!customApiKey)

      const customProvider = createOpenAI({
        apiKey: customApiKey,
        baseURL: customBaseURL,
      })
      model = customProvider(agent.modelId)
      break
  }

  // Perform web search if user enabled it, agent supports it, message needs search, and no files attached

  const searchContext = message.message.searchContext
  if (searchContext) {
    console.log("✅ Web search completed, adding to context", searchContext)
  } else if (files.length > 0) {
    console.log("📎 Files attached, skipping web search")
  } else if (!agent.capabilities.webSearch) {
    console.log("🔍 Agent does not support web search")
  }

  searchContext
    ? console.log("🌐 Web search enabled")
    : console.log("❌ Web search disabled")

  agent.capabilities.webSearch
    ? console.log("🤖 Agent supports web search")
    : console.log("❌ Agent does not support web search")

  // Function to extract web search results from Perplexity response and process citations
  const processPerplexityResponse = (
    text: string,
    agentName: string,
    responseMetadata?: any,
  ): { processedText: string; webSearchResults: webSearchResultType[] } => {
    // Only process Perplexity responses
    if (agentName !== "perplexity") {
      return { processedText: text, webSearchResults: [] }
    }

    // Extract citation numbers from the text [1], [2], [3], etc.
    const citationPattern = /\[(\d+)\]/g
    const citations = text.match(citationPattern) || []

    if (citations.length === 0) {
      console.log("❌ No citations found in Perplexity response")
      return { processedText: text, webSearchResults: [] }
    }

    // Extract unique citation numbers
    const citationNumbers = [
      ...new Set(
        citations
          .map((match) => {
            const num = match.match(/\[(\d+)\]/)?.[1]
            return num ? parseInt(num) : null
          })
          .filter((num) => num !== null),
      ),
    ].sort((a, b) => a - b) // Sort numerically

    console.log(`🔢 Found citations:`, citationNumbers)
    console.log(`📊 Response metadata:`, responseMetadata)

    // Extract web search results from Perplexity's response metadata
    // This will be populated once we see what structure Perplexity returns
    let webSearchResults: webSearchResultType[] = []

    // Check if responseMetadata contains citations or sources
    if (responseMetadata?.sources) {
      console.log("🎯 Processing Perplexity sources from AI SDK")
      webSearchResults = responseMetadata.sources.map(
        (source: any, index: number) => ({
          title: source.title || source.name || `Source ${index + 1}`,
          url: source.url || source.link || source.href || "#",
          snippet:
            source.snippet ||
            source.text ||
            source.description ||
            "No description available",
        }),
      )
      console.log(
        `✅ Extracted ${webSearchResults.length} sources from Perplexity AI SDK`,
      )
    } else if (responseMetadata?.citations) {
      webSearchResults = responseMetadata.citations.map(
        (citation: any, index: number) => ({
          title: citation.title || `Source ${index + 1}`,
          url: citation.url || citation.link || "#",
          snippet:
            citation.snippet || citation.text || "No description available",
        }),
      )
    } else if (responseMetadata?.messages?.[0]?.content) {
      // Check inside the content array of the assistant message
      const content = responseMetadata.messages[0].content
      console.log(
        `🔍 Checking content array:`,
        JSON.stringify(content, null, 2),
      )

      // Look for citations in each content item
      for (const contentItem of content) {
        if (contentItem.citations) {
          webSearchResults = contentItem.citations.map(
            (citation: any, index: number) => ({
              title: citation.title || `Source ${index + 1}`,
              url: citation.url || citation.link || "#",
              snippet:
                citation.snippet || citation.text || "No description available",
            }),
          )
          console.log(
            `✅ Found ${webSearchResults.length} citations in content array`,
          )
          break
        } else if (contentItem.sources) {
          webSearchResults = contentItem.sources.map(
            (source: any, index: number) => ({
              title: source.title || `Source ${index + 1}`,
              url: source.url || source.link || "#",
              snippet:
                source.snippet || source.text || "No description available",
            }),
          )
          console.log(
            `✅ Found ${webSearchResults.length} sources in content array`,
          )
          break
        }
      }
    }

    // Build citation references section if we have search results
    let processedText = text
    if (webSearchResults.length > 0) {
      let citationReferences = "\n\n**Sources:**\n"
      citationNumbers.forEach((num) => {
        const resultIndex = num - 1 // Convert to 0-based index
        if (resultIndex >= 0 && resultIndex < webSearchResults.length) {
          const result = webSearchResults[resultIndex]
          if (result) {
            citationReferences += `[${num}] ${result.title} - ${result.url}\n`
          }
        }
      })
      processedText = text + citationReferences
    }

    console.log(
      `🔗 Processed ${citationNumbers.length} Perplexity citations with ${webSearchResults.length} search results`,
    )

    return { processedText, webSearchResults }
  }

  // Update system prompt with search context if available
  if (searchContext && messages[0]) {
    messages[0].content = `${messages[0].content}${searchContext}\n\nPlease use the above web search results to provide accurate, up-to-date information in your response. Cite sources when relevant using numbered citations like [1], [2], [3], etc.`
  }

  if (isE2E) {
    console.log("🤖 Starting E2E testing for thread:", threadId)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    // Create a test stream response for E2E testing

    const stream = new ReadableStream({
      async start(controller) {
        // Try logging after a small delay
        setTimeout(() => {
          console.log("Controller after delay:", controller)
        }, 0)

        // Or check specific properties
        console.log("Controller type:", typeof controller)
        console.log("Controller constructor:", controller?.constructor?.name)

        streamControllers.set(streamId, controller) // Store the stream instance

        const testResponse = faker.lorem.sentence({
          min: content.includes("long") ? 550 : 80,
          max: content.includes("long") ? 750 : 80,
        })

        const clientId = message.message.clientId

        // Update thread and create message in the background

        // Split the response into chunks to simulate streaming
        const chunks = testResponse.match(/.{1,10}/g) || [testResponse]

        // Create AI message structure for E2E streaming chunks
        const e2eStreamingMessage = {
          message: {
            id: clientId,
            threadId,
            agentId,
            userId: member?.id,
            guestId: guest?.id,
            content: "",
            isStreaming: true,
          },
          aiAgent: pauseDebate ? debateAgent : agent,
          user: member,
          guest: guest,
          thread: thread,
        }

        const totalChunks = chunks.length

        for (const [index, chunk] of chunks.entries()) {
          if (!streamControllers.has(streamId)) {
            console.log("Stream was stopped, breaking loop")
            break
          }

          const chunkNumber = index + 1

          // console.log(
          //   `📤 ${clientId} Sending chunk ${chunkNumber}/${totalChunks}:`,
          //   chunk.substring(0, 20) + "...",
          // )

          await wait(150)

          thread &&
            enhancedStreamChunk({
              chunk,
              chunkNumber,
              totalChunks,
              streamingMessage: e2eStreamingMessage,
              member,
              guest,
              thread,
              clientId,
              streamId,
            })
        }

        console.log(
          `🎯 All ${totalChunks} chunks sent - now sending stream_complete`,
        )

        if (!streamControllers.has(streamId)) {
          console.log("Stream was stopped, previous message will be deleted")
          response = NextResponse.json(
            { error: "Stream was stopped" },
            { status: 400 },
          )
          return
        }

        if (!thread) {
          response = NextResponse.json(
            { error: "Thread not found" },
            { status: 404 },
          )
          return
        }
        await updateThread({
          ...thread,
          aiResponse:
            testResponse.slice(0, 150) +
            (testResponse.length > 150 ? "..." : ""),
        })

        const aiMessage = await createMessage({
          id: clientId,
          content: testResponse,
          originalContent: testResponse.trim(),
          threadId,
          agentId,
          userId: member?.id,
          guestId: guest?.id,
          searchContext: null,
          selectedAgentId: debateAgentId,
          debateAgentId,
          pauseDebate,
          webSearchResult: message.message.webSearchResult,
          images:
            agent?.name === "flux"
              ? [
                  {
                    url: "https://3cgunoyddd.ufs.sh/f/MwscKX46dv5bvbXGhy8iLAyQ5oWlezrwqhECfbKvk8PJmgZN",
                    prompt: "test",
                    id: uuidv4(),
                  },
                ]
              : undefined,
        })

        console.timeEnd("messageProcessing")

        if (!aiMessage) {
          response = NextResponse.json(
            { error: "Failed to create AI message" },
            { status: 500 },
          )
          return
        }

        if (thread) {
          const fullMessage = await getMessage({ id: aiMessage.id })
          notifyOwnerAndCollaborations({
            notifySender: true,
            thread,
            payload: {
              type: "stream_complete",
              data: {
                message: fullMessage,
                isFinal: true,
              },
            },
            member,
            guest,
          })
        }

        // Close the stream
        console.log("✅ Closing E2E stream")
        controller.close()
        streamControllers.delete(streamId)
      },
    })

    return response || NextResponse.json({ success: true })
  }

  checkThreadSummaryLimit({ user: member, guest, thread }) &&
    notifyOwnerAndCollaborations({
      notifySender: true,
      thread,
      payload: {
        type: "character_tag_creating",
        data: { threadId: thread.id },
      },
      member,
      guest,
    })

  try {
    console.log("🚀 Starting AI streaming...")

    // Special handling for Flux image generation with DeepSeek enhancement
    if ((agent.name as string) === "flux" && imageGenerationEnabled) {
      console.log("🎨 Hybrid DeepSeek + Flux image generation path")

      try {
        // Step 1: Use DeepSeek to enhance the prompt and generate description
        console.log("🧠 Enhancing prompt with DeepSeek...")

        // First, get enhanced prompt from DeepSeek internally (no streaming)
        // In the enhancement prompt, add conversation context
        const enhancementPrompt = `You are an expert image generation prompt engineer. 

CONVERSATION HISTORY:
${messages
  .slice(-5)
  .map((msg) => `${msg.role}: ${msg.content}`)
  .join("\n")}

CURRENT REQUEST: "${content}"

Your task is to:
1. Analyze the conversation context for visual preferences, themes, or style references
2. Consider any previous image requests or feedback
3. Create an enhanced, detailed prompt for Flux image generation that incorporates contextual insights
4. Write a creative description of what the image will show

Respond in this exact JSON format:
{
  "enhancedPrompt": "detailed prompt incorporating conversation context",
  "description": "creative description of the image"
}

Make the enhanced prompt contextually aware and optimized for high-quality image generation.`

        // Use app-specific DeepSeek key if available
        const deepseekEnhanceKey =
          appApiKeys.deepseek || process.env.DEEPSEEK_API_KEY
        const deepseekEnhanceProvider = createDeepSeek({
          apiKey: deepseekEnhanceKey,
        })
        const enhancementResponse = await generateText({
          model: deepseekEnhanceProvider("deepseek-chat"),
          messages: [{ role: "user", content: enhancementPrompt }],
        })

        let enhancedPrompt = content
        let aiDescription = "I'm generating a beautiful image for you..."

        try {
          // Clean and parse the enhancement response
          let cleanedText = enhancementResponse.text
          if (cleanedText.includes("```json")) {
            cleanedText = cleanedText
              .replace(/```json\s*/, "")
              .replace(/\s*```$/, "")
          }

          const enhancedData = JSON.parse(cleanedText)
          enhancedPrompt = enhancedData.enhancedPrompt || content
          aiDescription =
            enhancedData.description ||
            "I'm generating a beautiful image for you..."
          console.log("✅ DeepSeek enhancement complete:", {
            enhancedPrompt: enhancedPrompt.substring(0, 100),
          })
        } catch (parseError) {
          console.log(
            "⚠️ DeepSeek parsing failed, using original prompt:",
            parseError,
          )
        }

        // Now stream a natural response to the user while generating the image
        const userResponsePrompt = `The user requested: "${content}"

Provide a friendly, engaging response about generating this image. Be creative and descriptive about what you're creating. Keep it conversational and exciting. Don't mention technical details about prompts or models.

CONVERSATION HISTORY:
${messages
  .slice(-5)
  .map((msg) => `${msg.role}: ${msg.content}`)
  .join("\n")}
  
User preferences:
  - User prefers ${language} as their primary language.`

        let finalText = ""

        const deepseekResponseKey =
          appApiKeys.deepseek || process.env.DEEPSEEK_API_KEY
        const deepseekResponseProvider = createDeepSeek({
          apiKey: deepseekResponseKey,
        })
        const result = streamText({
          model: deepseekResponseProvider("deepseek-chat"),
          maxRetries: 3,
          messages: [{ role: "user", content: userResponsePrompt }],
          async onFinish({ text }) {
            finalText = text
          },
        })

        let accumulatedContent = ""
        const stream = result.toTextStreamResponse()
        const reader = stream.body?.getReader()

        const controller: StreamController = {
          close: () => reader?.cancel(),
          desiredSize: null,
          enqueue: () => {},
          error: () => {},
        }
        streamControllers.set(streamId, controller)

        // Create AI message structure for Flux streaming chunks
        const fluxStreamingMessage = {
          message: {
            id: clientId,
            threadId: currentThreadId,
            agentId: agent.id,
            userId: member?.id,
            guestId: guest?.id,
            content: "",
            isStreaming: true,
          },
          aiAgent: agent,
          user: member,
          guest: guest,
          thread: thread,
        }

        let currentChunk = 0

        if (reader) {
          while (true) {
            if (!streamControllers.has(streamId)) {
              console.log("Stream was stopped, breaking loop")
              break
            }
            const { done, value } = await reader.read()
            if (done) break

            const chunk = new TextDecoder().decode(value)
            await enhancedStreamChunk({
              chunk,
              chunkNumber: currentChunk++,
              totalChunks: -1, // Unknown in streaming
              streamingMessage: fluxStreamingMessage,
              member,
              guest,
              thread,
              clientId,
              streamId,
            })
          }
        }

        if (!streamControllers.has(streamId)) {
          console.log("Stream was stopped, breaking loop")
          return NextResponse.json(
            { error: "Stream was stopped" },
            { status: 400 },
          )
        }

        console.log("🎨 Generating image with enhanced Flux prompt...")

        const replicate = new Replicate({
          auth: REPLICATE_API_KEY,
        })

        const output = await replicate.run("black-forest-labs/flux-schnell", {
          input: {
            prompt: enhancedPrompt,
            width: 1024,
            height: 1024,
            num_inference_steps: 4,
            guidance_scale: 0,
          },
        })

        console.log("📝 Flux raw output type:", typeof output, output)

        // Handle different output formats from Replicate
        let imageUrl: string
        if (Array.isArray(output)) {
          imageUrl = output[0]
        } else if (typeof output === "string") {
          imageUrl = output
        } else if (output && typeof output === "object" && "url" in output) {
          imageUrl = (output as any).url
        } else {
          // If it's a ReadableStream or other format, convert to string
          imageUrl = String(output)
        }

        if (!imageUrl) {
          throw new Error("No image URL returned from Flux")
        }

        console.log("✅ Flux image generation complete:", imageUrl)

        // Upload to UploadThing for permanent storage
        const { url: permanentUrl, title } = await upload({
          url: imageUrl,
          messageId: slug(currentMessageContent.trim().substring(0, 10)),
          options: {
            maxWidth: 1024,
            maxHeight: 1024,
            title: agent.name,
            type: "image",
          },
        })

        console.log("✅ Image uploaded to permanent storage:", permanentUrl)

        const aiResponseContent = aiDescription

        // Save AI response to database
        const aiMessage = await createMessage({
          id: clientId,
          content: finalText,
          originalContent: aiResponseContent,
          threadId: currentThreadId,
          agentId: agent.id,
          agentVersion: agent.version,
          userId: member?.id,
          guestId: guest?.id,
          selectedAgentId: debateAgent?.id,
          clientId,
          images: [
            {
              url: permanentUrl, // Use permanent UploadThing URL
              prompt: content,
              model: "flux-schnell",
              width: 1024, // Flux generates 1024x1024 images
              height: 1024,
              title,
              id: uuidv4(),
            },
          ],
        })

        console.timeEnd("messageProcessing")

        if (!aiMessage) {
          console.log("❌ Failed to save Flux response to DB")

          return NextResponse.json(
            { error: "Failed to save Flux response to DB" },
            { status: 500 },
          )
        }

        console.log("💾 Flux image response saved to DB")

        // Update thread with image generation result
        await updateThread({
          ...thread,
          aiResponse: `Generated image: ${content.slice(0, 50)}${content.length > 50 ? "..." : ""}`,
        })

        // // Deduct credits for image generation
        // if (member) {
        //   await updateUser({
        //     ...member,
        //     credits: Math.max(0, member.credits - agent.creditCost),
        //   })
        // }

        const m = await getMessage({ id: aiMessage.id })

        thread &&
          notifyOwnerAndCollaborations({
            notifySender: true,
            thread,
            payload: {
              type: "stream_complete",
              data: {
                message: m,
                isFinal: true,
              },
            },
            member,
            guest,
          })

        after(async () => {
          try {
            if (m && selectedAgent) {
              await generateAIContent({
                thread,
                user: member,
                guest,
                agentId: selectedAgent.id,
                conversationHistory: !suggestionMessages
                  ? messages
                  : [
                      { role: "system", content: enhancedSystemPrompt },
                      ...suggestionMessages,
                      enhancedUserMessage,
                    ],
                latestMessage: m.message,
                language,
                calendarEvents,
                app, // Pass app object directly (no extra query needed)
                skipClassification: !!app, // Skip AI classification if app is set
              })
            }
          } catch (error) {
            console.error("❌ Background content generation failed:", error)
            captureException(error, {
              tags: {
                type: "background_task",
                task: "content_generation",
                threadId: thread.id,
                userId: member?.id || guest?.id,
              },
            })
          }
        })

        return NextResponse.json({ success: true })
      } catch (error) {
        captureException(error)
        console.error("❌ Flux image generation error:", error)
        return NextResponse.json(
          { error: "Failed to generate image" },
          { status: 500 },
        )
      }
    }

    const { calendarTools, vaultTools } = getTools({
      member,
      guest,
      currentThreadId,
    })

    // Combine calendar and vault tools
    const allTools = {
      ...calendarTools,
      ...vaultTools,
    }

    // Special handling for DeepSeek streaming
    if (agent.name === "deepSeek") {
      console.log("🔄 DeepSeek streaming path")
      console.log("📤 Sending to DeepSeek:", {
        content: content?.substring(0, 100),
      })

      // Set a 60-second timeout for DeepSeek API calls
      let timeoutId: NodeJS.Timeout

      let finalText = ""
      let responseMetadata: any = null
      let toolCallsDetected = false
      console.time("fullProcessing") // Start at beginning

      try {
        console.time("aiProviderCall")
        const result = streamText({
          model,
          messages,
          maxRetries: 3,
          temperature: app?.temperature ?? 0.7,
          tools: allTools,
          async onFinish({ text, usage, response, toolCalls, toolResults }) {
            finalText = text
            responseMetadata = response
            toolCallsDetected = toolCalls && toolCalls.length > 0
          },
        })
        const stream = result.toTextStreamResponse()
        console.timeEnd("aiProviderCall")

        const reader = stream.body?.getReader()

        const controller: StreamController = {
          close: () => reader?.cancel(),
          desiredSize: null,
          enqueue: () => {},
          error: () => {},
        }
        streamControllers.set(streamId, controller)

        // Create AI message structure for DeepSeek streaming chunks
        const deepSeekStreamingMessage = {
          message: {
            id: clientId,
            threadId: currentThreadId,
            agentId: agent.id,
            userId: member?.id,
            guestId: guest?.id,
            content: "",
            isStreaming: true,
          },
          aiAgent: pauseDebate ? debateAgent : agent,
          user: member,
          guest: guest,
          thread: thread,
        }

        let currentChunk = 0

        if (reader) {
          while (true) {
            if (!streamControllers.has(streamId)) {
              console.log("Stream was stopped, breaking loop")
              break
            }
            const { done, value } = await reader.read()
            if (done) break
            const chunk = new TextDecoder().decode(value)
            await enhancedStreamChunk({
              chunk,
              chunkNumber: currentChunk++,
              totalChunks: -1, // Unknown in streaming
              streamingMessage: deepSeekStreamingMessage,
              member,
              guest,
              thread,
              clientId,
              streamId,
            })
          }
        }

        if (!streamControllers.has(streamId)) {
          console.log("Stream was stopped, breaking loop")
          return NextResponse.json(
            { error: "Stream was stopped" },
            { status: 400 },
          )
        }

        console.timeEnd("fullProcessing")

        console.log("✅ DeepSeek response finished:", {
          textLength: finalText?.length,
        })

        // Handle tool-only responses with second AI call
        if (!finalText || finalText.trim().length === 0) {
          if (toolCallsDetected) {
            console.log(
              "⚠️ Tool called but no text generated - making second AI call for response",
            )

            try {
              const followUpResult = await generateText({
                model,
                messages: [
                  ...messages,
                  {
                    role: "assistant",
                    content:
                      "I've completed the requested action. Let me confirm what I did.",
                  },
                ],
              })

              finalText = followUpResult.text
              console.log(
                "✅ Generated follow-up response:",
                finalText.substring(0, 100),
              )

              // Stream the follow-up response to the user via WebSocket
              const streamingMessage = {
                message: {
                  id: clientId,
                  threadId: currentThreadId,
                  agentId: agent.id,
                  userId: member?.id,
                  guestId: guest?.id,
                  content: "",
                  isStreaming: true,
                },
                aiAgent: pauseDebate ? debateAgent : agent,
                user: member,
                guest: guest,
                thread: thread,
              }

              // Split response into words and stream them
              const words = finalText.split(" ")
              let currentChunk = 0

              for (const word of words) {
                await enhancedStreamChunk({
                  chunk: word + " ",
                  chunkNumber: currentChunk++,
                  totalChunks: -1, // Unknown in streaming
                  streamingMessage,
                  member,
                  guest,
                  thread,
                  clientId,
                  streamId,
                })
              }
            } catch (error) {
              console.error("❌ Failed to generate follow-up response:", error)
              // Fallback to simple message if second call fails
              finalText = "✓ Done"
            }
          } else {
            // No tools called and no text - this is an actual error
            console.error("❌ No AI response generated and no tools called")
            return NextResponse.json(
              { error: "No AI response generated" },
              { status: 400 },
            )
          }
        }

        await updateThread({
          ...thread,
          aiResponse:
            finalText.slice(0, 150) + (finalText.length > 150 ? "..." : ""), // Use first 50 chars as title
        })
        // Save AI response to database (no Perplexity processing for DeepSeek)
        const aiMessage = await createMessage({
          id: clientId,
          content: finalText.trim(),
          originalContent: finalText.trim(),
          threadId: currentThreadId,
          agentId: agent.id,
          userId: member?.id,
          guestId: guest?.id,
          searchContext,
          debateAgentId,
          pauseDebate,
          selectedAgentId: debateAgent?.id,
        })

        console.timeEnd("messageProcessing")

        if (!aiMessage) {
          return NextResponse.json(
            { error: "Failed to save DeepSeek response to DB" },
            { status: 500 },
          )
        }

        const m = await getMessage({ id: aiMessage.id })

        thread &&
          notifyOwnerAndCollaborations({
            notifySender: true,
            thread,
            payload: {
              type: "stream_complete",
              data: {
                message: m,
                isFinal: true,
              },
            },
            member,
            guest,
          })

        after(async () => {
          try {
            if (m && selectedAgent) {
              await generateAIContent({
                thread,
                user: member,
                guest,
                agentId: selectedAgent.id,
                conversationHistory: !suggestionMessages
                  ? messages
                  : [
                      { role: "system", content: enhancedSystemPrompt },
                      ...suggestionMessages,
                      enhancedUserMessage,
                    ],
                language,
                latestMessage: m.message,
                app,
                skipClassification: !!app,
              })
            }
          } catch (error) {
            console.error("❌ Background content generation failed:", error)
            captureException(error, {
              tags: {
                type: "background_task",
                task: "content_generation",
                threadId: thread.id,
                userId: member?.id || guest?.id,
              },
            })
          }
        })

        return NextResponse.json({ success: true })
      } catch (error: unknown) {
        clearTimeout(timeoutId!) // Clear the timeout on error
        if (error instanceof Error && error.message.includes("timed out")) {
          console.error("❌", error.message)
          captureException(error)
          return NextResponse.json(
            { error: "Request timed out. Please try again." },
            { status: 504 }, // 504 Gateway Timeout
          )
        }
        console.error("❌ Error in DeepSeek API call:", error)
        captureException(error)
        return NextResponse.json(
          { error: "Failed to generate response" },
          { status: 500 },
        )
      } finally {
        clearTimeout(timeoutId!) // Clean up the timeout
      }
    } else {
      console.log("🔄 Other provider streaming path:", agent.name)
      console.log("📤 Sending to provider:", {
        content: content?.substring(0, 100),
      })

      let finalText = ""
      let responseMetadata: any = null
      let toolCallsDetected = false

      // Use messages format for other providers
      const result = streamText({
        model,
        messages,
        maxRetries: 3,
        temperature: app?.temperature ?? 0.7,
        tools: allTools,
        async onFinish({ text, usage, response, sources, toolCalls }) {
          finalText = text
          responseMetadata = response
          toolCallsDetected = toolCalls && toolCalls.length > 0

          // Capture sources for Perplexity
          if (agent.name === "perplexity" && sources) {
            responseMetadata = { ...response, sources }
            console.log(
              "🎯 Perplexity sources found:",
              JSON.stringify(sources, null, 2),
            )
          }

          console.log("✅ Provider response finished:", {
            provider: agent.name,
            textLength: text?.length,
            usage,
            response: response ? Object.keys(response) : "no response object",
            sources: sources ? `${sources.length} sources` : "no sources",
          })

          // Log full response for Perplexity to find citation URLs
          if (agent.name === "perplexity") {
            console.log(
              "🔍 Full Perplexity response object:",
              JSON.stringify(response, null, 2),
            )
          }
        },
      })

      // Convert to text stream response for streaming
      const stream = result.toTextStreamResponse()
      const reader = stream.body?.getReader()

      if (!reader) {
        console.error("❌ Failed to get stream reader")
        captureException("❌ Failed to get stream reader")
        throw new Error("Failed to initialize stream reader")
      }

      const controller: StreamController = {
        close: () => reader?.cancel(),
        desiredSize: null,
        enqueue: () => {},
        error: () => {},
      }
      streamControllers.set(streamId, controller)

      // Create AI message structure for streaming chunks
      const streamingMessage = {
        message: {
          id: clientId,
          threadId: currentThreadId,
          agentId: agent.id,
          userId: member?.id,
          guestId: guest?.id,
          content: "",
          isStreaming: true,
        },
        aiAgent: pauseDebate ? debateAgent : agent,
        user: member,
        guest: guest,
        thread: thread,
      }

      let currentChunk = 0
      let hasReceivedContent = false
      try {
        while (true) {
          if (!streamControllers.has(streamId)) {
            break
          }
          const { done, value } = await reader.read()
          if (done) break

          const chunk = new TextDecoder().decode(value)
          if (chunk && chunk.trim().length > 0) {
            hasReceivedContent = true
          }
          await enhancedStreamChunk({
            chunk,
            chunkNumber: currentChunk++,
            totalChunks: -1, // Unknown in streaming
            streamingMessage,
            member,
            guest,
            thread,
            clientId,
            streamId,
          })
        }
      } catch (streamError) {
        console.error("❌ Stream reading error:", streamError)
        throw new Error("Failed to read AI response stream")
      } finally {
        reader.releaseLock()
      }

      if (!streamControllers.has(streamId)) {
        console.log("Stream was stopped, breaking loop")
        return NextResponse.json(
          { error: "Stream was stopped" },
          { status: 400 },
        )
      }

      // Validate that we got a response (either via finalText or streaming chunks)
      // Note: With tool calls, content may come via streaming even if finalText is empty
      if (!finalText && !hasReceivedContent) {
        // Only provide fallback message if tools were actually called
        if (toolCallsDetected) {
          console.log(
            "⚠️ Tool called but no text generated - making second AI call for response",
          )

          // Make a second AI call to generate a natural response based on tool execution
          try {
            const followUpResult = await generateText({
              model,
              messages: [
                ...messages,
                {
                  role: "assistant",
                  content:
                    "I've completed the requested action. Let me confirm what I did.",
                },
              ],
            })

            finalText = followUpResult.text
            console.log(
              "✅ Generated follow-up response:",
              finalText.substring(0, 100),
            )

            // Stream the follow-up response to the user via WebSocket
            const followUpStreamingMessage = {
              message: {
                id: clientId,
                threadId: currentThreadId,
                agentId: agent.id,
                userId: member?.id,
                guestId: guest?.id,
                content: "",
                isStreaming: true,
              },
              aiAgent: pauseDebate ? debateAgent : agent,
              user: member,
              guest: guest,
              thread: thread,
            }

            // Split response into words and stream them
            const words = finalText.split(" ")
            let followUpChunk = 0

            for (const word of words) {
              await enhancedStreamChunk({
                chunk: word + " ",
                chunkNumber: followUpChunk++,
                totalChunks: -1, // Unknown in streaming
                streamingMessage: followUpStreamingMessage,
                member,
                guest,
                thread,
                clientId,
                streamId,
              })
            }
          } catch (error) {
            console.error("❌ Failed to generate follow-up response:", error)
            // Fallback to simple message if second call fails
            finalText = "✓ Done"
          }
        } else {
          // No tools called and no text - this is an actual error
          console.error("❌ No AI response generated and no tools called")
          captureException("❌ No AI response generated")
          return NextResponse.json(
            { error: "No AI response generated" },
            { status: 400 },
          )
        }
      }

      if (finalText && finalText.trim().length > 0) {
        console.log("✅ Final text captured:", finalText.substring(0, 100))
      } else if (hasReceivedContent) {
        console.log("✅ Response received via streaming chunks")
      }

      await updateThread({
        ...thread,
        aiResponse:
          finalText.slice(0, 150) + (finalText.length > 150 ? "..." : ""), // Use first 50 chars as title
      })
      // Process Perplexity response and extract web search results
      const { processedText, webSearchResults } = processPerplexityResponse(
        finalText,
        agent.name,
        responseMetadata,
      )

      // Save AI response to database
      const aiMessage = await createMessage({
        id: clientId,
        content: processedText,
        originalContent: finalText.trim(),
        threadId: currentThreadId,
        agentId: agent.id,
        userId: member?.id,
        guestId: guest?.id,
        searchContext,
        webSearchResult: webSearchResults,
        debateAgentId,
        pauseDebate,
        isWebSearchEnabled: message.message.isWebSearchEnabled,
        selectedAgentId: debateAgent?.id,
      })

      console.timeEnd("messageProcessing")

      if (!aiMessage) {
        return NextResponse.json(
          { error: "Failed to save AI response to DB" },
          { status: 500 },
        )
      }

      const m = await getMessage({ id: aiMessage.id })

      // Process AI message for RAG embeddings in background
      if (m?.message && !isE2E) {
        processMessageForRAG({
          messageId: m.message.id,
          content: m.message.content,
          threadId: m.message.threadId,
          userId: m.message.userId || undefined,
          guestId: m.message.guestId || undefined,
          role: "assistant",
        }).catch((error) => {
          captureException(error)
          console.error("❌ AI Message RAG processing failed:", error)
          // Don't block user experience on RAG processing failure
        })
      }

      thread &&
        notifyOwnerAndCollaborations({
          notifySender: true,
          thread,
          payload: {
            type: "stream_complete",
            data: {
              message: m,
              isFinal: true,
            },
          },
          member,
          guest,
        })

      console.log("💾 AI response saved to DB")

      // Reinforce memories that were used in this response (spaced repetition)
      if (memoryIds.length > 0) {
        after(async () => {
          try {
            console.log(
              `🧠 Reinforcing ${memoryIds.length} memories used in response`,
            )
            await Promise.all(
              memoryIds.map((memoryId) => reinforceMemory(memoryId)),
            )
          } catch (error) {
            console.error("❌ Memory reinforcement failed:", error)
          }
        })
      }

      // Background processing with DeepSeek for content generation
      after(async () => {
        try {
          if (m && selectedAgent) {
            await generateAIContent({
              thread,
              user: member,
              guest,
              agentId: selectedAgent.id,
              conversationHistory: !suggestionMessages
                ? messages
                : [
                    { role: "system", content: enhancedSystemPrompt },
                    ...suggestionMessages,
                    enhancedUserMessage,
                  ],
              latestMessage: m.message,
              language,
              calendarEvents,
              app, // Pass app object directly
              skipClassification: !!app, // Skip AI classification if app is set
            })
          }
        } catch (error) {
          console.error("❌ Background content generation failed:", error)
          captureException(error, {
            tags: {
              type: "background_task",
              task: "content_generation",
              threadId: thread.id,
              userId: member?.id || guest?.id,
            },
          })
        }
      })

      console.log("📡 Returning provider stream response")

      return NextResponse.json({
        success: true,
        message: "Agent processing started",
      })
    }
  } catch (error) {
    captureException(error)
    console.error("❌ AI streaming error:", error)
    console.error("❌ Error details:", {
      name: (error as any)?.name,
      message: (error as any)?.message,
      stack: (error as any)?.stack?.substring(0, 500),
    })
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 },
    )
  }
}
