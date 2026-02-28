import { createAnthropic } from "@ai-sdk/anthropic"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createPerplexity } from "@ai-sdk/perplexity"
import type { appWithStore } from "@chrryai/chrry/types"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { type aiAgent, type app, decrypt, getAiAgents } from "@repo/db"
import type { LanguageModel } from "ai"

const plusTiers = ["plus", "pro"]

/**
 * Safely decrypt an API key if it's encrypted
 * Returns the decrypted key or the original value if decryption fails
 */
function safeDecrypt(encryptedKey: string | undefined): string | undefined {
  if (!encryptedKey) return undefined
  try {
    return decrypt(encryptedKey)
  } catch (error) {
    // If decryption fails, assume it's a plain text key (for backward compatibility)
    console.warn("⚠️ Failed to decrypt API key, using as-is:", error)
    return encryptedKey
  }
}

/**
 * Get the appropriate AI model provider based on agent configuration
 *
 * @param agentId - The ID of the agent to get the model for
 * @param app - Optional app object containing API keys
 * @returns Object with provider (AI SDK model) and agentName
 *
 * Logic:
 * - If E2E testing, uses free OpenRouter models (no cost)
 * - If agent has appId (custom agent), uses its custom configuration
 * - Otherwise uses global agents with app's API keys or env variables
 * - Falls back to DeepSeek if agent not found or unsupported
 */
export async function getModelProvider(
  app?: app | appWithStore,
  name:
    | "deepSeek"
    | "chatGPT"
    | "claude"
    | "sushi"
    | "gemini"
    | "perplexity"
    | "flux"
    | "openrouter"
    | string = "deepSeek",
  canReason = true,
): Promise<{ provider: LanguageModel; agentName: string; lastKey?: string }> {
  // const name = agentName === "sushi" && !canReason ? "deepSeek" : agentName

  const appApiKeys = app?.apiKeys || {}

  const agents = await getAiAgents({ include: app?.id })
  let agent = agents.find((a) => a.name === name) || agents[0]

  // Check for failed key and avoid that provider
  const failedKey = agent?.metadata?.lastFailedKey

  if (!agent) {
    // Fallback to DeepSeek if agent not found or failed
    agent = agents.find((a) => a.name === "deepSeek") as aiAgent
    if (!agent) {
      throw new Error(
        "No suitable AI agent found in the database (deepSeek fallback missing)",
      )
    }
  }

  // If agent has appId (custom agent), use its configuration
  // Otherwise use global configuration with app's API keys

  switch (name) {
    case "deepSeek": {
      const deepseekKey = app?.apiKeys?.deepseek
        ? safeDecrypt(app?.apiKeys?.deepseek)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.DEEPSEEK_API_KEY
          : ""

      if (deepseekKey && failedKey !== "deepSeek") {
        const deepseekProvider = createDeepSeek({ apiKey: deepseekKey })
        return {
          provider: deepseekProvider("deepseek-chat"),
          agentName: agent.name,
          lastKey: "deepSeek",
        }
      }

      // Fallback to OpenRouter
      const openrouterKeyForDeepSeek = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (openrouterKeyForDeepSeek && failedKey !== "openrouter") {
        const openrouterProvider = createOpenRouter({
          apiKey: openrouterKeyForDeepSeek,
        })
        const modelId = agent.modelId.startsWith("deepseek/")
          ? agent.modelId
          : `deepseek/${agent.modelId}`
        return {
          provider: openrouterProvider(modelId),
          agentName: agent.name,
          lastKey: "openrouter",
        }
      }

      // Final fallback to ChatGPT if no DeepSeek key available
      console.warn("⚠️ No DeepSeek API key found, falling back to ChatGPT")
      const chatgptKey = app?.apiKeys?.openai
        ? safeDecrypt(app?.apiKeys?.openai)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY
          : ""

      if (chatgptKey && failedKey !== "chatGPT") {
        const openaiProvider = createOpenAI({ apiKey: chatgptKey })
        return {
          provider: openaiProvider("gpt-4o-mini"),
          agentName: "chatGPT",
          lastKey: "chatGPT",
        }
      }

      // Last resort - return with empty key (will fail but at least logged)
      console.error("❌ No API keys available for DeepSeek or ChatGPT fallback")
      return {
        provider: createDeepSeek({ apiKey: "" })(agent.modelId),
        agentName: agent.name,
      }
    }
    case "sushi": {
      const openrouterKeyForDeepSeekReasoner = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      const sushiKey =
        (appApiKeys.deepseek ? safeDecrypt(appApiKeys.deepseek) : "") ||
        (!plusTiers.includes(app?.tier || "")
          ? process.env.DEEPSEEK_API_KEY
          : "")

      if (sushiKey && failedKey !== "deepSeek") {
        const sushiProvider = createDeepSeek({ apiKey: sushiKey })
        return {
          provider: sushiProvider(
            canReason ? "deepseek-reasoner" : "deepseek-chat",
          ),
          agentName: agent.name,
          lastKey: "deepSeek",
        }
      }

      // !canReason temp
      if (
        openrouterKeyForDeepSeekReasoner &&
        failedKey !== "openrouter" &&
        !canReason
      ) {
        const openrouterProvider = createOpenRouter({
          apiKey: openrouterKeyForDeepSeekReasoner,
        })
        const modelId = canReason
          ? "qwen/qwen3-235b-a22b-thinking-2507"
          : "qwen/qwen3-235b-a22b-instruct-2507"
        return {
          provider: openrouterProvider(modelId),
          agentName: agent.name,
          lastKey: "openrouter",
        }
      }

      // Fallback to OpenRouter - use official SDK

      return {
        provider: createDeepSeek({ apiKey: "" })("deepseek-reasoner"),
        agentName: agent.name,
      }
    }

    case "chatGPT": {
      // Check for OpenAI key first
      const openaiKey = app?.apiKeys?.openai
        ? safeDecrypt(app?.apiKeys?.openai)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.CHATGPT_API_KEY
          : ""

      if (openaiKey && failedKey !== "chatGPT") {
        const openaiProvider = createOpenAI({ apiKey: openaiKey })
        return {
          provider: openaiProvider(agent.modelId),
          agentName: agent.name,
          lastKey: "chatGPT",
        }
      }

      // Fallback to OpenRouter
      const openrouterKeyForOpenAI =
        (appApiKeys.openrouter ? safeDecrypt(appApiKeys.openrouter) : "") ||
        (!plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : "")

      if (openrouterKeyForOpenAI && failedKey !== "openrouter") {
        const openrouterProvider = createOpenRouter({
          apiKey: openrouterKeyForOpenAI,
        })
        const modelId = "openai/gpt-5.1-chat"
        return {
          provider: openrouterProvider(modelId),
          agentName: agent.name,
          lastKey: "openrouter",
        }
      }

      return {
        provider: createOpenAI({ apiKey: "" })(agent.modelId),
        agentName: agent.name,
      }
    }

    case "claude": {
      const claudeKey = app?.apiKeys?.anthropic
        ? safeDecrypt(app?.apiKeys?.anthropic)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.CLAUDE_API_KEY
          : ""

      if (claudeKey && failedKey !== "claude") {
        const claudeProvider = createAnthropic({ apiKey: claudeKey })
        return {
          provider: claudeProvider(agent.modelId),
          agentName: agent.name,
          lastKey: "claude",
        }
      }

      // Fallback to OpenRouter
      const openrouterKeyForClaude =
        (appApiKeys.openrouter ? safeDecrypt(appApiKeys.openrouter) : "") ||
        (!plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : "")

      if (openrouterKeyForClaude && failedKey !== "openrouter") {
        const openrouterProvider = createOpenRouter({
          apiKey: openrouterKeyForClaude,
        })

        // Map old model IDs to correct OpenRouter format
        const modelId = "anthropic/claude-sonnet-4.5"

        return {
          provider: openrouterProvider(modelId),
          agentName: agent.name,
          lastKey: "openrouter",
        }
      }

      return {
        provider: createAnthropic({ apiKey: "" })(agent.modelId),
        agentName: agent.name,
      }
    }

    case "gemini": {
      const geminiKey =
        (appApiKeys.google ? safeDecrypt(appApiKeys.google) : "") ||
        (!plusTiers.includes(app?.tier || "") ? process.env.GEMINI_API_KEY : "")

      if (geminiKey && failedKey !== "gemini") {
        const geminiProvider = createGoogleGenerativeAI({ apiKey: geminiKey })
        return {
          provider: geminiProvider(agent.modelId),
          lastKey: "gemini",
          agentName: agent.name,
        }
      }

      // Fallback to OpenRouter
      const openrouterKeyForGemini = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (openrouterKeyForGemini && failedKey !== "openrouter") {
        const openrouterProvider = createOpenRouter({
          apiKey: openrouterKeyForGemini,
        })
        const modelId = "google/gemini-3-pro-preview"
        return {
          provider: openrouterProvider(modelId),
          agentName: agent.name,
          lastKey: "openrouter",
        }
      }

      return {
        provider: createGoogleGenerativeAI({ apiKey: "" })(agent.modelId),
        agentName: agent.name,
      }
    }

    case "perplexity": {
      const perplexityKey = app?.apiKeys?.perplexity
        ? safeDecrypt(app?.apiKeys?.perplexity)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.PERPLEXITY_API_KEY
          : ""

      if (perplexityKey && failedKey !== "perplexity") {
        const perplexityProvider = createPerplexity({
          apiKey: perplexityKey,
        })
        return {
          provider: perplexityProvider(agent.modelId),
          agentName: agent.name,
          lastKey: "perplexity",
        }
      }

      // Fallback to OpenRouter
      const openrouterKeyForPerplexity = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (openrouterKeyForPerplexity && failedKey !== "openrouter") {
        const openrouterProvider = createOpenRouter({
          apiKey: openrouterKeyForPerplexity,
        })
        // Use sonar-reasoning for tool calling support
        const modelId = "perplexity/sonar-pro"
        return {
          provider: openrouterProvider(modelId),
          agentName: agent.name,
          lastKey: "openrouter",
        }
      }

      return {
        provider: createOpenRouter({
          apiKey: "",
          baseURL: "https://api.perplexity.ai",
        })(agent.modelId),
        agentName: agent.name,
      }
    }

    case "openrouter": {
      const openrouterKey = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (!openrouterKey) {
        throw new Error("OpenRouter API key required for openrouter agent")
      }

      const openrouterProvider = createOpenRouter({
        apiKey: openrouterKey,
      })
      return {
        provider: openrouterProvider(agent.modelId),
        agentName: agent.name,
        lastKey: "openrouter",
      }
    }

    default: {
      // Custom OpenAI-compatible model
      if (agent.apiURL) {
        console.log("🤖 Using custom agent:", agent.name)

        // Special handling for DeepSeek - don't use apiURL as key
        if (agent.name.toLowerCase() === "deepseek") {
          console.warn("⚠️ DeepSeek agent in default case - using env key")
          const deepseekKey = app?.apiKeys?.deepseek
            ? safeDecrypt(app?.apiKeys?.deepseek)
            : !plusTiers.includes(app?.tier || "")
              ? process.env.DEEPSEEK_API_KEY
              : ""

          if (deepseekKey) {
            const deepseekProvider = createDeepSeek({ apiKey: deepseekKey })
            return {
              provider: deepseekProvider(agent.modelId),
              agentName: agent.name,
            }
          }
        }

        const [customBaseURL, customApiKey] = agent.apiURL.includes("|")
          ? agent.apiURL.split("|")
          : ["https://api.openai.com/v1", agent.apiURL]

        const customProvider = createOpenAI({
          apiKey: customApiKey,
          baseURL: customBaseURL,
        })
        return {
          provider: customProvider(agent.modelId),
          agentName: agent.name,
        }
      }

      // Fallback to DeepSeek for unknown agents
      console.log("⚠️ Unknown agent, using DeepSeek fallback")
      const fallbackKey = app?.apiKeys?.deepseek
        ? safeDecrypt(app?.apiKeys?.deepseek)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.DEEPSEEK_API_KEY
          : ""
      const fallbackProvider = createDeepSeek({ apiKey: fallbackKey })
      return {
        provider: fallbackProvider("deepseek-chat"),
        agentName: "deepSeek",
      }
    }
  }
}

/**
 * Get embedding model provider based on app configuration
 * Embeddings are typically from OpenAI (text-embedding-3-small)
 */
export async function getEmbeddingProvider(app?: app | appWithStore) {
  const openaiKey = app?.apiKeys?.openai
    ? safeDecrypt(app?.apiKeys?.openai)
    : !plusTiers.includes(app?.tier || "")
      ? process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY
      : ""

  if (!openaiKey) {
    throw new Error("OpenAI API key required for embeddings")
  }

  return createOpenAI({ apiKey: openaiKey })
}
