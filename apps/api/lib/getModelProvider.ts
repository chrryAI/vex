import { createAnthropic } from "@ai-sdk/anthropic"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createPerplexity } from "@ai-sdk/perplexity"
import type { appWithStore } from "@chrryai/chrry/types"
import { isE2E } from "@chrryai/chrry/utils"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  type aiAgent,
  type app,
  decrypt,
  getAiAgents,
  type guest,
  type scheduledJob,
  updateAiAgent,
  type user,
  type userWithRelations,
} from "@repo/db"
import type { LanguageModel } from "ai"

const plusTiers = ["plus", "pro"]

/**
 * E2e'de her app free tier gibi davransın (env key'lere erişsin).
 * Production'da gerçek tier'a bakılır.
 */
function isFreeTier(app?: { tier?: string | null } | null): boolean {
  if (isE2E) return true
  return !plusTiers.includes(app?.tier || "")
}

function safeDecrypt(encryptedKey: string | undefined): string | undefined {
  if (!encryptedKey) return undefined

  // If already masked (contains '...'), don't try to decrypt
  if (encryptedKey.includes("...")) {
    console.warn("⚠️ API key is already masked, cannot decrypt")
    return undefined
  }

  try {
    return decrypt(encryptedKey)
  } catch (error) {
    // Return undefined so callers fall through to env-var keys
    // (returning the raw encrypted blob would cause 401 "Missing Authentication header")
    console.warn(
      "⚠️ Failed to decrypt API key, skipping:",
      (error as Error).message,
    )
    return undefined
  }
}

/**
 * BYOK path: if the user/guest has set a key but decrypt fails,
 * throw a clear error instead of silently falling back to platform keys.
 * This prevents billing the platform for a user's failed key.
 * In e2e, keys are fake so we skip and return undefined (fallback to env).
 */
function byokDecrypt(encryptedKey: string | undefined): string | undefined {
  if (!encryptedKey) return undefined
  if (encryptedKey.includes("...")) return undefined

  try {
    return decrypt(encryptedKey)
  } catch (error) {
    if (isE2E) {
      // e2e uses fake keys — silently skip, fall through to env var
      return undefined
    }
    throw new Error(
      "Your API key could not be decrypted. Please re-enter it in Settings.",
    )
  }
}

/**
 * Hocam DeepSeek native API'si bazen yeni model isimlerini (v3.2 vs) direkt yemiyor.
 * Onların anladığı dilden konuşalım: chat veya reasoner.
 */
function mapDeepSeekModel(modelId: string): string {
  const lower = modelId.toLowerCase()
  if (
    lower.includes("thinking") ||
    lower.includes("reasoner") ||
    lower.includes("speciale") ||
    lower.includes("r1")
  ) {
    return "deepseek-reasoner"
  }
  return "deepseek-chat"
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
  "deepseek/deepseek-chat": { tools: true },
  "deepseek-v3": { tools: true },
  "deepseek-reasoner": { tools: true },
  "deepseek/deepseek-r1": { tools: true },
  "deepseek/deepseek-v3.2": { tools: true },
  "deepseek/deepseek-v3.2-thinking": { tools: true },
  "deepseek/deepseek-v3.2-speciale": { tools: false },
  "deepseek-v3.2": { tools: true },
  "deepseek-v3.2-speciale": { tools: false },
  "gpt-5.2-pro": { tools: true },
  "anthropic/claude-sonnet-4-6": { tools: true },
  "google/gemini-3.1-pro-preview": { tools: true },
  "grok-4-1-fast-reasoning": { tools: true },
  "grok-4-1-fast-non-reasoning": { tools: true },
  "x-ai/grok-4-1-fast-reasoning": { tools: true },
  "deepseek-v3.2-thinking": { tools: true },
  "perplexity/sonar-pro": { tools: false },
  "sonar-pro": { tools: false },
  "openai/gpt-oss-120b:free": { tools: false },
}

export async function getModelProvider({
  app,
  name = "deepSeek",
  canReason = true,
  activeSchedule,
  user,
  guest,
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
  user?: user | userWithRelations | null
  guest?: guest | null
  activeSchedule?: {
    modelId?: string
    time: string // "09:00"
    model: string
    postType: "post" | "comment" | "engagement" | "autonomous"
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

  const isBYOK = !!user?.apiKeys?.openrouter || !!guest?.apiKeys?.openrouter

  const agents = await getAiAgents({ include: app?.id })
  // Hocam case-insensitive yapalım ki name="deepseek" da "deepSeek" de çalışsın
  let agent = agents.find((a) => a.name.toLowerCase() === name.toLowerCase())

  const failedKeys = isBYOK ? [] : agent?.metadata?.failed

  if (!agent) {
    agent = agents.find((a) => a.name === "deepSeek") as aiAgent
    if (!agent) {
      throw new Error(
        "No suitable AI agent found in the database (deepSeek fallback missing)",
      )
    }
  }

  // Hocam burası kritik: Eğer job'da özel bir model override varsa onu kullanıyoruz.
  // DB'deki stale datalardan kurtulduk ama job'dan gelen dinamik override'ı koruyoruz.
  const targetModelId = job?.modelConfig?.model

  let result: {
    provider: LanguageModel
    modelId: string
    agentName: string
    lastKey?: string
  }

  const toSwitch = agent.name

  switch (toSwitch) {
    case "beles": {
      const openrouterKey =
        byokDecrypt(user?.apiKeys?.openrouter) ||
        byokDecrypt(guest?.apiKeys?.openrouter) ||
        safeDecrypt(app?.apiKeys?.openrouter) ||
        process.env.OPENROUTER_API_KEY

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

      const modelId = targetModelId || "deepseek-chat"
      console.warn(
        `⚠️ Creating fallback DeepSeek provider with empty API key for model ${modelId} (agent: ${agent.name})`,
      )
      // Deliberate non-authenticated stub for graceful failure (warnings are logged above)
      return {
        provider: createDeepSeek({ apiKey: "" })(modelId),
        modelId: modelId,
        agentName: agent.name,
        supportsTools: false,
      }
    }
    case "deepSeek": {
      const byokKey = user?.apiKeys?.openrouter
        ? byokDecrypt(user?.apiKeys?.openrouter)
        : guest?.apiKeys?.openrouter
          ? byokDecrypt(guest?.apiKeys?.openrouter)
          : undefined

      const deepseekKey = byokKey
        ? undefined
        : app?.apiKeys?.deepseek
          ? safeDecrypt(app?.apiKeys?.deepseek)
          : isFreeTier(app)
            ? process.env.DEEPSEEK_API_KEY
            : ""

      if (deepseekKey) {
        const deepseekProvider = createDeepSeek({ apiKey: deepseekKey })
        const resolvedId = targetModelId || "deepseek-chat"
        const effectiveModel = mapDeepSeekModel(resolvedId)

        result = {
          provider: deepseekProvider(effectiveModel),
          modelId: resolvedId,
          agentName: agent.name,
          lastKey: "deepSeek",
        }
        break
      }

      const openrouterKeyForDeepSeek = byokKey
        ? byokKey
        : app?.apiKeys?.openrouter
          ? safeDecrypt(app?.apiKeys?.openrouter)
          : isFreeTier(app)
            ? process.env.OPENROUTER_API_KEY
            : ""

      const modelId = targetModelId || "deepseek/deepseek-chat"
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
        : isFreeTier(app)
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
      const fallbackModel = "deepseek-chat"
      console.warn(
        `⚠️ Creating fallback DeepSeek provider with empty API key for model ${fallbackModel} (agent: ${agent.name})`,
      )
      // Deliberate non-authenticated stub for graceful failure (warnings are logged above)
      result = {
        provider: createDeepSeek({ apiKey: "" })(fallbackModel),
        modelId: fallbackModel,
        agentName: agent.name,
      }
      break
    }

    case "sushi": {
      const byokKey = user?.apiKeys?.openrouter
        ? byokDecrypt(user?.apiKeys?.openrouter)
        : guest?.apiKeys?.openrouter
          ? byokDecrypt(guest?.apiKeys?.openrouter)
          : undefined
      const sushiKey = byokKey
        ? undefined
        : app?.apiKeys?.deepseek
          ? safeDecrypt(app?.apiKeys?.deepseek)
          : isFreeTier(app)
            ? process.env.DEEPSEEK_API_KEY
            : ""

      {
        const modelId =
          canReason && !job ? "deepseek-v3.2-thinking" : "deepseek-v3.2"
        if (sushiKey) {
          const sushiProvider = createDeepSeek({ apiKey: sushiKey })
          const effectiveModel = mapDeepSeekModel(modelId)

          result = {
            provider: sushiProvider(effectiveModel),
            modelId: modelId, // Use the pretty name for capabilities check
            agentName: agent.name,
            lastKey: "deepSeek",
          }
          break
        }
      }

      const openrouterKeyForDeepSeekReasoner = byokKey
        ? byokKey
        : app?.apiKeys?.openrouter
          ? safeDecrypt(app?.apiKeys?.openrouter)
          : isFreeTier(app)
            ? process.env.OPENROUTER_API_KEY
            : undefined

      const rawKeys = openrouterKeyForDeepSeekReasoner || ""
      const allKeys = rawKeys
        .split(",")
        .map((k: string) => k.trim())
        .filter(Boolean)

      const keyIndex =
        Math.floor(Date.now() / (1000 * 60 * 30)) % (allKeys.length || 1)
      const selectedKey = openrouterKeyForDeepSeekReasoner || allKeys[keyIndex]

      const freeModels = {
        reaction: ["qwen/qwen3-235b-a22b-thinking-2507"],
        comment: ["qwen/qwen3-vl-235b-a22b-thinking"],
        post: [
          "qwen/qwen3-235b-a22b-thinking-2507",
          "qwen/qwen3-vl-235b-a22b-thinking",
        ],
      }

      // Hocam if it's not a job and we have BYOK, don't use the free pool
      const useFreePool = !isBYOK || !!job

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

      const pool =
        useFreePool && category
          ? freeModels[category as "post"]
          : [
              category === "comment"
                ? "qwen/qwen3-vl-235b-a22b-thinking"
                : "qwen/qwen3-235b-a22b-thinking-2507",
            ]
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

      console.warn(
        `⚠️ Creating fallback DeepSeek provider with empty API key for model deepseek-reasoner (agent: ${agent.name})`,
      )
      // Deliberate non-authenticated stub for graceful failure (warnings are logged above)
      result = {
        provider: createDeepSeek({ apiKey: "" })("deepseek-reasoner"),
        modelId: "deepseek-reasoner",
        agentName: agent.name,
      }

      break
    }

    case "chatGPT": {
      const byokKey = user?.apiKeys?.openrouter
        ? byokDecrypt(user?.apiKeys?.openrouter)
        : guest?.apiKeys?.openrouter
          ? byokDecrypt(guest?.apiKeys?.openrouter)
          : undefined
      const modelId =
        job?.modelConfig?.model || targetModelId || "openai/gpt-5.4"

      const openrouterKeyForOpenAI = byokKey
        ? byokKey
        : appApiKeys.openrouter
          ? safeDecrypt(appApiKeys.openrouter)
          : isFreeTier(app)
            ? process.env.OPENROUTER_API_KEY
            : isFreeTier(app)
              ? process.env.OPENROUTER_API_KEY
              : ""

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

      // OpenAI fallback (ucuz modeller)
      // Bu Vercel daha update etmemis
      const safeModels = ["gpt-4o", "gpt-4o-mini"] // ← 5.4 yok diye patlamasın
      const openaiKey = app?.apiKeys?.openai
        ? safeDecrypt(app?.apiKeys?.openai)
        : process.env.OPENAI_API_KEY

      for (const safeModel of safeModels) {
        if (openaiKey && !failedKeys?.includes(safeModel)) {
          const openaiProvider = createOpenAI({ apiKey: openaiKey })
          result = {
            provider: openaiProvider(safeModel),
            modelId: safeModel, // ← Gerçek model
            agentName: agent.name,
            lastKey: "chatGPT",
          }
          break
        }
      }

      const fallbackModel = "gpt-4o-mini"
      console.warn(
        `⚠️ Creating fallback OpenAI provider with empty API key for model ${fallbackModel} (agent: ${agent.name})`,
      )
      // Deliberate non-authenticated stub for graceful failure (warnings are logged above)
      result = {
        provider: createOpenAI({ apiKey: "" })(fallbackModel),
        modelId: fallbackModel,
        agentName: agent.name,
      }
      break
    }

    case "claude": {
      const byokKey = user?.apiKeys?.openrouter
        ? byokDecrypt(user?.apiKeys?.openrouter)
        : guest?.apiKeys?.openrouter
          ? byokDecrypt(guest?.apiKeys?.openrouter)
          : undefined
      const claudeKey = byokKey
        ? undefined
        : app?.apiKeys?.anthropic
          ? safeDecrypt(app?.apiKeys?.anthropic)
          : isFreeTier(app)
            ? process.env.CLAUDE_API_KEY
            : ""

      const modelId = targetModelId || "anthropic/claude-sonnet-4-6"

      if (
        claudeKey &&
        !failedKeys?.includes(modelId.replace(/^anthropic\//, ""))
      ) {
        const claudeProvider = createAnthropic({ apiKey: claudeKey })
        result = {
          provider: claudeProvider(modelId.replace(/^anthropic\//, "")),
          modelId: modelId,
          agentName: agent.name,
          lastKey: "claude",
        }
        break
      }

      const openrouterKeyForClaude = byokKey
        ? byokKey
        : appApiKeys.openrouter
          ? safeDecrypt(appApiKeys.openrouter)
          : isFreeTier(app)
            ? process.env.OPENROUTER_API_KEY
            : ""

      {
        // For scheduled jobs, use DeepSeek instead of expensive Claude
        const scheduledModelId =
          activeSchedule?.modelId ||
          job?.metadata?.modelId ||
          job?.modelConfig?.model ||
          "anthropic/claude-sonnet-4-6"

        if (openrouterKeyForClaude && !failedKeys?.includes(scheduledModelId)) {
          const openrouterProvider = createOpenRouter({
            apiKey: openrouterKeyForClaude,
          })
          result = {
            provider: openrouterProvider(scheduledModelId),
            modelId: scheduledModelId,
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
        const resolvedId = targetModelId || modelId
        result = {
          provider: openrouterProvider(resolvedId),
          modelId: resolvedId,
          agentName: agent.name,
          lastKey: "openrouter",
        }
        break
      }

      const fallbackModel = "anthropic/claude-sonnet-4-6"
      console.warn(
        `⚠️ Creating fallback Anthropic provider with empty API key for model ${fallbackModel} (agent: ${agent.name})`,
      )
      // Deliberate non-authenticated stub for graceful failure (warnings are logged above)
      result = {
        provider: createAnthropic({ apiKey: "" })(
          fallbackModel.replace(/^anthropic\//, ""),
        ),
        modelId: fallbackModel,
        agentName: agent.name,
      }
      break
    }

    case "gemini": {
      const byokKey = user?.apiKeys?.openrouter
        ? byokDecrypt(user?.apiKeys?.openrouter)
        : guest?.apiKeys?.openrouter
          ? byokDecrypt(guest?.apiKeys?.openrouter)
          : undefined
      const geminiKey = byokKey
        ? undefined
        : appApiKeys.google
          ? safeDecrypt(appApiKeys.google)
          : isFreeTier(app)
            ? process.env.GEMINI_API_KEY
            : ""

      {
        const modelId = targetModelId || "google/gemini-3.1-pro-preview"

        if (geminiKey && !failedKeys?.includes(modelId)) {
          const geminiProvider = createGoogleGenerativeAI({ apiKey: geminiKey })
          result = {
            provider: geminiProvider(modelId.replace(/^google\//, "")),
            modelId: modelId,
            lastKey: "gemini",
            agentName: agent.name,
          }
          break
        }
      }

      const openrouterKeyForGemini = byokKey
        ? byokKey
        : app?.apiKeys?.openrouter
          ? safeDecrypt(app?.apiKeys?.openrouter)
          : isFreeTier(app)
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

      const fallbackModel = "google/gemini-1.5-flash"
      console.warn(
        `⚠️ Creating fallback Gemini provider with empty API key for model ${fallbackModel} (agent: ${agent.name})`,
      )
      // Deliberate non-authenticated stub for graceful failure (warnings are logged above)
      result = {
        provider: createGoogleGenerativeAI({ apiKey: "" })(
          fallbackModel.replace(/^google\//, ""),
        ),
        modelId: fallbackModel,
        agentName: agent.name,
      }
      break
    }

    case "grok": {
      const byokKey = user?.apiKeys?.openrouter
        ? byokDecrypt(user?.apiKeys?.openrouter)
        : guest?.apiKeys?.openrouter
          ? byokDecrypt(guest?.apiKeys?.openrouter)
          : undefined
      const xaiKey = byokKey
        ? undefined
        : app?.apiKeys?.xai
          ? safeDecrypt(app?.apiKeys?.xai)
          : isFreeTier(app)
            ? process.env.XAI_API_KEY
            : ""

      {
        const defaultGrokModel =
          job?.modelConfig?.model ||
          (canReason
            ? "grok-4-1-fast-reasoning"
            : "grok-4-1-fast-non-reasoning")

        if (xaiKey && !failedKeys?.includes(defaultGrokModel)) {
          const xaiProvider = createOpenAI({
            apiKey: xaiKey,
            baseURL: "https://api.x.ai/v1",
          })

          const modelIdToUse = defaultGrokModel.replace(/^x-ai\//, "")
          result = {
            provider: xaiProvider(modelIdToUse),
            modelId: defaultGrokModel,
            agentName: agent.name,
            lastKey: "xai",
          }
          break
        }
      }

      {
        const modelId = "x-ai/grok-4.1-fast"

        const openrouterKeyForGrok = byokKey
          ? byokKey
          : app?.apiKeys?.openrouter
            ? safeDecrypt(app?.apiKeys?.openrouter)
            : isFreeTier(app)
              ? process.env.OPENROUTER_API_KEY
              : ""

        if (openrouterKeyForGrok && !failedKeys?.includes(modelId)) {
          const openrouterProvider = createOpenRouter({
            apiKey: openrouterKeyForGrok,
          })

          result = {
            provider: openrouterProvider(targetModelId || modelId),
            modelId: targetModelId || modelId,
            agentName: agent.name,
            lastKey: "openrouter",
          }
          break
        }
      }

      console.warn(
        `⚠️ Creating fallback DeepSeek provider with empty API key for model deepseek-reasoner (agent: ${agent.name})`,
      )
      result = {
        provider: createDeepSeek({ apiKey: "" })("deepseek-reasoner"),
        modelId: "deepseek-reasoner",
        agentName: agent.name,
      }

      break
    }

    case "perplexity": {
      const byokKey = user?.apiKeys?.openrouter
        ? byokDecrypt(user?.apiKeys?.openrouter)
        : guest?.apiKeys?.openrouter
          ? byokDecrypt(guest?.apiKeys?.openrouter)
          : undefined
      const modelId = job?.modelConfig?.model || "perplexity/sonar-pro"

      const perplexityKey = byokKey
        ? undefined
        : app?.apiKeys?.perplexity
          ? safeDecrypt(app?.apiKeys?.perplexity)
          : isFreeTier(app)
            ? process.env.PERPLEXITY_API_KEY
            : ""
      if (perplexityKey && !failedKeys?.includes(modelId)) {
        const perplexityProvider = createPerplexity({
          apiKey: perplexityKey,
        })
        result = {
          provider: perplexityProvider(modelId.replace(/^perplexity\//, "")),
          modelId: modelId,
          agentName: agent.name,
          lastKey: "perplexity",
        }
        break
      }

      const openrouterKeyForPerplexity = byokKey
        ? byokKey
        : app?.apiKeys?.openrouter
          ? safeDecrypt(app?.apiKeys?.openrouter)
          : isFreeTier(app)
            ? process.env.OPENROUTER_API_KEY
            : ""

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

      console.warn(
        `⚠️ Creating fallback Perplexity provider with empty API key for model ${modelId} (agent: ${agent.name})`,
      )
      // Deliberate non-authenticated stub for graceful failure (warnings are logged above)
      result = {
        provider: createPerplexity({ apiKey: "" })(
          modelId.replace(/^perplexity\//, ""),
        ),
        modelId: modelId,
        agentName: agent.name,
      }
      break
    }

    default: {
      const byokKey = user?.apiKeys?.openrouter
        ? byokDecrypt(user?.apiKeys?.openrouter)
        : guest?.apiKeys?.openrouter
          ? byokDecrypt(guest?.apiKeys?.openrouter)
          : undefined
      console.log("⚠️ Unknown agent, using DeepSeek fallback")
      const fallbackKey = byokKey
        ? byokKey
        : app?.apiKeys?.deepseek
          ? safeDecrypt(app?.apiKeys?.deepseek)
          : isFreeTier(app)
            ? process.env.DEEPSEEK_API_KEY
            : ""
      const fallbackProvider = createDeepSeek({ apiKey: fallbackKey })
      const fallbackModel = "deepseek-v3.2"
      const effectiveModel = mapDeepSeekModel(fallbackModel)
      result = {
        provider: fallbackProvider(effectiveModel),
        modelId: fallbackModel,
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

export async function getEmbeddingProvider({
  app,
  user,
  guest,
}: {
  app?: app | appWithStore
  user?: user
  guest?: guest
}) {
  const openaiKey =
    safeDecrypt(user?.apiKeys?.openai) ||
    safeDecrypt(guest?.apiKeys?.openai) ||
    safeDecrypt(app?.apiKeys?.openai) ||
    (isFreeTier(app)
      ? process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY
      : "")

  if (openaiKey) {
    return {
      provider: createOpenAI({ apiKey: openaiKey }),
      modelId: "text-embedding-3-small",
    }
  }

  const openrouterKey =
    byokDecrypt(user?.apiKeys?.openrouter) ||
    byokDecrypt(guest?.apiKeys?.openrouter) ||
    safeDecrypt(app?.apiKeys?.openrouter) ||
    (isFreeTier(app) ? process.env.OPENROUTER_API_KEY : "")

  if (openrouterKey) {
    return {
      provider: createOpenRouter({ apiKey: openrouterKey }),
      modelId: "openai/text-embedding-3-small",
    }
  }

  throw new Error("OpenAI or OpenRouter API key required for embeddings")
}
