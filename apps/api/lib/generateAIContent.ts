import {
  and,
  type app,
  type calendarEvent,
  type collaboration,
  createCharacterTag,
  createInstruction,
  createMemory,
  createMood,
  createPlaceHolder,
  createThreadSummary,
  db,
  eq,
  getApps,
  getCharacterTag,
  getMoods,
  getPlaceHolder,
  getTasks,
  getThreadSummary,
  getTimer,
  type guest,
  isNull,
  isOwner,
  type message,
  retroSessions,
  type thread,
  type threadSummary,
  updateCharacterTag,
  updatePlaceHolder,
  updateThreadSummary,
  type user,
} from "@repo/db"
import { instructions, threads } from "@repo/db/src/schema"
import { v4 as uuidv4 } from "uuid"

const memorySchema = z.array(
  z.object({
    title: z.string().optional(),
    content: z.string(),
    tags: z.array(z.string()).optional(),
    category: z
      .enum([
        "preference",
        "fact",
        "context",
        "instruction",
        "relationship",
        "goal",
        "character",
      ])
      .optional(),
    importance: z.number().optional(),
  }),
)

type MemoryData = z.infer<typeof memorySchema>

import type { appWithStore } from "@chrryai/chrry/types"
import { generateText, type ModelMessage } from "ai"
import type { Context } from "hono"
import { z } from "zod"
import { captureException } from "../lib/captureException"
import { getModelProvider } from "./getModelProvider"
import { checkThreadSummaryLimit } from "./index"
import { notifyOwnerAndCollaborations } from "./notify"

// Smart context retrieval from memories

// Extract memories from conversation (without saving to database)
async function extractMemories(conversationText: string, model: any) {
  const memoryPrompt = `Based on this conversation, extract meaningful memories:

CONVERSATION:
${conversationText}

Extract THREE types of memories:
1. USER MEMORIES: Personal information about this specific user (preferences, relationships, personal facts, goals, settings)
2. APP/GENERAL MEMORIES: Universal knowledge useful for ALL users (facts, instructions)
3. APP CHARACTER PROFILE: General personality traits, communication style, and character of THIS app (non-private, general observations)

Category guide:
- "preference" = User's personal preferences (USER memory)
- "relationship" = User's connections with others (USER memory)
- "goal" = User's personal goals (USER memory)
- "context" = User-specific patterns, settings, or behavioral insights (USER memory)
- "fact" = Universal/general knowledge useful for ALL users (APP memory)
- "instruction" = How to do something, general how-to knowledge (APP memory)
- "character" = App's personality, communication style, tone, behavior patterns (APP CHARACTER PROFILE)

USER MEMORY EXAMPLES:
- "Cross-conversation memory is ENABLED for this user" (category: context)
- "User prefers detailed technical explanations" (category: preference)
- "User is a React developer working on e-commerce" (category: context)
- "User's goal is to learn TypeScript" (category: goal)

APP MEMORY EXAMPLES:
- "This app supports file uploads up to 50MB" (category: fact)
- "To create a task, use the /task command" (category: instruction)
- "React hooks were introduced in version 16.8" (category: fact)

APP CHARACTER PROFILE EXAMPLES:
- "This app uses casual, friendly tone with emojis" (category: character)
- "This app tends to give concise, technical answers" (category: character)
- "This app asks clarifying questions before answering" (category: character)
- "This app uses Turkish slang and informal language" (category: character)

⚠️ CRITICAL: 
- User settings, personal patterns, and behavioral insights are USER memories (category: context), NOT app memories.
- App character profiles should be GENERAL observations about the app's style, NOT user-specific info.

Generate ONLY a valid JSON array with no additional text (max 5 memories):
[
  {
    "title": "Short memory title",
    "content": "Detailed memory content",
    "category": "preference|fact|context|instruction|relationship|goal|character",
    "importance": 1-10,
    "tags": ["tag1", "tag2"]
  }
]

Return only valid JSON array.`

  const memoryResult = await generateText({
    model,
    prompt: memoryPrompt,
  })

  let memories: MemoryData = []
  try {
    let jsonText = memoryResult.text.trim()
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "")
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "")
    }
    const parsedData = JSON.parse(jsonText)
    memories = memorySchema.parse(parsedData)
  } catch (error) {
    captureException(error)
    console.log("⚠️ Failed to parse or validate memories:", error)
  }

  return memories
}

// Extract and save memories from conversation
async function extractAndSaveMemories(
  conversationText: string,
  model: any,
  modelName: string,
  userId?: string,
  guestId?: string,
  appId?: string,
  threadId?: string,
  messageId?: string,
  memoriesEnabled?: boolean,
) {
  const memories = await extractMemories(conversationText, model)

  // Determine if memory should be user-scoped or app-scoped
  // App memories: knowledge that's useful for ALL users of this app
  // User memories: personal information about THIS user

  // Create memories in database
  for (const memory of memories.slice(0, 5)) {
    try {
      // Check if this should be an app memory or user memory
      // App memories: facts, instructions, and character profiles (universal knowledge)
      // User memories: preferences, context, relationships, goals (personal info)
      let isAppMemory =
        appId &&
        (memory.category === "fact" ||
          memory.category === "instruction" ||
          memory.category === "character")
      // Note: "context" is now treated as USER memory by default

      // Safety check: Never store user-specific content as app memory
      if (isAppMemory) {
        const userSpecificKeywords = [
          "user is",
          "user has",
          "user prefers",
          "user wants",
          "their",
          "they",
          "personal",
          "settings",
          "enabled",
          "disabled",
          "this user",
          "the user",
        ]
        const contentLower = memory.content.toLowerCase()
        const hasUserSpecificContent = userSpecificKeywords.some((keyword) =>
          contentLower.includes(keyword),
        )

        if (hasUserSpecificContent) {
          console.log(
            `⚠️ Reclassifying as user memory (user-specific content detected): ${memory.title}`,
          )
          isAppMemory = false
        }
      }

      if (isAppMemory || memoriesEnabled) {
        await createMemory({
          userId: isAppMemory ? null : userId || null,
          guestId: isAppMemory ? null : guestId || null,
          appId: isAppMemory ? appId : null,
          content: memory.content,
          title: memory.title || "Memory",
          tags: memory.tags || [],
          category: memory.category || "context",
          importance: memory.importance || 5,
          usageCount: 0,
          sourceThreadId: threadId || null,
          sourceMessageId: messageId || null,
          metadata: {
            extractedBy: modelName,
            confidence: 0.8,
            relatedMemories: [],
          },
        })
        console.log(
          `✅ Created ${isAppMemory ? "app" : "user"} memory: ${memory.title}`,
        )
      }
    } catch (error) {
      captureException(error)
      console.error("❌ Failed to create memory:", error)
    }
  }

  return memories
}

// Type for suggestions payload (matches schema in users/guests table)
export type suggestionsPayload = {
  instructions: Array<{
    id: string
    title: string
    emoji: string
    content: string
    confidence: number
    generatedAt: string
    requiresWebSearch?: boolean
  }>
  lastGenerated: string
}

// Smart conversation context that preserves recent messages while summarizing older ones
const safeTruncate = (
  str: string,
  maxChars: number,
  fromEnd = false,
): string => {
  if (str.length <= maxChars) return str
  const sliced = fromEnd ? str.slice(-maxChars) : str.slice(0, maxChars)
  // Remove lone surrogates that may appear at slice boundaries
  return sliced.replace(/[\uD800-\uDFFF]/g, (ch) => {
    const code = ch.charCodeAt(0)
    // High surrogate without following low surrogate — remove
    if (code >= 0xd800 && code <= 0xdbff) return ""
    // Low surrogate without preceding high surrogate — remove
    return ""
  })
}

const getSmartConversationContext = (
  conversationText: string,
  maxChars: number = 2000,
): string => {
  if (conversationText.length <= maxChars) {
    return conversationText
  }

  // Split into messages
  const messages = conversationText.split("\n")

  if (messages.length <= 15) {
    // Short conversation - use all
    return conversationText
  }

  // For long conversations, use hybrid approach:
  // 1. Summary of very old messages (before last 20)
  const veryOldMessages = messages.slice(0, -20)
  const oldSummary =
    veryOldMessages.length > 0
      ? `[Earlier: ${veryOldMessages.length} messages]\n`
      : ""

  // 2. Compressed middle messages (last 20 to last 10)
  const middleMessages = messages.slice(-20, -10)
  const middleCompressed = middleMessages
    .map((m) => safeTruncate(m, 100) + (m.length > 100 ? "..." : ""))
    .join("\n")

  // 3. Full recent messages (last 10)
  const recentMessages = messages.slice(-10).join("\n")

  const result = `${oldSummary}${middleCompressed}\n\n${recentMessages}`

  // If still too long, truncate to maxChars
  return result.length > maxChars
    ? safeTruncate(result, maxChars, true)
    : result
}

// Extract topic keywords from conversation (lightweight alternative to full context)
const extractTopicKeywords = (text: string): string[] => {
  // Simple keyword extraction - you can make this smarter later
  const keywords = new Set<string>()
  const commonWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "up",
    "about",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "both",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "can",
    "will",
    "just",
    "should",
    "now",
  ])

  // Extract words (alphanumeric + common tech symbols)
  const words = text.toLowerCase().match(/\b[\w+#-]+\b/g) || []

  words.forEach((word) => {
    if (word.length > 3 && !commonWords.has(word)) {
      keywords.add(word)
    }
  })

  return Array.from(keywords).slice(0, 10) // Top 10 keywords
}

// Unified function to generate app-aware instructions and placeholders
async function generateSuggestionsAndPlaceholders({
  conversationText,
  memories,
  language,
  thread,
  user,
  guest,
  latestMessage,
  calendarEvents,
  skipClassification = false,
  model,
  modelName,
  c,
  isRetro = false, // ✅ Retro mode flag
  ...rest
}: {
  c: Context
  conversationText: string
  memories: MemoryData
  language: string
  thread: thread & {
    user?: user | null
    guest?: guest | null
    collaborations?: {
      collaboration: collaboration
      user: user
    }[]
  }
  user?: user | null
  guest?: guest | null
  latestMessage: message
  calendarEvents?: calendarEvent[]
  app?: app | appWithStore
  skipClassification?: boolean
  model: any
  modelName: string
  isRetro?: boolean // ✅ Retro mode flag
}) {
  const app = rest.app
  // Get all apps for classification
  const apps = await getApps()
  const appDescriptions = apps.items
    .map(
      (a) =>
        `- ${a.name}: ${a.description}\n  Active Features: ${Object.keys(
          a.features || {},
        )
          .filter((k) => a.features?.[k])
          .join(", ")}`,
    )
    .join("\n")

  // Format calendar events for context
  const calendarContext =
    calendarEvents && calendarEvents.length > 0
      ? `\n\nUPCOMING CALENDAR EVENTS:\n${calendarEvents.map((e) => `- ${e.title} (${new Date(e.startTime).toLocaleDateString()})${e.location ? ` at ${e.location}` : ""}`).join("\n")}`
      : ""

  const characterProfilesEnabled =
    user?.characterProfilesEnabled || guest?.characterProfilesEnabled
  // Bloom-specific: Add focus & productivity context
  let bloomContext = ""
  if (app && "store" in app) {
    try {
      const subjectId = user?.id || guest?.id
      if (subjectId) {
        const [moodsData, tasksData, timer] = await Promise.all([
          characterProfilesEnabled
            ? getMoods({ userId: user?.id, guestId: guest?.id, pageSize: 15 })
            : null, // ~2 weeks
          getTasks({ userId: user?.id, guestId: guest?.id, pageSize: 20 }), // Recent tasks
          getTimer({ userId: user?.id, guestId: guest?.id }),
        ])

        const moods = moodsData?.moods || []
        const tasks = tasksData?.tasks || []

        const avgMood =
          moods.length > 0
            ? (
                moods.reduce((s: number, m: any) => s + (m.rating || 0), 0) /
                moods.length
              ).toFixed(1)
            : null
        const activeTasks = tasks.filter((t: any) => !t.completed).length
        const focusTime = tasks.reduce(
          (s: number, l: any) => s + (l.duration || 0),
          0,
        )

        bloomContext = `\n\nBLOOM CONTEXT (Focus & Productivity):
- Mood (7d avg): ${avgMood || "N/A"}/5
- Active tasks: ${activeTasks}
- Focus time (7d): ${focusTime}min
- Timer status: ${timer?.isCountingDown ? "Running" : "Stopped"}`
      }
    } catch (error) {
      captureException(error)
      console.error("Failed to fetch Bloom context:", error)
    }
  }

  // Use current app's highlights as examples for AI
  // This gives the AI strong context about what features are available
  const currentApp = app || null
  const appHighlights = currentApp?.highlights || []
  const appTipsTitle = currentApp?.tipsTitle || null

  console.log(
    `🎯 Current app: ${currentApp?.name || "none"} with ${appHighlights.length} highlights${appTipsTitle ? ` and tips: "${appTipsTitle}"` : ""}`,
  )

  // Check if user is admin for SATO MODE
  const isAdmin =
    user?.role === "admin" &&
    !thread.tribeId &&
    !thread.isMolt &&
    !thread.isTribe

  const suggestionsPrompt = `Based on this conversation, user memories, and calendar, generate personalized AI instruction templates AND classify the app relevance:

CONVERSATION:
${conversationText.slice(-2000)} // Last 2000 chars

MEMORIES:
${memories.map((m) => `- ${m.content}`).join("\n")}${calendarContext}${bloomContext}

${
  isAdmin
    ? `
🔥 SATO MODE ACTIVE (Admin User):
⚠️ CRITICAL: This is an ADMIN user. Generate placeholders and instructions with "SATO" vibes:
- System health checks ("Sato mu?", "E2E sato mu?", "API sato mu?")
- Performance monitoring ("Hocam mermi gibi mi?", "Gıcır gıcır çalışıyor mu?")
- Technical deep-dives and debugging
- Architecture decisions and optimizations
- Turkish-English mix with technical slang
- Confident, efficient, "bam" energy

PLACEHOLDER REQUIREMENTS FOR SATO MODE:
- "home": System status check (e.g., "Sato mu hocam? 🔥", "Ne yapalım hocam? 💪")
- "thread": Technical follow-up (e.g., "Bam gibi mi? ⚡", "Mermi gibi massallah 🚀")

INSTRUCTION REQUIREMENTS FOR SATO MODE:
- Focus on system checks, performance, debugging
- Use Turkish-English technical mix
- Include: "Check E2E tests", "Analyze API performance", "Review system health"
- Tone: Confident, efficient, technical, "Sato" energy
- Examples: "Sato mu raporu ver", "E2E testleri kontrol et", "Performance metrics göster"
`
    : isRetro
      ? `
🍐 RETRO MODE ACTIVE (Daily Check-In Session):
⚠️ CRITICAL: This is a daily reflection/check-in session. Generate placeholders and instructions specifically for:
- Reflecting on today's accomplishments
- Planning tomorrow's priorities
- Mood tracking and emotional check-in
- Goal progress review
- Gratitude and mindfulness prompts

PLACEHOLDER REQUIREMENTS FOR RETRO MODE:
- "home": Welcoming message for daily check-in (e.g., "How was your day today? 🌟")
- "thread": Follow-up reflection prompt (e.g., "What went well today? 💭")

INSTRUCTION REQUIREMENTS FOR RETRO MODE:
- Focus on reflection, planning, and self-awareness
- Include mood tracking, gratitude, goal review
- Keep tone warm, supportive, and encouraging
- Examples: "Reflect on today's wins", "Plan tomorrow's top 3 priorities", "Track your mood and energy"
`
      : ""
}

⚠️ IMPORTANT: The BLOOM CONTEXT above is for generating relevant suggestions only. DO NOT:
- Analyze or interpret the mood/focus data directly
- Make assumptions about user's mental state
- Suggest therapy or medical advice  
- Create instructions that explicitly reference mood scores
Use this data ONLY to understand user's productivity patterns for better suggestion relevance.

AVAILABLE LIFEOS APPS (only classify if conversation is SPECIFICALLY about these domains):
${appDescriptions}

IMPORTANT: Most conversations should be classified as null (general). Only use an app classification if the conversation is clearly focused on that app's specific domain.
${
  currentApp
    ? `
🎯 CURRENT APP CONTEXT: User is on ${currentApp.name}${appTipsTitle ? ` - ${appTipsTitle}` : ""}
⚠️ CRITICAL: Generate suggestions that align with these app highlights and features:
${appHighlights.length > 0 ? JSON.stringify(appHighlights, null, 2) : "No highlights configured for this app"}

Use these highlights as STRONG GUIDANCE for suggestion generation. The suggestions should help users accomplish tasks related to these specific features.
Create NEW suggestions inspired by these patterns but personalized to the user's conversation.
`
    : `
⚠️ No app context - generate general suggestions based on the conversation topics.
`
}

Generate a JSON object with TWO parts:

1. "suggestions": Array of 7 UNIQUE, PERSONALIZED instruction templates
   ⚠️ CRITICAL: Each instruction must be DIFFERENT from the examples and from each other
   ⚠️ Base instructions on the USER'S ACTUAL conversation topics, not generic templates
   ⚠️ If user discussed specific topics (e.g., "React hooks"), create instructions about those topics
   ⚠️ DO NOT generate generic instructions like "Help with code" - be SPECIFIC

2. "placeholders": Object with two placeholders:
   - "home": Based on user's MEMORIES (what they care about across all conversations)
   - "thread": Based on THIS CONVERSATION (what we just discussed)

IMPORTANT: Keep Title length max 40 characters. Placeholders max 60 characters.

Return ONLY valid JSON in this exact format:
{
  "suggestions": [
    {
      "id": "unique-id",
      "title": "Find restaurants in {{city}} {{flag}}",
      "emoji": "🍜",
      "content": "You are a food expert in {{location}}. Current weather: {{temp}} {{weatherEmoji}}. Recommend dining options for {{timeOfDay}}.",
      "confidence": 0.8,
      "requiresWebSearch": true
    },
    {
      "id": "unique-id-2",
      "title": "Plan {{timeOfDay}} activities",
      "emoji": "🎯",
      "content": "Suggest activities for {{timeOfDay}} considering {{weather}}. Focus on user's interests and local options.",
      "confidence": 0.7,
      "requiresWebSearch": false
    },
    {
      "id": "unique-id-3",
      "title": "Design agent personality",
      "emoji": "🤖",
      "content": "You are a creative AI personality designer. Help create unique agent personalities with distinct traits, communication styles, and expertise areas.",
      "confidence": 0.9,
      "requiresWebSearch": false
    }
  ],
  "placeholders": {
    "home": "Ready to continue that Python project? 🐍",
    "thread": "Want to explore more TypeScript patterns? 💭"
  }
}

PLACEHOLDER RULES:
- Home placeholder: Reference user's recurring interests from MEMORIES (hobbies, work, goals)
- Thread placeholder: Reference what we JUST talked about in this conversation
- Both should feel warm, personal, and inviting
- Include ONE relevant emoji
- Max 60 characters each
- Use ${language} language

INSTRUCTION RULES:
⚠️ CRITICAL: DO NOT COPY THE EXAMPLES! Create NEW instructions based on:
  1. User's conversation content and context
  2. User's memories and interests
  3. Calendar events and upcoming activities
  4. Current app's highlights and features (if provided above)
  5. The STYLE (not content) of the examples

- Create instructions that align with the current app's capabilities and features
- Set "requiresWebSearch": true for instructions needing real-time data (flights, weather, events, etc.)
- Focus on user's SPECIFIC topics, not generic templates
- Make each instruction UNIQUE and PERSONALIZED to this user's conversation
- Generate all content in ${language}
- Use similar emoji style and placeholder patterns as examples, but DIFFERENT content
- ⚠️ IMPORTANT: DO NOT include emojis in the "title" field - they go in the separate "emoji" field only

DYNAMIC PLACEHOLDER SYSTEM:
- You can use {{placeholder}} syntax in BOTH title and content fields
- These placeholders are AUTOMATICALLY FILLED by the frontend with real-time user context
- ⚠️ CRITICAL: ONLY USE THESE EXACT PLACEHOLDERS - NO CUSTOM PLACEHOLDERS ARE SUPPORTED:
  * {{city}} - User's current city (e.g., "Tokyo")
  * {{country}} - User's current country (e.g., "Japan")
  * {{flag}} - Country flag emoji (e.g., "🇯🇵")
  * {{location}} - Full location (e.g., "Tokyo, Japan")
  * {{temp}} - Current temperature (e.g., "15°C")
  * {{weather}} - Weather description (e.g., "Current weather: 15°C ☀️")
  * {{weatherEmoji}} - Weather emoji (e.g., "☀️", "🌧️", "☁️", "❄️")
  * {{timeOfDay}} - Time period (e.g., "morning", "afternoon", "evening", "night")
- ❌ NEVER CREATE CUSTOM PLACEHOLDERS like {{topic}}, {{movie}}, {{duration}}, {{name}}, {{project}}, etc.
- ❌ If you need specific content, write it directly - DO NOT use placeholders for it
- ✅ For emojis: Put actual emoji characters directly in the text, NOT placeholders
- ✅ For specific topics: Write them directly (e.g., "Analyze React hooks" NOT "Analyze {{topic}}")
- Examples of CORRECT usage:
  * Title: "Find best restaurants in {{city}} {{flag}}"
  * Content: "You are a food expert in {{location}}. Weather: {{temp}} {{weatherEmoji}}"
  * Title: "Plan {{timeOfDay}} activities {{weatherEmoji}}"
  * Content: "Suggest activities for {{timeOfDay}} in {{city}}. Consider {{weather}}"
- Examples of INCORRECT usage:
  * ❌ "Analyze film {{movie}} scenes" - Write specific movie or make it general
  * ❌ "Start {{duration}} focus session" - Write specific duration or make it general
  * ❌ "Research {{topic}} with citations" - Write specific topic or make it general
- Use placeholders ONLY for location, weather, and time context
- For everything else, be specific based on the conversation or keep it general

CRITICAL PLACEHOLDER RULES:
- NEVER hardcode time-specific values like "morning", "afternoon", "evening" - use {{timeOfDay}} instead
- NEVER hardcode weather emojis like "☀️", "🌧️" - use {{weatherEmoji}} instead
- NEVER hardcode temperature values - use {{temp}} instead
- NEVER hardcode city/country names - use {{city}}, {{country}}, {{location}}, or {{flag}} instead
- Instructions must work at ANY time of day with ANY weather conditions
- Bad example: "Plan morning activities in Tokyo ☀️" (hardcoded morning and sunny)
- Good example: "Plan {{timeOfDay}} activities in {{city}} {{weatherEmoji}}" (dynamic for all times/weather)

PLACEHOLDER PRIORITY (most specific to least specific):
- PREFER {{city}} over {{country}} - cities are more specific and personal
  * Good: "Find restaurants in {{city}} {{flag}}"
  * Avoid: "Find restaurants in {{country}}"
- Use {{location}} when you need both city and country together
  * Example: "You are a local expert in {{location}}" → "You are a local expert in Tokyo, Japan"
- Use {{country}} only for country-specific topics (visas, taxes, regulations)
  * Example: "Get visa requirements for {{country}}"
- Always add {{flag}} after {{city}} or {{country}} for visual appeal
  * Example: "Explore {{city}} {{flag}}" → "Explore Tokyo 🇯🇵"

Return only valid JSON object.`

  const suggestionsResult = await generateText({
    model,
    prompt: suggestionsPrompt,
  })

  const threadRow = await db
    .select({ id: threads.id })
    .from(threads)
    .where(
      and(
        eq(threads.id, thread.id),
        user?.id ? eq(threads.userId, user.id) : undefined,
        guest?.id ? eq(threads.guestId, guest.id) : undefined,
      ),
    )
    .limit(1)

  if (threadRow.length === 0) {
    return
  }

  const responseSchema = z.object({
    suggestions: z.array(
      z.object({
        id: z.string().optional(),
        title: z.string(),
        emoji: z.string(),
        content: z.string(),
        confidence: z.number().optional(),
        requiresWebSearch: z.boolean().optional(),
      }),
    ),
    placeholders: z.object({
      home: z.string(),
      thread: z.string(),
    }),
  })

  type ResponseData = z.infer<typeof responseSchema>
  let responseData: ResponseData = {
    suggestions: [],
    placeholders: { home: "", thread: "" },
  }

  try {
    let jsonText = suggestionsResult.text.trim()
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "")
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "")
    }
    const parsedData = JSON.parse(jsonText)
    responseData = responseSchema.parse(parsedData)
  } catch (error) {
    captureException(error)
    console.log("⚠️ Failed to parse or validate response:", error)
    responseData = {
      suggestions: [],
      placeholders: { home: "", thread: "" },
    }
  }

  // Since we always have app context, use it directly
  const finalAppId = app?.id || null

  let homePlaceholder
  // Save placeholders to database with history
  // If user is on a specific app, use app-specific placeholder
  if (responseData.placeholders.home) {
    homePlaceholder = await getPlaceHolder({
      userId: user?.id,
      guestId: guest?.id,
      appId: finalAppId || undefined, // ✅ App-specific placeholder
    })

    // Verify ownership as extra safety layer
    if (
      homePlaceholder &&
      !isOwner(homePlaceholder, { userId: user?.id, guestId: guest?.id })
    ) {
      console.warn("⚠️ Ownership mismatch for home placeholder - rejecting")
      homePlaceholder = null
    }

    if (homePlaceholder) {
      // Preserve history
      const history = homePlaceholder.metadata?.history || []

      // Extract topic keywords (lighter than full context)
      const topicKeywords = extractTopicKeywords(conversationText)

      history.push({
        text: homePlaceholder.text,
        generatedAt: homePlaceholder.updatedOn.toISOString(),
        topicKeywords, // Lightweight, privacy-safe alternative
      })

      homePlaceholder = await updatePlaceHolder({
        ...homePlaceholder,
        text: responseData.placeholders.home,
        updatedOn: new Date(),
        metadata: {
          ...homePlaceholder.metadata,
          history: history.slice(-10), // Keep last 10 versions
          generatedBy: modelName,
        },
      })
    } else {
      homePlaceholder = await createPlaceHolder({
        text: responseData.placeholders.home,
        userId: user?.id || null,
        guestId: guest?.id || null,
        appId: finalAppId || null, // ✅ Link to app
        threadId: null,
        metadata: {
          generatedBy: modelName,
          history: [],
        },
      })

      // If placeholder creation failed (e.g., guest doesn't exist), log and continue
      if (!homePlaceholder) {
        console.warn("⚠️ Home placeholder creation failed - guest may not exist")
      }
    }
  }

  let threadPlaceHolder
  if (responseData.placeholders.thread) {
    try {
      threadPlaceHolder = await getPlaceHolder({
        threadId: thread.id,
        userId: user?.id,
        guestId: guest?.id,
      })

      // Verify ownership as extra safety layer
      if (
        threadPlaceHolder &&
        !isOwner(threadPlaceHolder, { userId: user?.id, guestId: guest?.id })
      ) {
        console.warn("⚠️ Ownership mismatch for thread placeholder - rejecting")
        threadPlaceHolder = null
      }

      if (threadPlaceHolder) {
        // Preserve history
        const history = threadPlaceHolder.metadata?.history || []
        const topicKeywords = extractTopicKeywords(conversationText)

        history.push({
          text: threadPlaceHolder.text,
          generatedAt: threadPlaceHolder.updatedOn.toISOString(),
          topicKeywords, // Lightweight, privacy-safe alternative
        })

        threadPlaceHolder = await updatePlaceHolder({
          ...threadPlaceHolder,
          text: responseData.placeholders.thread,
          updatedOn: new Date(),
          metadata: {
            ...threadPlaceHolder.metadata,
            history: history.slice(-10), // Keep last 10 versions
            generatedBy: modelName,
          },
        })
      } else {
        threadPlaceHolder = await createPlaceHolder({
          text: responseData.placeholders.thread,
          userId: user?.id || null,
          guestId: guest?.id || null,
          threadId: thread.id,
          appId: finalAppId || null, // ✅ Link to app
          metadata: {
            generatedBy: modelName,
            history: [],
          },
        })

        // If placeholder creation failed (e.g., guest doesn't exist), log and continue
        if (!threadPlaceHolder) {
          console.warn(
            "⚠️ Thread placeholder creation failed - guest may not exist",
          )
        }
      }
    } catch (error) {
      captureException(error)

      // Gracefully handle thread not committed yet or deleted
      const err = error as any
      if (
        err?.cause?.constraint_name === "placeHolders_threadId_threads_id_fk"
      ) {
        console.log(
          `⏭️  Skipping thread placeholder - thread not committed yet or deleted`,
        )
        threadPlaceHolder = null
      } else {
        // Handle foreign key constraint violation gracefully
        // This can happen when thread isn't fully committed yet (especially for guests)
        console.warn(
          `⚠️ Skipping thread placeholder creation - thread may not be committed yet:`,
          error,
        )
        threadPlaceHolder = null
      }
    }
  }

  // Use current app ID for instructions
  const appId: string | null = app?.id || null
  if (appId) {
    console.log(`✅ Instructions linked to app: ${app?.name}`)
  }

  // Save instructions to new instructions table (limit to 7)
  const createdInstructions = []
  for (const suggestion of responseData.suggestions.slice(0, 7)) {
    try {
      // Check if instruction already exists to prevent duplicates
      const existing = await db
        .select()
        .from(instructions)
        .where(
          and(
            appId ? eq(instructions.appId, appId) : isNull(instructions.appId),
            user?.id
              ? eq(instructions.userId, user.id)
              : isNull(instructions.userId),
            guest?.id
              ? eq(instructions.guestId, guest.id)
              : isNull(instructions.guestId),
            eq(instructions.title, suggestion.title),
            eq(instructions.content, suggestion.content),
          ),
        )
        .limit(1)

      if (existing.length > 0) {
        console.log(`⏭️  Skipping duplicate instruction: ${suggestion.title}`)
        continue
      }

      const instruction = await createInstruction({
        userId: user?.id || null,
        guestId: guest?.id || null,
        appId: appId,
        title: suggestion.title,
        emoji: suggestion.emoji,
        content: suggestion.content,
        confidence: Math.round((suggestion.confidence ?? 0.8) * 100), // Convert to integer (0-100)
        requiresWebSearch: suggestion.requiresWebSearch ?? false,
        generatedAt: new Date(),
      })
      createdInstructions.push(instruction)
      console.log(`✅ Created instruction: ${suggestion.title}`)
    } catch (error) {
      // Gracefully handle guest migration race condition
      // If guest migrated to user during background task, instructions are already migrated
      if (
        error instanceof Error &&
        "cause" in error &&
        typeof error.cause === "object" &&
        error.cause !== null &&
        "constraint_name" in error.cause &&
        error.cause.constraint_name === "instructions_guestId_guest_id_fk"
      ) {
        console.log(
          `⏭️  Skipping instruction - guest migrated to user: ${suggestion.title}`,
        )
        continue
      }

      // Only capture unexpected errors
      captureException(error)
      console.error("❌ Failed to create instruction:", error)
    }
  }

  // Also keep suggestions payload for backward compatibility
  const suggestionsPayload: suggestionsPayload = {
    instructions: responseData.suggestions.map((s) => ({
      id: uuidv4(),
      title: s.title,
      emoji: s.emoji,
      content: s.content,
      confidence: s.confidence ?? 0.8,
      generatedAt: new Date().toISOString(),
      requiresWebSearch: s.requiresWebSearch,
    })),
    lastGenerated: new Date().toISOString(),
  }

  notifyOwnerAndCollaborations({
    c,
    notifySender: true,
    member: user,
    guest,
    thread: thread,
    payload: {
      type: "suggestions_generated",
      data: {
        app,
        suggestions: suggestionsPayload,
        placeholders: {
          home: homePlaceholder,
          thread: threadPlaceHolder,
        },
        instructions: createdInstructions,
      },
    },
  })

  return
}

// AI-powered content generation for background processing
// Defaults to DeepSeek for cost efficiency, but can use custom agent if specified
async function generateAIContent({
  thread,
  user,
  guest,
  agentId,
  conversationHistory,
  latestMessage,
  language,
  calendarEvents,
  skipClassification = false,
  c,
  app,
  useCustomAgent = false, // New parameter to opt into using custom agent
}: {
  c: Context
  app?: app | appWithStore
  thread: thread & {
    user?: user | null
    guest?: guest | null
    collaborations?: {
      collaboration: collaboration
      user: user
    }[]
    summary?: threadSummary
  }
  user?: user | null
  guest?: guest | null
  agentId: string
  conversationHistory: ModelMessage[]
  latestMessage: message
  language: string
  calendarEvents?: calendarEvent[]
  manualAppId?: string | null // Manual app ID from frontend (e.g., user on /atlas)
  skipClassification?: boolean // Skip AI classification if manually set
  useCustomAgent?: boolean // Use app's selected agent instead of DeepSeek (may increase costs)
}) {
  const memoriesEnabled = user?.memoriesEnabled || guest?.memoriesEnabled

  if (thread.isIncognito) return

  const retroSession = await db
    .select()
    .from(retroSessions)
    .where(eq(retroSessions.threadId, thread.id))
    .limit(1)
    .then((rows) => rows[0] || null)

  const isRetro = !!retroSession

  const characterProfilesEnabled =
    user?.characterProfilesEnabled || guest?.characterProfilesEnabled

  // Always extract memories if we have an app (for app memories)
  // Skip only if both features are disabled AND no app
  if (!memoriesEnabled && !characterProfilesEnabled && !app?.id) return

  const conversationText = conversationHistory
    // .slice(-10) // Last 10 messages for context
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n")

  // Get the appropriate model provider for this agent
  const { provider: model, agentName } = await getModelProvider(app)
  console.log(`🤖 Using ${agentName} for background processing`)

  // Use agent name for metadata tracking
  const modelName = agentName || "deepSeek"

  // Extract memories
  // - App memories: ALWAYS save (institutional knowledge)
  // - User memories: Only save if memoriesEnabled (privacy)
  let memories: MemoryData = []
  // Always extract if we have an app (for app memories) OR user has memories enabled
  if (app?.id || memoriesEnabled) {
    // Extract AND save to database
    memories = await extractAndSaveMemories(
      conversationText,
      model,
      modelName,
      user?.id,
      guest?.id,
      app?.id,
      thread.id,
      latestMessage.id,
      memoriesEnabled || false, // User privacy setting
    )
  } else {
    // Only extract for suggestions, don't save to database
    memories = await extractMemories(conversationText, model)
  }

  // Generate suggestions only if memories are enabled
  if (memoriesEnabled) {
    // Get calendar events for context (optional)

    generateSuggestionsAndPlaceholders({
      c,
      conversationText,
      memories,
      language,
      thread,
      user,
      guest,
      latestMessage,
      calendarEvents,
      app,
      skipClassification,
      model,
      modelName,
      isRetro, // ✅ Pass retro mode flag
    }).catch((error) => {
      captureException(error)
      console.error("❌ Background placeholder generation failed:", error)
      // Don't throw - user already got their response!
    })
  }

  // Character profiles: if disabled (user profile stripped), only create app profile
  const shouldGenerateUserProfile = characterProfilesEnabled
  const _shouldGenerateAppProfile = true // Always try to create app profile if appId exists

  const threadId = thread.id
  const appId = app?.id

  const userId = user?.id
  const guestId = guest?.id
  try {
    // Verify thread exists in DB before proceeding (prevents race condition errors)
    const threadExists = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
    })

    if (!threadExists) {
      console.log(
        `⚠️ Thread ${threadId} not found in DB - skipping background content generation (likely race condition)`,
      )
      return
    }

    // Check rate limits first
    if (!checkThreadSummaryLimit({ user, guest, thread })) {
      console.log("⚠️ Thread summary limit reached for user:", userId || guestId)
      return
    }

    console.log("🧠 Starting DeepSeek content generation for thread:", threadId)

    // Get conversation context

    // Extract app character memories early (needed for app character prompt)
    const appCharacterMemories = memories.filter(
      (m) => m.category === "character",
    )

    const characterPrompt = `Based on this conversation, analyze BOTH the USER's personality and the APP's personality (if applicable) and generate their character profiles.

      CONVERSATION:
      ${conversationText}
      
      ${
        app
          ? `APP NAME: ${app.name || "Unknown App"}
      APP DESCRIPTION: ${app.description || "No description"}
      
      CHARACTER MEMORIES:
      ${appCharacterMemories.map((m: any) => m.content).join("\n") || "No character memories yet"}`
          : ""
      }
      
      Generate ONLY a valid JSON response with no additional text:
      {
        "userProfile": {
          "name": "Brief personality archetype (e.g., 'The Strategic Planner', 'The Creative Innovator')",
          "personality": "2-3 sentence description of communication style and approach",
          "traits": {
            "communication": ["communication traits from conversation"],
            "expertise": ["knowledge areas demonstrated"],
            "behavior": ["problem-solving patterns observed"],
            "preferences": ["working style preferences shown"]
          },
          "userRelationship": "How this user prefers to interact with AI",
          "conversationStyle": "formal|casual|technical|friendly",
          "tags": ["3-5 single-word personality traits"]
        }${
          app
            ? `,
        "appProfile": {
          "name": "App display name from memories or conversation",
          "personality": "2-3 sentence description of the app's character and communication style",
          "traits": {
            "communication": ["how the app communicates"],
            "expertise": ["what the app specializes in"],
            "behavior": ["how the app behaves and responds"],
            "preferences": ["app's preferences and style"]
          },
          "conversationStyle": "formal|casual|technical|friendly",
          "tags": ["3-5 single-word traits that capture the app's essence"]
        }`
            : ""
        }
      }
      
      Focus on observable patterns from the USER's messages and APP's character memories. Return only valid JSON.`

    // Mood detection prompt (only if character profiles enabled)
    const moodPrompt = `Analyze the USER's emotional state from this conversation:

CONVERSATION:
${conversationText}

Detect the USER's current mood based on their language, tone, and content.

Generate ONLY a valid JSON response:
{
  "type": "happy|sad|angry|astonished|inlove|thinking",
  "confidence": 0.0-1.0,
  "reason": "Brief explanation of why this mood was detected"
}

Mood definitions:
- happy: Positive, cheerful, satisfied, excited
- sad: Disappointed, melancholic, down, discouraged
- angry: Frustrated, irritated, upset, annoyed
- astonished: Surprised, amazed, shocked, impressed
- inlove: Affectionate, passionate, romantic, deeply interested
- thinking: Contemplative, analytical, pondering, curious

Return only valid JSON.`

    // Generate thread summary
    const summaryPrompt = `Analyze this conversation and create a comprehensive summary:

CONVERSATION:
${conversationText}

Generate a JSON response with:
{
  "summary": "Brief 2-3 sentence summary of the conversation",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "conversationTone": "professional|casual|technical|creative",
  "userPreferences": ["preference1", "preference2"]
}

Focus on the main discussion points, user preferences, and conversation style.`

    // Define validation schemas
    const summarySchema = z.object({
      summary: z.string().optional(),
      keyTopics: z.array(z.string()).optional(),
      conversationTone: z
        .enum(["professional", "casual", "technical", "creative"])
        .optional()
        .catch("casual"), // Type-safe enum with fallback to "casual" if invalid
      userPreferences: z.array(z.string()).optional(),
    })

    const characterSchema = z.object({
      name: z.string().optional(),
      personality: z.string().optional(),
      communicationStyle: z.string().optional(),
      interests: z.array(z.string()).optional(),
      expertise: z.array(z.string()).optional(),
      traits: z
        .object({
          communication: z.array(z.string()).optional(),
          expertise: z.array(z.string()).optional(),
          behavior: z.array(z.string()).optional(),
          preferences: z.array(z.string()).optional(),
        })
        .optional(),
      tags: z.array(z.string()).optional(),
      userRelationship: z.string().optional(),
      conversationStyle: z.string().optional(),
    })

    const moodSchema = z.object({
      type: z.enum([
        "happy",
        "sad",
        "angry",
        "astonished",
        "inlove",
        "thinking",
      ]),
      confidence: z.number().min(0).max(1),
      reason: z.string().optional(),
    })

    // Generate summary, memories, character profile, and mood in parallel
    const promises = [
      generateText({
        model,
        prompt: summaryPrompt,
      }),
      generateText({
        model,
        prompt: characterPrompt,
      }),
      generateText({
        model,
        prompt: moodPrompt,
      }),
    ]

    const results = await Promise.all(promises)
    const [summaryResult, characterResult, moodResult] = results

    if (summaryResult) {
      // Extract memories using unified function (runs separately to avoid blocking)

      type SummaryData = z.infer<typeof summarySchema>
      let summaryData: SummaryData
      try {
        let jsonText = summaryResult.text.trim()

        // Remove markdown code blocks (handle multiple backticks)
        if (jsonText.includes("```")) {
          // Find first occurrence of ``` and last occurrence
          const firstBacktick = jsonText.indexOf("```")
          const lastBacktick = jsonText.lastIndexOf("```")

          if (
            firstBacktick !== -1 &&
            lastBacktick !== -1 &&
            firstBacktick !== lastBacktick
          ) {
            // Extract content between first and last backticks
            jsonText = jsonText.substring(firstBacktick + 3, lastBacktick)
            // Remove "json" language identifier if present
            jsonText = jsonText.replace(/^json\s*/, "").trim()
          }
        }

        const parsedData = JSON.parse(jsonText)
        summaryData = summarySchema.parse(parsedData)

        // Log conversation tone for analytics (no validation, DeepSeek is free to use any tone)
        if (summaryData.conversationTone) {
          console.log(
            `📊 Conversation tone detected: "${summaryData.conversationTone}"`,
          )
        }
      } catch (error) {
        captureException(error)
        console.log("⚠️ Failed to parse or validate summary:", error)
        summaryData = {
          summary: summaryResult.text.slice(0, 200),
          keyTopics: ["general discussion"],
          conversationTone: "casual" as const,
          userPreferences: [],
        }
      }

      // Wait for memories to be extracted and saved

      if (moodResult) {
        // Parse mood result
        type MoodData = z.infer<typeof moodSchema>
        let moodData: MoodData | null = null
        try {
          let jsonText = moodResult.text.trim()
          // Remove markdown code blocks safely without regex backtracking
          if (jsonText.startsWith("```json")) {
            jsonText = jsonText.slice(7).trimStart() // Remove "```json"
            const endIndex = jsonText.lastIndexOf("```")
            if (endIndex !== -1) {
              jsonText = jsonText.slice(0, endIndex).trimEnd()
            }
          } else if (jsonText.startsWith("```")) {
            jsonText = jsonText.slice(3).trimStart() // Remove "```"
            const endIndex = jsonText.lastIndexOf("```")
            if (endIndex !== -1) {
              jsonText = jsonText.slice(0, endIndex).trimEnd()
            }
          }
          const parsedData = JSON.parse(jsonText)
          moodData = moodSchema.parse(parsedData)
          console.log(
            `🎭 Detected mood: ${moodData.type} (confidence: ${moodData.confidence})`,
          )
        } catch (error) {
          captureException(error)
          console.log("⚠️ Failed to parse or validate mood:", error)
        }

        // Create mood in database if detected with sufficient confidence
        if (moodData && moodData.confidence >= 0.6) {
          try {
            await createMood({
              userId: userId || null,
              guestId: guestId || null,
              type: moodData.type,
              messageId: latestMessage.id, // Link to the message that triggered mood detection
              metadata: {
                detectedBy: modelName,
                confidence: moodData.confidence,
                reason: moodData.reason,
                conversationContext: getSmartConversationContext(
                  conversationText,
                  500,
                ), // Smart context
              },
            })
            console.log(
              `✅ Created mood: ${moodData.type} (confidence: ${moodData.confidence}, reason: ${moodData.reason})`,
            )
          } catch (error) {
            captureException(error)
            console.error("❌ Failed to create mood:", error)
          }
        }
      }
      // Parse character profiles (both user and app from single AI response)

      type CharacterData = z.infer<typeof characterSchema>
      let characterData: CharacterData
      let appCharacterData: CharacterData | null = null

      if (characterResult) {
        let jsonText = characterResult.text.trim()
        if (jsonText.startsWith("```json")) {
          jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "")
        } else if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "")
        }
        const parsedData = JSON.parse(jsonText)

        // Extract userProfile
        characterData = characterSchema.parse(
          parsedData.userProfile || parsedData,
        )

        // Extract appProfile if exists
        if (parsedData.appProfile && appId) {
          appCharacterData = characterSchema.parse(parsedData.appProfile)
        }

        // Save to database
        const messageCount = conversationHistory.length
        const lastMessageAt = new Date(latestMessage.createdOn)

        // Create or update thread summary
        const existingSummary = await getThreadSummary({
          userId,
          guestId,
          threadId,
        })

        // Verify ownership as extra safety layer
        if (existingSummary && !isOwner(existingSummary, { userId, guestId })) {
          console.warn("⚠️ Ownership mismatch for thread summary - rejecting")
          throw new Error("Unauthorized access to thread summary")
        }

        const threadSummaryData = {
          threadId,
          userId: userId || null,
          guestId: guestId || null,
          summary: summaryData.summary || "Conversation summary",
          keyTopics: summaryData.keyTopics || ["general discussion"],
          messageCount,
          lastMessageAt,
          ragContext: {
            documentSummaries: [],
            relevantChunks: [],
            conversationContext: getSmartConversationContext(
              conversationText,
              2000,
            ),
          },
          userMemories: memories.map((m: any) => ({
            id: uuidv4(),
            content: m.content,
            tags: m.tags || [],
            relevanceScore: m.importance / 10,
            createdAt: new Date().toISOString(),
          })),
          characterTags: {
            agentPersonalities: [
              {
                agentId,
                traits: characterData.traits
                  ? Object.values(characterData.traits).flat()
                  : [],
                behavior: characterData.personality || "friendly",
              },
            ],
            conversationTone: summaryData.conversationTone || "casual",
            userPreferences: summaryData.userPreferences || [],
            contextualTags: characterData.tags || [],
          },
          metadata: {
            version: "1.0",
            generatedBy: "deepseek-chat",
            confidence: 0.8,
            lastUpdated: new Date().toISOString(),
          },
        }

        if (existingSummary) {
          await updateThreadSummary({
            ...existingSummary,
            ...threadSummaryData,
          })
        } else {
          await createThreadSummary(threadSummaryData)
        }

        // Memories already created by extractAndSaveMemories() above

        // Create or update TWO character profiles (like memory system):
        // 1. USER CHARACTER PROFILE: userId/guestId set, appId null (only if shouldGenerateUserProfile)
        // 2. APP CHARACTER PROFILE: appId set, userId/guestId null (always if appId exists)

        // 1. USER CHARACTER PROFILE (skip if user profile stripped from system prompt)
        let userCharacterTag
        if (shouldGenerateUserProfile) {
          const existingUserCharacterTag = await getCharacterTag({
            userId,
            guestId,
            threadId,
          })

          if (
            existingUserCharacterTag &&
            isOwner(existingUserCharacterTag, {
              userId,
              guestId,
            }) &&
            !existingUserCharacterTag.appId // Ensure it's a user profile, not app profile
          ) {
            // Update existing user character profile
            userCharacterTag = await updateCharacterTag({
              ...existingUserCharacterTag,
              name: characterData.name || existingUserCharacterTag.name,
              personality:
                characterData.personality ||
                existingUserCharacterTag.personality,
              traits: {
                communication:
                  characterData.traits?.communication ??
                  existingUserCharacterTag.traits?.communication ??
                  [],
                expertise:
                  characterData.traits?.expertise ??
                  existingUserCharacterTag.traits?.expertise ??
                  [],
                behavior:
                  characterData.traits?.behavior ??
                  existingUserCharacterTag.traits?.behavior ??
                  [],
                preferences:
                  characterData.traits?.preferences ??
                  existingUserCharacterTag.traits?.preferences ??
                  [],
              },
              tags: characterData.tags || existingUserCharacterTag.tags,
              usageCount: existingUserCharacterTag.usageCount + 1,
              userRelationship:
                characterData.userRelationship ||
                existingUserCharacterTag.userRelationship,
              conversationStyle:
                characterData.conversationStyle ||
                existingUserCharacterTag.conversationStyle,
              metadata: {
                version: "1.0",
                createdBy: modelName,
                effectiveness: 0.8,
              },
            })
          } else if (!existingUserCharacterTag?.appId) {
            // Create new user character profile (userId/guestId set, appId null)
            userCharacterTag = await createCharacterTag({
              agentId,
              userId: userId || null,
              guestId: guestId || null,
              appId: null, // USER profile - no appId
              name: characterData.name || "User",
              personality: characterData.personality || "Friendly and helpful",
              traits: characterData.traits
                ? {
                    communication: characterData.traits.communication || [
                      "clear",
                      "direct",
                    ],
                    expertise: characterData.traits.expertise || [
                      "general knowledge",
                    ],
                    behavior: characterData.traits.behavior || [
                      "curious",
                      "analytical",
                    ],
                    preferences: characterData.traits.preferences || [
                      "learning",
                      "efficiency",
                    ],
                  }
                : {
                    communication: ["clear", "direct"],
                    expertise: ["general knowledge"],
                    behavior: ["curious", "analytical"],
                    preferences: ["learning", "efficiency"],
                  },
              tags: characterData.tags || [],
              usageCount: 1,
              userRelationship:
                characterData.userRelationship || "collaborative",
              conversationStyle:
                characterData.conversationStyle || "professional",
              metadata: {
                version: "1.0",
                createdBy: modelName,
                effectiveness: 0.8,
              },
              threadId,
            })
          }
        } else {
          console.log(
            `⏭️  Skipping user character profile creation (user profile stripped from system prompt)`,
          )
        }

        // 2. APP CHARACTER PROFILE (from AI-generated appProfile)
        if (appId && appCharacterData) {
          // Get existing app character profile
          const existingAppCharacterTag = await getCharacterTag({
            appId,
            threadId,
          })

          if (existingAppCharacterTag?.appId) {
            // Update existing app character profile with AI-generated data
            await updateCharacterTag({
              ...existingAppCharacterTag,
              name: appCharacterData.name || existingAppCharacterTag.name,
              personality:
                appCharacterData.personality ||
                existingAppCharacterTag.personality,
              traits: {
                communication: [
                  ...(existingAppCharacterTag.traits?.communication || []),
                  ...(appCharacterData.traits?.communication || []),
                ].slice(0, 10),
                expertise: [
                  ...(existingAppCharacterTag.traits?.expertise || []),
                  ...(appCharacterData.traits?.expertise || []),
                ].slice(0, 10),
                behavior: [
                  ...(existingAppCharacterTag.traits?.behavior || []),
                  ...(appCharacterData.traits?.behavior || []),
                ].slice(0, 10),
                preferences: [
                  ...(existingAppCharacterTag.traits?.preferences || []),
                  ...(appCharacterData.traits?.preferences || []),
                ].slice(0, 10),
              },
              tags: appCharacterData.tags ||
                existingAppCharacterTag.tags || ["app-character"],
              usageCount: existingAppCharacterTag.usageCount + 1,
              metadata: {
                version: "1.0",
                createdBy: modelName,
                effectiveness: 0.8,
              },
            })
            console.log(`✅ Updated app character profile for app ${appId}`)
          } else {
            // Create new app character profile (appId set, userId/guestId null)
            await createCharacterTag({
              agentId,
              userId: null, // APP profile - no userId
              guestId: null, // APP profile - no guestId
              appId, // APP profile - appId set
              name: appCharacterData.name || app?.name || "App Character",
              personality:
                appCharacterData.personality || "AI Assistant Character",
              traits: appCharacterData.traits || {},
              tags: appCharacterData.tags || ["app-character"],
              usageCount: 1,
              userRelationship: null,
              conversationStyle:
                appCharacterData.conversationStyle || "learned",
              metadata: {
                version: "1.0",
                createdBy: modelName,
                effectiveness: 0.8,
              },
              threadId,
              visibility: "public",
            })
            console.log(`✅ Created app character profile for app ${appId}`)
          }
        }

        userCharacterTag &&
          notifyOwnerAndCollaborations({
            c,
            notifySender: true,
            member: user,
            guest,
            thread: thread,
            payload: {
              type: "character_tag_created",
              data: userCharacterTag,
            },
          })
        console.log(
          "✅ DeepSeek content generation completed for thread:",
          threadId,
        )
      }
    }
    // Generate personalized suggestions and placeholders (only if memories enabled)
  } catch (error) {
    captureException(error)
    console.error("❌ DeepSeek content generation error:", error)
    throw error
  }
}

export default generateAIContent
