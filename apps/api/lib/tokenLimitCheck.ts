/**
 * Token limit checking and conversation splitting utilities
 * Prevents API errors by checking token counts before streaming
 */

interface ModelLimits {
  maxTokens: number
  name: string
}

// Model context window limits (conservative estimates)
const MODEL_LIMITS: Record<string, ModelLimits> = {
  // DeepSeek models
  "deepseek-chat": { maxTokens: 128000, name: "DeepSeek Chat" },
  "deepseek-reasoner": { maxTokens: 131000, name: "DeepSeek Reasoner" },
  "deepseek/deepseek-chat": { maxTokens: 128000, name: "DeepSeek Chat" },
  "deepseek/deepseek-r1": { maxTokens: 131000, name: "DeepSeek R1" },

  // Claude models
  "claude-3-5-sonnet-20241022": {
    maxTokens: 200000,
    name: "Claude 3.5 Sonnet",
  },
  "claude-3-opus-20240229": { maxTokens: 200000, name: "Claude 3 Opus" },
  "anthropic/claude-sonnet-4.5": {
    maxTokens: 200000,
    name: "Claude Sonnet 4.5",
  },
  "claude-sonnet-4-20250514": { maxTokens: 200000, name: "Claude Sonnet 4.5" },

  // OpenAI models
  "gpt-4o": { maxTokens: 128000, name: "GPT-4o" },
  "gpt-4-turbo": { maxTokens: 128000, name: "GPT-4 Turbo" },
  "gpt-3.5-turbo": { maxTokens: 16000, name: "GPT-3.5 Turbo" },
  "gpt-5.1": { maxTokens: 128000, name: "GPT-5.1" },
  "openai/gpt-5.1-chat": { maxTokens: 128000, name: "GPT-5.1" },

  // Gemini models
  "gemini-2.0-flash-exp": { maxTokens: 1000000, name: "Gemini 2.0 Flash" },
  "gemini-3-pro-preview": { maxTokens: 2000000, name: "Gemini 3 Pro" },
  "google/gemini-3-pro-preview": { maxTokens: 2000000, name: "Gemini 3 Pro" },

  // Perplexity models
  "sonar-pro": { maxTokens: 200000, name: "Sonar Pro" },
  "perplexity/sonar-pro": { maxTokens: 200000, name: "Sonar Pro" },

  // Flux model
  "black-forest-labs/flux-schnell": { maxTokens: 4000, name: "Flux Schnell" },
}

// Default fallback limit
const DEFAULT_LIMIT: ModelLimits = { maxTokens: 64000, name: "Default" }

/**
 * Rough token estimation (4 chars ≈ 1 token)
 * This is conservative - actual tokenization varies by model
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Get model limits for a given model ID
 */
export function getModelLimits(modelId: string): ModelLimits {
  // Try exact match first
  if (MODEL_LIMITS[modelId]) {
    return MODEL_LIMITS[modelId]
  }

  // Try partial match (e.g., "deepseek-chat" matches "deepseek/deepseek-chat")
  const partialMatch = Object.keys(MODEL_LIMITS).find(
    (key) => modelId.includes(key) || key.includes(modelId),
  )

  if (partialMatch) {
    return MODEL_LIMITS[partialMatch] || DEFAULT_LIMIT
  }

  console.warn(
    `⚠️ Unknown model "${modelId}", using default limit of ${DEFAULT_LIMIT.maxTokens} tokens`,
  )
  return DEFAULT_LIMIT
}

/**
 * Check if messages exceed token limit
 * Returns { withinLimit: boolean, estimatedTokens: number, maxTokens: number }
 */
export function checkTokenLimit(
  messages: Array<{ role: string; content: string | any }>,
  modelId: string,
  safetyMargin: number = 0.9, // Use 90% of limit to be safe
): {
  withinLimit: boolean
  estimatedTokens: number
  maxTokens: number
  modelName: string
  shouldSplit: boolean
} {
  const limits = getModelLimits(modelId)
  const safeLimit = Math.floor(limits.maxTokens * safetyMargin)

  // Estimate tokens from all messages
  let totalTokens = 0
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      totalTokens += estimateTokens(msg.content)
    } else if (Array.isArray(msg.content)) {
      // Handle multimodal content (text + images)
      for (const part of msg.content) {
        if (part.type === "text" && part.text) {
          totalTokens += estimateTokens(part.text)
        } else if (part.type === "image") {
          // Images use ~85 tokens for low detail, ~170 for high detail
          totalTokens += 170
        }
      }
    }
  }

  const withinLimit = totalTokens <= safeLimit
  const shouldSplit = totalTokens > safeLimit && messages.length > 10

  return {
    withinLimit,
    estimatedTokens: totalTokens,
    maxTokens: limits.maxTokens,
    modelName: limits.name,
    shouldSplit,
  }
}

/**
 * Split conversation when token limit exceeded
 * Keeps system prompt + recent messages, summarizes older context
 */
export function splitConversation(
  messages: Array<{ role: string; content: string | any }>,
  targetTokens: number,
): {
  systemPrompt: { role: string; content: string } | null
  recentMessages: Array<{ role: string; content: string | any }>
  summarizedContext: string
} {
  // Extract system prompt (first message if role=system)
  const systemPrompt = messages[0]?.role === "system" ? messages[0] : null
  const conversationMessages = systemPrompt ? messages.slice(1) : messages

  // Always keep last 10 messages (5 exchanges)
  const minKeepMessages = Math.min(10, conversationMessages.length)
  const recentMessages = conversationMessages.slice(-minKeepMessages)
  const olderMessages = conversationMessages.slice(0, -minKeepMessages)

  // Estimate tokens in recent messages
  let recentTokens = 0
  for (const msg of recentMessages) {
    if (typeof msg.content === "string") {
      recentTokens += estimateTokens(msg.content)
    }
  }

  // If recent messages already exceed target, just return them
  if (recentTokens >= targetTokens || olderMessages.length === 0) {
    return {
      systemPrompt,
      recentMessages,
      summarizedContext: "",
    }
  }

  // Summarize older messages
  const summarizedContext = `
## Previous Conversation Summary
This conversation has been ongoing. Here's a summary of earlier messages:

${olderMessages
  .map((msg, i) => {
    const content =
      typeof msg.content === "string"
        ? msg.content.substring(0, 200)
        : "[multimodal content]"
    return `${i + 1}. **${msg.role}**: ${content}${content.length > 200 ? "..." : ""}`
  })
  .join("\n")}

---
**Recent conversation continues below** (last ${minKeepMessages} messages)
`

  return {
    systemPrompt,
    recentMessages,
    summarizedContext,
  }
}

/**
 * Create error message for token limit exceeded
 */
export function createTokenLimitError(
  estimatedTokens: number,
  maxTokens: number,
  modelName: string,
): string {
  return `This conversation has grown too long for ${modelName} (${estimatedTokens.toLocaleString()} tokens requested, ${maxTokens.toLocaleString()} max). I've automatically split the conversation to continue. Your recent messages are preserved.`
}
