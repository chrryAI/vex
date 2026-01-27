import { createDeepSeek } from "@ai-sdk/deepseek"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { app, getAiAgents, decrypt } from "@repo/db"
import type { LanguageModel } from "ai"
import { appWithStore } from "@chrryai/chrry/types"
import { FRONTEND_URL, isE2E } from "@chrryai/chrry/utils"
import { createPerplexity } from "@ai-sdk/perplexity"

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

  const agent = agents.find((a) => a.name.toLowerCase() === name.toLowerCase())

  if (!agent) {
    // Fallback to DeepSeek if agent not found
    console.log("⚠️ Agent not found, using DeepSeek fallback")
    const deepseekKey = app?.apiKeys?.deepseek
      ? safeDecrypt(app?.apiKeys?.deepseek)
      : app?.tier === "free"
        ? process.env.DEEPSEEK_API_KEY
        : ""
    const deepseekProvider = createDeepSeek({ apiKey: deepseekKey })
    return {
      provider: deepseekProvider("deepseek-chat"),
      agentName: "deepSeek",
    }
  }

  // If agent has appId (custom agent), use its configuration
  // Otherwise use global configuration with app's API keys

  switch (name) {
    case "deepSeek": {
      const deepseekKey = app?.apiKeys?.deepseek
        ? safeDecrypt(app?.apiKeys?.deepseek)
        : app?.tier === "free"
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
        : app?.tier === "free"
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (openRouterKeyForDeepSeek) {
        const openRouterProvider = createOpenAI({
          apiKey: openRouterKeyForDeepSeek,
          baseURL: "https://openrouter.ai/api/v1",
          headers: {
            "HTTP-Referer": FRONTEND_URL,
            "X-Title": "Vex AI",
          },
        })
        const modelId = agent.modelId.startsWith("deepseek/")
          ? agent.modelId
          : `deepseek/${agent.modelId}`
        return {
          provider: openRouterProvider(modelId),
          agentName: agent.name,
        }
      }

      return {
        provider: createDeepSeek({ apiKey: "" })(agent.modelId),
        agentName: agent.name,
      }
    }
    case "sushi": {
      const sushiKey =
        (appApiKeys.deepseek ? safeDecrypt(appApiKeys.deepseek) : "") ||
        (app?.tier === "free" ? process.env.DEEPSEEK_API_KEY : "")

      if (sushiKey) {
        const sushiProvider = createDeepSeek({ apiKey: sushiKey })
        return {
          provider: sushiProvider("deepseek-reasoner"),
          agentName: agent.name,
        }
      }

      // Fallback to OpenRouter
      const openRouterKeyForDeepSeekReasoner = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : app?.tier === "free"
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (openRouterKeyForDeepSeekReasoner) {
        const openRouterProvider = createOpenAI({
          apiKey: openRouterKeyForDeepSeekReasoner,
          baseURL: "https://openrouter.ai/api/v1",
          headers: {
            "HTTP-Referer": FRONTEND_URL,
            "X-Title": "Vex AI",
          },
        })
        const modelId = agent.modelId.startsWith("deepseek/")
          ? agent.modelId
          : `deepseek/${agent.modelId}`
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
        : app?.tier === "free"
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
        (app?.tier === "free" ? process.env.OPENROUTER_API_KEY : "")

      if (openRouterKeyForOpenAI) {
        const openRouterProvider = createOpenAI({
          apiKey: openRouterKeyForOpenAI,
          baseURL: "https://openrouter.ai/api/v1",
          headers: {
            "HTTP-Referer": FRONTEND_URL,
            "X-Title": "Vex AI",
          },
        })
        const modelId = agent.modelId.startsWith("openai/")
          ? agent.modelId
          : `openai/${agent.modelId}`
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
        : app?.tier === "free"
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
        (app?.tier === "free" ? process.env.OPENROUTER_API_KEY : "")

      if (openRouterKeyForClaude) {
        const openRouterProvider = createOpenAI({
          apiKey: openRouterKeyForClaude,
          baseURL: "https://openrouter.ai/api/v1",
          headers: {
            "HTTP-Referer": FRONTEND_URL,
            "X-Title": "Vex AI",
          },
        })
        const modelId = agent.modelId.startsWith("anthropic/")
          ? agent.modelId
          : `anthropic/${agent.modelId}`

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
        (app?.tier === "free" ? process.env.GEMINI_API_KEY : "")

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
        : app?.tier === "free"
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (openRouterKeyForGemini) {
        const openRouterProvider = createOpenAI({
          apiKey: openRouterKeyForGemini,
          baseURL: "https://openrouter.ai/api/v1",
          headers: {
            "HTTP-Referer": FRONTEND_URL,
            "X-Title": "Vex AI",
          },
        })
        const modelId = agent.modelId.startsWith("google/")
          ? agent.modelId
          : `google/${agent.modelId}`
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
        : app?.tier === "free"
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
        : app?.tier === "free"
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (openRouterKeyForPerplexity) {
        const openRouterProvider = createOpenAI({
          apiKey: openRouterKeyForPerplexity,
          baseURL: "https://openrouter.ai/api/v1",
          headers: {
            "HTTP-Referer": FRONTEND_URL,
            "X-Title": "Vex AI",
          },
        })
        const modelId = agent.modelId.startsWith("perplexity/")
          ? agent.modelId
          : `perplexity/${agent.modelId}`
        return {
          provider: openRouterProvider(modelId),
          agentName: agent.name,
        }
      }

      return {
        provider: createOpenAI({
          apiKey: "",
          baseURL: "https://api.perplexity.ai",
        })(agent.modelId),
        agentName: agent.name,
      }
    }

    case "openrouter": {
      const openRouterKey = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : app?.tier === "free"
          ? process.env.OPENROUTER_API_KEY
          : ""
      const openRouterProvider = createOpenAI({
        apiKey: openRouterKey,
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": FRONTEND_URL,
          "X-Title": "Vex AI",
        },
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
        : app?.tier === "free"
          ? process.env.DEEPSEEK_API_KEY
          : ""
      const fallbackProvider = createDeepSeek({ apiKey: fallbackKey })
      return {
        provider: fallbackProvider("deepseek-chat"),
        agentName: "deepSeek",
      }
  }
}
