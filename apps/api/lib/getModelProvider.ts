import { createDeepSeek } from "@ai-sdk/deepseek"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { app, getAiAgents } from "@repo/db"
import type { LanguageModel } from "ai"
import { appWithStore } from "chrry/types"

/**
 * Get the appropriate AI model provider based on agent configuration
 *
 * @param agentId - The ID of the agent to get the model for
 * @param app - Optional app object containing API keys
 * @returns Object with provider (AI SDK model) and agentName
 *
 * Logic:
 * - If agent has appId (custom agent), uses its custom configuration
 * - Otherwise uses global agents with app's API keys or env variables
 * - Falls back to DeepSeek if agent not found or unsupported
 */
export async function getModelProvider(
  app?: app | appWithStore,
  name = "deepSeek",
): Promise<{ provider: LanguageModel; agentName: string }> {
  const agents = app ? await getAiAgents({ include: app.id }) : []

  const agent = app
    ? agents.find(
        (a) =>
          // Priority 1: If the specified name (default: deepSeek) has an API key AND matches this agent
          (name &&
            Object.keys(app.apiKeys || {}).includes(name.toLowerCase()) &&
            a.name.toLowerCase() === name.toLowerCase()) ||
          // Priority 2: Agent assigned to this app
          (app && a.appId === app.id),
      )
    : agents.find((a) => a.name.toLowerCase() === name.toLowerCase())

  if (!agent) {
    // Fallback to DeepSeek if agent not found
    console.log("⚠️ Agent not found, using DeepSeek fallback")
    const deepseekKey = app?.apiKeys?.deepseek || process.env.DEEPSEEK_API_KEY
    const deepseekProvider = createDeepSeek({ apiKey: deepseekKey })
    return {
      provider: deepseekProvider("deepseek-chat"),
      agentName: "deepSeek",
    }
  }

  // If agent has appId (custom agent), use its configuration
  // Otherwise use global configuration with app's API keys
  const appApiKeys = app?.apiKeys || {}

  switch (agent.name) {
    case "deepSeek":
      const deepseekKey = appApiKeys.deepseek || process.env.DEEPSEEK_API_KEY
      const deepseekProvider = createDeepSeek({ apiKey: deepseekKey })
      return {
        provider: deepseekProvider(agent.modelId),
        agentName: agent.name,
      }
    case "sushi":
      const sushiKey = appApiKeys.deepseek || process.env.DEEPSEEK_API_KEY
      const sushiProvider = createDeepSeek({ apiKey: sushiKey })
      return {
        provider: sushiProvider(agent.modelId),
        agentName: agent.name,
      }

    case "chatGPT":
      const openaiKey = appApiKeys.openai || process.env.OPENAI_API_KEY
      const openaiProvider = createOpenAI({ apiKey: openaiKey })
      return { provider: openaiProvider(agent.modelId), agentName: agent.name }

    case "claude":
      const claudeKey = appApiKeys.anthropic || process.env.ANTHROPIC_API_KEY
      const claudeProvider = createAnthropic({ apiKey: claudeKey })
      return { provider: claudeProvider(agent.modelId), agentName: agent.name }

    case "gemini":
      const geminiKey =
        appApiKeys.google || process.env.GOOGLE_GENERATIVE_AI_API_KEY
      const geminiProvider = createGoogleGenerativeAI({ apiKey: geminiKey })
      return { provider: geminiProvider(agent.modelId), agentName: agent.name }

    default:
      // Custom OpenAI-compatible model
      if (agent.appId && agent.apiURL) {
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
      const fallbackKey = appApiKeys.deepseek || process.env.DEEPSEEK_API_KEY
      const fallbackProvider = createDeepSeek({ apiKey: fallbackKey })
      return {
        provider: fallbackProvider("deepseek-chat"),
        agentName: "deepSeek",
      }
  }
}
