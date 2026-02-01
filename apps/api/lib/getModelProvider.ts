import { createDeepSeek } from "@ai-sdk/deepseek"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { app, getAiAgents, decrypt, aiAgent } from "@repo/db"
import type { LanguageModel } from "ai"
import { appWithStore } from "@chrryai/chrry/types"
import { createPerplexity } from "@ai-sdk/perplexity"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"

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
  name = "deepSeek",
): Promise<{ provider: LanguageModel; agentName: string }> {
  const appApiKeys = app?.apiKeys || {}

  const agents = await getAiAgents({ include: app?.id })

  let agent = agents.find((a) => a.name.toLowerCase() === name.toLowerCase())

  if (!agent) {
    // Fallback to DeepSeek if agent not found
    agent = agents.find((a) => a.name === "deepSeek") as aiAgent
  }

  // If agent has appId (custom agent), use its configuration
  // Otherwise use global configuration with app's API keys

  switch (name) {
    case "deepSeek": {
      const deepseekKey = app?.apiKeys?.deepseek
        ? safeDecrypt(app?.apiKeys?.deepseek)
        : !plusTiers.includes(app?.tier || "") &&
            !process.env.OPENROUTER_API_KEY
          ? process.env.DEEPSEEK_API_KEY
          : ""

      if (deepseekKey) {
        const deepseekProvider = createDeepSeek({ apiKey: deepseekKey })
        return {
          provider: deepseekProvider("deepseek-chat"),
          agentName: agent.name,
        }
      }

      // Fallback to OpenRouter
      const openRouterKeyForDeepSeek = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (openRouterKeyForDeepSeek) {
        const openRouterProvider = createOpenRouter({
          apiKey: openRouterKeyForDeepSeek,
        })
        const modelId = agent.modelId.startsWith("deepseek/")
          ? agent.modelId
          : `deepseek/${agent.modelId}`
        return {
          provider: openRouterProvider(modelId),
          agentName: agent.name,
        }
      }

      // Final fallback to ChatGPT if no DeepSeek key available
      console.warn("⚠️ No DeepSeek API key found, falling back to ChatGPT")
      const chatgptKey = app?.apiKeys?.openai
        ? safeDecrypt(app?.apiKeys?.openai)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY
          : ""

      if (chatgptKey) {
        const openaiProvider = createOpenAI({ apiKey: chatgptKey })
        return {
          provider: openaiProvider("gpt-3.5-turbo"),
          agentName: "chatGPT",
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
      const sushiKey =
        (appApiKeys.deepseek ? safeDecrypt(appApiKeys.deepseek) : "") ||
        (!plusTiers.includes(app?.tier || "") && !process.env.OPENROUTER_API_KEY
          ? process.env.DEEPSEEK_API_KEY
          : "")

      if (sushiKey) {
        const sushiProvider = createDeepSeek({ apiKey: sushiKey })
        return {
          provider: sushiProvider("deepseek-reasoner"),
          agentName: agent.name,
        }
      }

      // Fallback to OpenRouter - use official SDK
      const openRouterKeyForDeepSeekReasoner = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (openRouterKeyForDeepSeekReasoner) {
        const openRouterProvider = createOpenRouter({
          apiKey: openRouterKeyForDeepSeekReasoner,
        })
        // Use DeepSeek R1 with official OpenRouter SDK
        const modelId = "deepseek/deepseek-r1"
        return {
          provider: openRouterProvider(modelId),
          agentName: agent.name,
        }
      }

      return {
        provider: createDeepSeek({ apiKey: "" })("deepseek-reasoner"),
        agentName: agent.name,
      }
    }

    case "chatGPT": {
      // Check for OpenAI key first
      const openaiKey = app?.apiKeys?.openai
        ? safeDecrypt(app?.apiKeys?.openai)
        : !plusTiers.includes(app?.tier || "") &&
            !process.env.OPENROUTER_API_KEY
          ? process.env.CHATGPT_API_KEY
          : ""

      if (openaiKey) {
        const openaiProvider = createOpenAI({ apiKey: openaiKey })
        return {
          provider: openaiProvider(agent.modelId),
          agentName: agent.name,
        }
      }

      // Fallback to OpenRouter
      const openRouterKeyForOpenAI =
        (appApiKeys.openrouter ? safeDecrypt(appApiKeys.openrouter) : "") ||
        (!plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : "")

      if (openRouterKeyForOpenAI) {
        const openRouterProvider = createOpenRouter({
          apiKey: openRouterKeyForOpenAI,
        })
        const modelId = "openai/gpt-5.1-chat"
        return {
          provider: openRouterProvider(modelId),
          agentName: agent.name,
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
        : !plusTiers.includes(app?.tier || "") &&
            !process.env.OPENROUTER_API_KEY
          ? process.env.CLAUDE_API_KEY
          : ""

      if (claudeKey) {
        const claudeProvider = createAnthropic({ apiKey: claudeKey })
        return {
          provider: claudeProvider(agent.modelId),
          agentName: agent.name,
        }
      }

      // Fallback to OpenRouter
      const openRouterKeyForClaude =
        (appApiKeys.openrouter ? safeDecrypt(appApiKeys.openrouter) : "") ||
        (!plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : "")

      if (openRouterKeyForClaude) {
        const openRouterProvider = createOpenRouter({
          apiKey: openRouterKeyForClaude,
        })

        // Map old model IDs to correct OpenRouter format
        const modelId = "anthropic/claude-sonnet-4.5"

        return {
          provider: openRouterProvider(modelId),
          agentName: agent.name,
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
        (!plusTiers.includes(app?.tier || "") && !process.env.OPENROUTER_API_KEY
          ? process.env.GEMINI_API_KEY
          : "")

      if (geminiKey) {
        const geminiProvider = createGoogleGenerativeAI({ apiKey: geminiKey })
        return {
          provider: geminiProvider(agent.modelId),
          agentName: agent.name,
        }
      }

      // Fallback to OpenRouter
      const openRouterKeyForGemini = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (openRouterKeyForGemini) {
        const openRouterProvider = createOpenRouter({
          apiKey: openRouterKeyForGemini,
        })
        const modelId = "google/gemini-3-pro-preview"
        return {
          provider: openRouterProvider(modelId),
          agentName: agent.name,
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
        : !plusTiers.includes(app?.tier || "") &&
            !process.env.OPENROUTER_API_KEY
          ? process.env.PERPLEXITY_API_KEY
          : ""

      if (perplexityKey) {
        const perplexityProvider = createPerplexity({
          apiKey: perplexityKey,
        })
        return {
          provider: perplexityProvider(agent.modelId),
          agentName: agent.name,
        }
      }

      // Fallback to OpenRouter
      const openRouterKeyForPerplexity = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (openRouterKeyForPerplexity) {
        const openRouterProvider = createOpenRouter({
          apiKey: openRouterKeyForPerplexity,
        })
        // Use sonar-reasoning for tool calling support
        const modelId = "perplexity/sonar-pro"
        return {
          provider: openRouterProvider(modelId),
          agentName: agent.name,
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
      const openRouterKey = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (!openRouterKey) {
        throw new Error("OpenRouter API key required for openrouter agent")
      }

      const openRouterProvider = createOpenRouter({
        apiKey: openRouterKey,
      })
      return {
        provider: openRouterProvider(agent.modelId),
        agentName: agent.name,
      }
    }

    default:
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
