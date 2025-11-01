import { createDeepSeek } from "@ai-sdk/deepseek"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { getAiAgent, app } from "@repo/db"
import type { LanguageModel } from "ai"

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
  agentId: string | undefined,
  app?: app,
): Promise<{ provider: LanguageModel; agentName: string }> {
  // Handle default/undefined case - try to get app's default model or fallback
  if (!agentId || agentId === "default") {
    // Try to get app's default model
    if (app?.defaultModel) {
      const defaultAgent = await getAiAgent({ name: app.defaultModel as any })
      if (defaultAgent) {
        agentId = defaultAgent.id
      }
    }

    // If still no agent, use DeepSeek fallback
    if (!agentId || agentId === "default") {
      console.log("⚠️ No agent specified, using DeepSeek fallback")
      const deepseekKey = app?.apiKeys?.deepseek || process.env.DEEPSEEK_API_KEY
      const deepseekProvider = createDeepSeek({ apiKey: deepseekKey })
      return {
        provider: deepseekProvider("deepseek-chat"),
        agentName: "deepSeek",
      }
    }
  }

  // Get the agent details
  const agent = await getAiAgent({ id: agentId })

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
