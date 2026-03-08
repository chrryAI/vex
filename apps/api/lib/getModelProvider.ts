import { createAnthropic } from "@ai-sdk/anthropic"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createPerplexity } from "@ai-sdk/perplexity"
import type { appWithStore } from "@chrryai/chrry/types"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  type aiAgent,
  type app,
  decrypt,
  getAiAgents,
  type scheduledJob,
  updateAiAgent,
} from "@repo/db"
import type { LanguageModel } from "ai"

const plusTiers = ["plus", "pro"]

function safeDecrypt(encryptedKey: string | undefined): string | undefined {
  if (!encryptedKey) return undefined
  try {
    return decrypt(encryptedKey)
  } catch (error) {
    console.warn("⚠️ Failed to decrypt API key, using as-is:", error)
    return encryptedKey
  }
}

// Hocam buraya hangi model ne yapabiliyor yazıyoruz, ai route buna bakıp tool açıp kapatacak
export const modelCapabilities: Record<string, { tools: boolean }> = {
  "gpt-4o": { tools: true },
  "gpt-4o-mini": { tools: true },
  "claude-3-5-sonnet-20241022": { tools: true },
  "claude-3-5-haiku-20241022": { tools: true },
  "anthropic/claude-3.5-sonnet": { tools: true },
  "google/gemini-2.0-flash-lite-preview-02-05": { tools: true },
  "google/gemini-1.5-pro": { tools: true },
  "google/gemini-1.5-flash": { tools: true },
  "deepseek-chat": { tools: true },
  "deepseek-v3": { tools: true },
  "deepseek-reasoner": { tools: true },
  "deepseek/deepseek-r1": { tools: true },
  "qwen/qwen3-235b-a22b-thinking-2507": { tools: true },
  "qwen/qwen3-vl-235b-a22b-thinking": { tools: true },
  // "qwen/qwen3-vl-30b-a3b-thinking": { tools: true },
  "perplexity/sonar-pro": { tools: false },
  "sonar-pro": { tools: false },
  "openai/gpt-oss-120b:free": { tools: false },
}

export async function getModelProvider({
  app,
  name = "deepSeek",
  canReason = true,
  activeSchedule,
  job,
}: {
  app?: app | appWithStore
  name?:
    | "deepSeek"
    | "chatGPT"
    | "claude"
    | "sushi"
    | "gemini"
    | "perplexity"
    | "grok"
    | "flux"
    | "openrouter"
    | string
  canReason?: boolean
  job?: scheduledJob
  activeSchedule?: {
    modelId?: string
    time: string // "09:00"
    model: string
    postType: "post" | "comment" | "engagement"
    charLimit: number
    credits: number
    generateImage?: boolean
    generateVideo?: boolean
    fetchNews?: boolean
    languages?: string[]
    maxTokens?: number // Optional max tokens for AI generation
    intervalMinutes?: number // Optional interval for custom frequency (e.g., 60 = every hour)
  }
}): Promise<{
  provider: LanguageModel
  modelId: string
  agentName: string
  lastKey?: string
  supportsTools: boolean
}> {
  const appApiKeys = app?.apiKeys || {}

  const agents = await getAiAgents({ include: app?.id })
  // Hocam case-insensitive yapalım ki name="deepseek" da "deepSeek" de çalışsın
  let agent =
    agents.find((a) => a.name.toLowerCase() === name.toLowerCase()) || agents[0]

  const failedKeys = agent?.metadata?.failed

  if (!agent) {
    agent = agents.find((a) => a.name === "deepSeek") as aiAgent
    if (!agent) {
      throw new Error(
        "No suitable AI agent found in the database (deepSeek fallback missing)",
      )
    }
  }

  // Hocam burası kritik: Eğer job'da özel bir model override varsa onu kullanıyoruz
  const targetModelId = job?.modelConfig?.model || agent.modelId

  let result: {
    provider: LanguageModel
    modelId: string
    agentName: string
    lastKey?: string
  }

  const toSwitch = name === "beles" ? name : agent.name

  switch (toSwitch) {
    case "beles": {
      const openrouterKey =
        safeDecrypt(app?.apiKeys?.openrouter) || process.env.OPENROUTER_API_KEY

      if (openrouterKey) {
        const freeModels = [
          // "openrouter/free", // En kolay, auto-rotasyon
          // "arcee-ai/trinity-large-preview:free",
          // "nvidia/nemotron-3-nano-30b-a3b:free",
          // "meta-llama/llama-3.3-70b-instruct:free",
          "qwen/qwen3-vl-235b-a22b-thinking",
        ]

        // LRU rotasyon (mevcut sortedPool logicini kullan)
        const failed = agent.metadata?.failed || []
        const active = freeModels.filter((m) => !failed.includes(m))
        const modelId =
          active.sort((a, b) => {
            const metadata = agent.metadata as Record<string, any> | undefined
            const dateA = metadata?.[a] ? new Date(metadata[a]).getTime() : 0
            const dateB = metadata?.[b] ? new Date(metadata[b]).getTime() : 0
            return dateA - dateB
          })[0] || "openrouter/free"

        const provider = createOpenRouter({ apiKey: openrouterKey })

        // Modeli metadata'ya timestamp at (load balancing)
        updateAiAgent({
          id: agent.id,
          metadata: { ...agent.metadata, [modelId]: new Date() },
        })

        return {
          provider: provider(modelId),
          modelId,
          agentName: "deepSeek", // now we have to for BC
          supportsTools: false, // Zorla kapat
        }
      }

      // Fallback: Perplexity (no tools zaten)
      return {
        provider: createDeepSeek({ apiKey: "" })(targetModelId),
        modelId: targetModelId,
        agentName: agent.name,
        supportsTools: false,
      }
    }
    case "deepSeek": {
      const deepseekKey = app?.apiKeys?.deepseek
        ? safeDecrypt(app?.apiKeys?.deepseek)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.DEEPSEEK_API_KEY
          : ""

      if (deepseekKey && !failedKeys?.includes("deepSeek")) {
        const deepseekProvider = createDeepSeek({ apiKey: deepseekKey })
        result = {
          provider: deepseekProvider(
            targetModelId === "deepseek-reasoner"
              ? targetModelId
              : "deepseek-chat",
          ),
          modelId:
            targetModelId === "deepseek-reasoner"
              ? targetModelId
              : "deepseek-chat",
          agentName: agent.name,
          lastKey: "deepSeek",
        }
        break
      }

      const openrouterKeyForDeepSeek = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      const modelId = targetModelId.startsWith("deepseek/")
        ? targetModelId
        : `deepseek/${targetModelId}`
      if (openrouterKeyForDeepSeek && !failedKeys?.includes(modelId)) {
        const openrouterProvider = createOpenRouter({
          apiKey: openrouterKeyForDeepSeek,
        })

        result = {
          provider: openrouterProvider(modelId),
          modelId,
          agentName: agent.name,
          lastKey: "openrouter",
        }
        break
      }

      console.warn("⚠️ No DeepSeek API key found, falling back to ChatGPT")
      const chatgptKey = app?.apiKeys?.openai
        ? safeDecrypt(app?.apiKeys?.openai)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY
          : ""

      if (chatgptKey && !failedKeys?.includes("gpt-4o")) {
        const openaiProvider = createOpenAI({
          apiKey: chatgptKey,
        })
        result = {
          provider: openaiProvider("gpt-4o"),
          modelId: "gpt-4o",
          agentName: "chatGPT",
          lastKey: "chatGPT",
        }
        break
      }

      console.error("❌ No API keys available for DeepSeek or ChatGPT fallback")
      result = {
        provider: createDeepSeek({ apiKey: "" })(targetModelId),
        modelId: targetModelId,
        agentName: agent.name,
      }
      break
    }

    case "sushi": {
      const openrouterKeyForDeepSeekReasoner = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      const rawKeys =
        openrouterKeyForDeepSeekReasoner || process.env.OPENROUTER_KEYS || ""
      const allKeys = rawKeys
        .split(",")
        .map((k: string) => k.trim())
        .filter(Boolean)

      const keyIndex =
        Math.floor(Date.now() / (1000 * 60 * 30)) % (allKeys.length || 1)
      const selectedKey = allKeys[keyIndex] || openrouterKeyForDeepSeekReasoner

      const freeModels = {
        reaction: ["qwen/qwen3-235b-a22b-thinking-2507"],
        comment: ["qwen/qwen3-vl-235b-a22b-thinking"],
        post: [
          "qwen/qwen3-235b-a22b-thinking-2507",
          "qwen/qwen3-vl-235b-a22b-thinking",
        ],
      }

      // Kategori belirleme: Job objesindeki jobType üzerinden nokta atışı yapıyoruz
      let category: keyof typeof freeModels | undefined

      if (job?.jobType) {
        if (job.jobType.includes("comment")) category = "comment"
        else if (job.jobType.includes("engage")) category = "reaction"
        else category = "post"
      } else {
        // Job gelmeme ihtimaline karşı fallback
        const taskTypeFallback = name.toLowerCase()
        if (
          taskTypeFallback.includes("reaction") ||
          taskTypeFallback.includes("like")
        )
          category = "reaction"
        else if (
          taskTypeFallback.includes("comment") ||
          taskTypeFallback.includes("reply")
        )
          category = "comment"
      }

      const sushiKey =
        (appApiKeys.deepseek ? safeDecrypt(appApiKeys.deepseek) : "") ||
        (!plusTiers.includes(app?.tier || "")
          ? process.env.DEEPSEEK_API_KEY
          : "")
      {
        const modelId =
          canReason && !job ? "deepseek-reasoner" : "deepseek-chat"
        if (
          sushiKey &&
          !failedKeys?.includes(modelId) &&
          (!category || category === "post")
        ) {
          const sushiProvider = createDeepSeek({ apiKey: sushiKey })

          result = {
            provider: sushiProvider(modelId),
            modelId,
            agentName: agent.name,
            lastKey: "deepSeek",
          }
          break
        }
      }

      const pool = category ? freeModels[category as "post"] : []
      const failedModels = (agent.metadata?.failed || []) as string[]
      const activePool = pool?.filter((m) => !failedModels.includes(m)) || []

      // Sort by last called date (least recently used first) to spread load
      const sortedPool = [...activePool].sort((a, b) => {
        const dateA = (agent.metadata as any)?.[a]
          ? new Date((agent.metadata as any)[a]).getTime()
          : 0
        const dateB = (agent.metadata as any)?.[b]
          ? new Date((agent.metadata as any)[b]).getTime()
          : 0
        return dateA - dateB
      })

      const modelId =
        activeSchedule?.modelId ||
        job?.metadata?.modelId ||
        sortedPool[0] ||
        (activePool?.length > 0 ? activePool[0] : pool[0]) ||
        "qwen/qwen3-235b-a22b-thinking-2507"

      if (openrouterKeyForDeepSeekReasoner && !failedKeys?.includes(modelId)) {
        // Hocam inci gibi dizelim: Seçtiğimiz başarılı modeli hemen tarihlendiriyoruz
        // Await etmiyoruz ki akışı bozmasın (background update)
        updateAiAgent({
          id: agent.id,
          metadata: {
            ...agent.metadata,
            [modelId]: new Date(),
          },
        }).catch((e) => console.error("⚠️ Failed to update agent metadata:", e))

        const provider = createOpenRouter({
          apiKey: selectedKey,
          extraBody: {
            models: [modelId],
            include_reasoning: true, // Hocam, model düşünsün taşınsın, mermi gibi cevap gelsin
          },
        })

        result = {
          provider: provider(modelId),
          modelId,
          agentName: agent.name,
          lastKey: "openrouter",
        }
        break
      }

      result = {
        provider: createDeepSeek({ apiKey: "" })("deepseek-reasoner"),
        modelId: "deepseek-reasoner",
        agentName: agent.name,
      }

      break
    }

    case "chatGPT": {
      const openaiKey = app?.apiKeys?.openai
        ? safeDecrypt(app?.apiKeys?.openai)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.CHATGPT_API_KEY
          : ""

      if (openaiKey && !failedKeys?.includes(targetModelId)) {
        const openaiProvider = createOpenAI({ apiKey: openaiKey })
        result = {
          provider: openaiProvider(targetModelId),
          modelId: targetModelId,
          agentName: agent.name,
          lastKey: "chatGPT",
        }
        break
      }

      const openrouterKeyForOpenAI =
        (appApiKeys.openrouter ? safeDecrypt(appApiKeys.openrouter) : "") ||
        (!plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : "")

      const modelId = job?.modelConfig?.model || "openai/gpt-5.2-pro"

      if (openrouterKeyForOpenAI && !failedKeys?.includes(modelId)) {
        const openrouterProvider = createOpenRouter({
          apiKey: openrouterKeyForOpenAI,
        })
        result = {
          provider: openrouterProvider(modelId),
          modelId,
          agentName: agent.name,
          lastKey: "openrouter",
        }
        break
      }

      result = {
        provider: createOpenAI({ apiKey: "" })(targetModelId),
        modelId: targetModelId,
        agentName: agent.name,
      }
      break
    }

    case "claude": {
      const claudeKey = app?.apiKeys?.anthropic
        ? safeDecrypt(app?.apiKeys?.anthropic)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.CLAUDE_API_KEY
          : ""

      const modelId = targetModelId.replace(/^anthropic\//, "")

      if (claudeKey && !failedKeys?.includes(modelId)) {
        const claudeProvider = createAnthropic({ apiKey: claudeKey })
        result = {
          provider: claudeProvider(modelId),
          modelId: targetModelId,
          agentName: agent.name,
          lastKey: "claude",
        }
        break
      }

      const openrouterKeyForClaude =
        (appApiKeys.openrouter ? safeDecrypt(appApiKeys.openrouter) : "") ||
        (!plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : "")

      {
        const modelId = job?.modelConfig?.model || "anthropic/claude-sonnet-4-6"

        if (openrouterKeyForClaude && !failedKeys?.includes(modelId)) {
          const openrouterProvider = createOpenRouter({
            apiKey: openrouterKeyForClaude,
          })
          result = {
            provider: openrouterProvider(modelId),
            modelId,
            agentName: agent.name,
            lastKey: "openrouter",
          }
          break
        }
      }

      if (openrouterKeyForClaude) {
        const openrouterProvider = createOpenRouter({
          apiKey: openrouterKeyForClaude,
        })
        result = {
          provider: openrouterProvider(targetModelId),
          modelId: targetModelId,
          agentName: agent.name,
          lastKey: "openrouter",
        }
        break
      }

      result = {
        provider: createAnthropic({ apiKey: "" })(targetModelId),
        modelId: targetModelId,
        agentName: agent.name,
      }
      break
    }

    case "gemini": {
      const geminiKey =
        (appApiKeys.google ? safeDecrypt(appApiKeys.google) : "") ||
        (!plusTiers.includes(app?.tier || "") ? process.env.GEMINI_API_KEY : "")

      if (geminiKey && !failedKeys?.includes(targetModelId)) {
        const geminiProvider = createGoogleGenerativeAI({ apiKey: geminiKey })
        const modelId = targetModelId.replace(/^google\//, "")
        result = {
          provider: geminiProvider(modelId),
          modelId: targetModelId,
          lastKey: "gemini",
          agentName: agent.name,
        }
        break
      }

      const openrouterKeyForGemini = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      const modelId = job?.modelConfig?.model || "google/gemini-3.1-pro-preview"

      if (openrouterKeyForGemini && !failedKeys?.includes(modelId)) {
        const openrouterProvider = createOpenRouter({
          apiKey: openrouterKeyForGemini,
        })
        result = {
          provider: openrouterProvider(modelId),
          modelId,
          agentName: agent.name,
          lastKey: "openrouter",
        }
        break
      }

      result = {
        provider: createGoogleGenerativeAI({ apiKey: "" })(targetModelId),
        modelId: targetModelId,
        agentName: agent.name,
      }
      break
    }

    case "grok": {
      const xaiKey = app?.apiKeys?.xai
        ? safeDecrypt(app?.apiKeys?.xai)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.XAI_API_KEY
          : ""

      if (xaiKey && !failedKeys?.includes(targetModelId)) {
        const xaiProvider = createOpenAI({
          apiKey: xaiKey,
          baseURL: "https://api.x.ai/v1",
        })
        const defaultGrokModel = canReason
          ? "grok-4-1-fast-reasoning"
          : "grok-4-1-fast"
        const modelId = job?.modelConfig?.model || defaultGrokModel
        result = {
          provider: xaiProvider(modelId),
          modelId,
          agentName: agent.name,
          lastKey: "xai",
        }
        break
      }

      const modelId = targetModelId.startsWith("x-ai/")
        ? targetModelId
        : `x-ai/${targetModelId}`

      const openrouterKeyForGrok = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      if (openrouterKeyForGrok && !failedKeys?.includes(modelId)) {
        const openrouterProvider = createOpenRouter({
          apiKey: openrouterKeyForGrok,
        })

        result = {
          provider: openrouterProvider(modelId),
          modelId,
          agentName: agent.name,
          lastKey: "openrouter",
        }
        break
      }

      result = {
        provider: createOpenAI({
          apiKey: "",
          baseURL: "https://api.x.ai/v1",
        })(targetModelId),
        modelId: targetModelId,
        agentName: agent.name,
      }
      break
    }

    case "perplexity": {
      const perplexityKey = app?.apiKeys?.perplexity
        ? safeDecrypt(app?.apiKeys?.perplexity)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.PERPLEXITY_API_KEY
          : ""

      if (perplexityKey && !failedKeys?.includes(targetModelId)) {
        const perplexityProvider = createPerplexity({
          apiKey: perplexityKey,
        })
        result = {
          provider: perplexityProvider(targetModelId),
          modelId: targetModelId,
          agentName: agent.name,
          lastKey: "perplexity",
        }
        break
      }

      const openrouterKeyForPerplexity = app?.apiKeys?.openrouter
        ? safeDecrypt(app?.apiKeys?.openrouter)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.OPENROUTER_API_KEY
          : ""

      const modelId = job?.modelConfig?.model || "perplexity/sonar-pro"

      if (openrouterKeyForPerplexity && !failedKeys?.includes(modelId)) {
        const openrouterProvider = createOpenRouter({
          apiKey: openrouterKeyForPerplexity,
        })
        result = {
          provider: openrouterProvider(modelId),
          modelId,
          agentName: agent.name,
          lastKey: "openrouter",
        }
        break
      }

      result = {
        provider: createOpenRouter({
          apiKey: "",
          baseURL: "https://api.perplexity.ai",
        })(targetModelId),
        modelId: targetModelId,
        agentName: agent.name,
      }
      break
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
      result = {
        provider: openrouterProvider(targetModelId),
        modelId: targetModelId,
        agentName: agent.name,
        lastKey: "openrouter",
      }
      break
    }

    default: {
      if (agent.apiURL) {
        console.log("🤖 Using custom agent:", agent.name)

        const [customBaseURL, customApiKey] = (agent.apiURL || "").includes("|")
          ? (agent.apiURL as string).split("|")
          : ["https://api.openai.com/v1", agent.apiURL]

        // Hocam burası kritik: Eğer OpenRouter kullanıyorsak createOpenRouter kullanalım
        if (
          (customBaseURL || "").includes("openrouter.ai") ||
          (targetModelId || "").includes("/")
        ) {
          const openrouterProvider = createOpenRouter({
            apiKey: customApiKey || process.env.OPENROUTER_API_KEY || "",
          })
          result = {
            provider: openrouterProvider(targetModelId),
            modelId: targetModelId,
            agentName: agent.name,
            lastKey: "openrouter",
          }
        } else {
          const customProvider = createOpenAI({
            apiKey: customApiKey,
            baseURL: customBaseURL,
          })
          result = {
            provider: customProvider(targetModelId),
            modelId: targetModelId,
            agentName: agent.name,
          }
        }
        break
      }

      console.log("⚠️ Unknown agent, using DeepSeek fallback")
      const fallbackKey = app?.apiKeys?.deepseek
        ? safeDecrypt(app?.apiKeys?.deepseek)
        : !plusTiers.includes(app?.tier || "")
          ? process.env.DEEPSEEK_API_KEY
          : ""
      const fallbackProvider = createDeepSeek({ apiKey: fallbackKey })
      result = {
        provider: fallbackProvider("deepseek-chat"),
        modelId: "deepseek-chat",
        agentName: "deepSeek",
      }
      break
    }
  }

  // Model ID'ye göre tool desteğini kontrol ediyoruz
  const supportsTools = modelCapabilities[result.modelId]?.tools ?? false

  return {
    ...result,
    supportsTools,
  }
}

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
