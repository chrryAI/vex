import { v4 as uuidv4 } from "uuid"

import {
  createCharacterTag,
  createMemory,
  createThreadSummary,
  getCharacterTags,
  getThreadSummary,
  updateCharacterTag,
  updateThreadSummary,
  threadSummary,
  thread,
  collaboration,
  user,
  guest,
  getPlaceHolder,
  updatePlaceHolder,
  createPlaceHolder,
  getApps,
  getApp,
  createInstruction,
  message,
  calendarEvent,
  updateThread,
  app,
  db,
} from "@repo/db"
import { and, eq, isNull } from "drizzle-orm"
import { instructions } from "@repo/db/src/schema"

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
      ])
      .optional(),
    importance: z.number().optional(),
  }),
)

type MemoryData = z.infer<typeof memorySchema>

import { generateText, ModelMessage } from "ai"
import { checkThreadSummaryLimit } from "./index"
import { getModelProvider } from "./getModelProvider"

import { captureException } from "@sentry/nextjs"
import { z } from "zod"
import { notifyOwnerAndCollaborations } from "./notify"
import enTranslations from "chrry/locales/en.json"

// Smart context retrieval from memories

// Extract memories from conversation (without saving to database)
async function extractMemories(conversationText: string, model: any) {
  const memoryPrompt = `Based on this conversation, extract meaningful memories:

CONVERSATION:
${conversationText}

Extract TWO types of memories:
1. USER MEMORIES: Personal information about this specific user (preferences, relationships, personal facts, goals)
2. APP/GENERAL MEMORIES: Universal knowledge useful for ALL users (facts, instructions, context, patterns)

Category guide:
- "preference" = User's personal preferences (USER memory)
- "relationship" = User's connections with others (USER memory)
- "goal" = User's personal goals (USER memory)
- "fact" = Universal/general knowledge (APP memory)
- "instruction" = How to do something (APP memory)
- "context" = General patterns or insights (APP memory)

Generate ONLY a valid JSON array with no additional text (max 5 memories):
[
  {
    "title": "Short memory title",
    "content": "Detailed memory content",
    "category": "preference|fact|context|instruction|relationship|goal",
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
      // App memories: facts, instructions, general knowledge
      // User memories: preferences, personal facts, relationships
      const isAppMemory =
        appId &&
        (memory.category === "fact" ||
          memory.category === "instruction" ||
          memory.category === "context")

      // Skip user memories if user has disabled them (privacy)
      // But ALWAYS save app memories (institutional knowledge, no privacy concern)
      if (!isAppMemory && !memoriesEnabled) {
        console.log(`⏭️  Skipping user memory (privacy): ${memory.title}`)
        continue
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

// Extract topic keywords from conversation (lightweight alternative to full context)
function extractTopicKeywords(text: string): string[] {
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
  ...rest
}: {
  conversationText: string
  memories: MemoryData
  language: string
  thread: thread & {
    user: user | null
    guest: guest | null
    collaborations?: {
      collaboration: collaboration
      user: user
    }[]
  }
  user?: user
  guest?: guest
  latestMessage: message
  calendarEvents?: calendarEvent[]
  app?: app
  skipClassification?: boolean
  model: any
  modelName: string
}) {
  let app = rest.app
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

  // Use current app's highlights as examples for AI
  // This gives the AI strong context about what features are available
  const currentApp = app || null
  const appHighlights = currentApp?.highlights || []
  const appTipsTitle = currentApp?.tipsTitle || null

  console.log(
    `🎯 Current app: ${currentApp?.name || "none"} with ${appHighlights.length} highlights${appTipsTitle ? ` and tips: "${appTipsTitle}"` : ""}`,
  )

  const suggestionsPrompt = `Based on this conversation, user memories, and calendar, generate personalized AI instruction templates AND classify the app relevance:

CONVERSATION:
${conversationText.slice(-2000)} // Last 2000 chars

MEMORIES:
${memories.map((m) => `- ${m.content}`).join("\n")}${calendarContext}

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
- These placeholders will be replaced with real-time user context at runtime
- ⚠️ ONLY USE THESE EXACT PLACEHOLDERS (no others are supported):
  * {{city}} - User's current city (e.g., "Tokyo")
  * {{country}} - User's current country (e.g., "Japan")
  * {{flag}} - Country flag emoji (e.g., "🇯🇵")
  * {{location}} - Full location (e.g., "Tokyo, Japan")
  * {{temp}} - Current temperature (e.g., "15°C")
  * {{weather}} - Weather description (e.g., "Current weather: 15°C ☀️")
  * {{weatherEmoji}} - Weather emoji (e.g., "☀️", "🌧️", "☁️", "❄️")
  * {{timeOfDay}} - Time period (e.g., "morning", "afternoon", "evening", "night")
- ❌ DO NOT create custom placeholders like {{emoji}}, {{topic}}, {{name}}, etc.
- ✅ For emojis: Put actual emoji characters directly in the text, NOT placeholders
- Examples:
  * Title: "Find best restaurants in {{city}} {{flag}}"
  * Content: "You are a food expert in {{location}}. Weather: {{temp}} {{weatherEmoji}}"
  * Title: "Plan {{timeOfDay}} activities {{weatherEmoji}}"
  * Content: "Suggest activities for {{timeOfDay}} in {{city}}. Consider {{weather}}"
- Use placeholders to make instructions feel dynamic and context-aware
- Placeholders work especially well for location-based and time-sensitive instructions

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
    console.log("⚠️ Failed to parse or validate response:", error)
    responseData = {
      suggestions: [],
      placeholders: { home: "", thread: "" },
    }
  }

  // Since we always have app context, use it directly
  const finalAppId = app?.id || null

  if (app) {
    console.log(`🎯 Using current app: ${app.name} (${app.id})`)
    await updateThread({
      ...thread,
      appId: app.id,
    })
  }

  let homePlaceholder
  // Save placeholders to database with history
  // If user is on a specific app, use app-specific placeholder
  if (responseData.placeholders.home) {
    homePlaceholder = await getPlaceHolder({
      userId: user?.id,
      guestId: guest?.id,
      appId: finalAppId || undefined, // ✅ App-specific placeholder
    })

    if (homePlaceholder) {
      // Preserve history
      const history = homePlaceholder.metadata?.history || []

      // Extract topic keywords (lighter than full context)
      const topicKeywords = extractTopicKeywords(conversationText)

      history.push({
        text: homePlaceholder.text,
        generatedAt: homePlaceholder.updatedOn.toISOString(),
        conversationContext: conversationText.slice(-200), // For debugging
        topicKeywords, // Lightweight alternative
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
    }
  }

  let threadPlaceHolder
  if (responseData.placeholders.thread) {
    threadPlaceHolder = await getPlaceHolder({
      threadId: thread.id,
      userId: user?.id,
      guestId: guest?.id,
    })

    if (threadPlaceHolder) {
      // Preserve history
      const history = threadPlaceHolder.metadata?.history || []
      const topicKeywords = extractTopicKeywords(conversationText)

      history.push({
        text: threadPlaceHolder.text,
        generatedAt: threadPlaceHolder.updatedOn.toISOString(),
        conversationContext: conversationText.slice(-200), // For debugging
        topicKeywords, // Lightweight alternative
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
        metadata: {
          generatedBy: modelName,
          history: [],
        },
      })
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
  app,
  useCustomAgent = false, // New parameter to opt into using custom agent
}: {
  app?: app
  thread: thread & {
    user: user | null
    guest: guest | null
    collaborations?: {
      collaboration: collaboration
      user: user
    }[]
    summary?: threadSummary
  }
  user?: user
  guest?: guest
  agentId: string
  conversationHistory: ModelMessage[]
  latestMessage: message
  language: string
  calendarEvents?: calendarEvent[]
  manualAppId?: string | null // Manual app ID from frontend (e.g., user on /atlas)
  skipClassification?: boolean // Skip AI classification if manually set
  useCustomAgent?: boolean // Use app's selected agent instead of DeepSeek (may increase costs)
}) {
  if (thread.isIncognito) return

  const memoriesEnabled = user?.memoriesEnabled || guest?.memoriesEnabled
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
  // Character profiles are independent
  const shouldGenerateCharacterProfiles = characterProfilesEnabled
  if (memoriesEnabled) {
    // Get calendar events for context (optional)

    generateSuggestionsAndPlaceholders({
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
    }).catch((error) => {
      captureException(error)
      console.error("❌ Background placeholder generation failed:", error)
      // Don't throw - user already got their response!
    })
  }

  if (!shouldGenerateCharacterProfiles) {
    // Generate suggestions and placeholders (only if memories enabled)
    return
  }

  const threadId = thread.id

  const userId = user?.id
  const guestId = guest?.id
  try {
    // Check rate limits first
    if (!checkThreadSummaryLimit({ user, guest, thread })) {
      console.log(
        "⚠️ Thread summary limit reached for user:",
        userId || guestId,
      )
      return
    }

    console.log("🧠 Starting DeepSeek content generation for thread:", threadId)

    // Get conversation context

    const characterPrompt = `Based on this conversation, analyze the USER's personality and generate their character profile.

      CONVERSATION:
      ${conversationText}
      
      Generate ONLY a valid JSON response with no additional text:
      {
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
        "tags": ["3-5 single-word personality traits that capture their essence"]
      }
      
      For tags, use descriptive single words like: analytical, creative, direct, collaborative, methodical, innovative, practical, strategic, empathetic, efficient, curious, detail-oriented, big-picture, results-driven, etc.
      
      Focus ONLY on observable patterns from the USER's messages. Return only valid JSON.`
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
        .optional(),
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

    // Generate summary, memories, and character profile in parallel
    const [summaryResult, characterResult] = await Promise.all([
      generateText({
        model,
        prompt: summaryPrompt,
      }),
      generateText({
        model,
        prompt: characterPrompt,
      }),
    ])

    // Extract memories using unified function (runs separately to avoid blocking)

    type SummaryData = z.infer<typeof summarySchema>
    let summaryData: SummaryData
    try {
      let jsonText = summaryResult.text.trim()
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "")
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "")
      }
      const parsedData = JSON.parse(jsonText)
      summaryData = summarySchema.parse(parsedData)
    } catch (error) {
      console.log("⚠️ Failed to parse or validate summary:", error)
      summaryData = {
        summary: summaryResult.text.slice(0, 200),
        keyTopics: ["general discussion"],
        conversationTone: "casual" as const,
        userPreferences: [],
      }
    }

    // Wait for memories to be extracted and saved

    // Generate character profile for the user

    type CharacterData = z.infer<typeof characterSchema>
    let characterData: CharacterData
    try {
      let jsonText = characterResult.text.trim()
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "")
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "")
      }
      const parsedData = JSON.parse(jsonText)
      characterData = characterSchema.parse(parsedData)
    } catch (error) {
      console.log("⚠️ Failed to parse or validate character:", error)
      characterData = {
        name: "User",
        personality: "Friendly and helpful",
        communicationStyle: "Clear and concise",
        interests: ["technology", "learning"],
        expertise: ["general knowledge"],
        traits: {
          communication: ["clear", "direct"],
          expertise: ["general knowledge"],
          behavior: ["curious", "analytical"],
          preferences: ["learning", "efficiency"],
        },
        tags: ["helpful", "tech-savvy"],
        userRelationship: "collaborative",
        conversationStyle: "professional",
      }
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
        conversationContext: conversationText.slice(0, 1000),
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

    // Create or update character profile
    const existingCharacterTags = await getCharacterTags({ agentId })
    const existingProfile = existingCharacterTags.find(
      (profile) =>
        (profile.userId === userId || profile.guestId === guestId) &&
        profile.threadId === threadId,
    )

    let characterTag
    if (existingProfile) {
      // Update existing character profile
      characterTag = await updateCharacterTag({
        ...existingProfile,
        name: characterData.name || existingProfile.name,
        personality: characterData.personality || existingProfile.personality,
        traits: characterData.traits
          ? {
              communication: characterData.traits.communication || [],
              expertise: characterData.traits.expertise || [],
              behavior: characterData.traits.behavior || [],
              preferences: characterData.traits.preferences || [],
            }
          : existingProfile.traits,
        tags: characterData.tags || existingProfile.tags,
        usageCount: existingProfile.usageCount + 1,
        userRelationship:
          characterData.userRelationship || existingProfile.userRelationship,
        conversationStyle:
          characterData.conversationStyle || existingProfile.conversationStyle,
        metadata: {
          version: "1.0",
          createdBy: modelName,
          effectiveness: 0.8,
        },
      })
    } else {
      // Create new character profile
      characterTag = await createCharacterTag({
        agentId,
        userId: userId || null,
        guestId: guestId || null,
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
        userRelationship: characterData.userRelationship || "collaborative",
        conversationStyle: characterData.conversationStyle || "professional",
        metadata: {
          version: "1.0",
          createdBy: modelName,
          effectiveness: 0.8,
        },
        threadId,
      })
    }

    characterTag &&
      notifyOwnerAndCollaborations({
        notifySender: true,
        member: user,
        guest,
        thread: thread,
        payload: {
          type: "character_tag_created",
          data: characterTag,
        },
      })
    console.log(
      "✅ DeepSeek content generation completed for thread:",
      threadId,
    )

    // Generate personalized suggestions and placeholders (only if memories enabled)
  } catch (error) {
    console.error("❌ DeepSeek content generation error:", error)
    throw error
  }
}

export default generateAIContent
