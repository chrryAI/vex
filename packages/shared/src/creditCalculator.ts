// ============================================
// CREDIT CALCULATOR - Shared between API and UI
// ============================================

export interface AIModelPricing {
  provider: "openai" | "claude" | "deepseek" | "sushi"
  modelName: string
  inputCostPerKToken: number
  outputCostPerKToken: number
  description?: string
}

export interface CreditEstimate {
  estimatedCreditsPerRun: number
  totalEstimatedCredits: number
  breakdown: {
    inputTokens: number
    outputTokens: number
    inputCost: number
    outputCost: number
    totalCost: number
  }
  pricing: {
    provider: string
    modelName: string
    inputCostPerKToken: number
    outputCostPerKToken: number
  }
}

export interface CalculateCreditsParams {
  provider: "openai" | "claude" | "deepseek" | "sushi"
  modelName: string
  estimatedInputTokens: number
  estimatedOutputTokens: number
  totalRuns: number
  pricing: AIModelPricing
}

export interface EstimateJobCreditsParams {
  jobType:
    | "tribe_post"
    | "moltbook_post"
    | "moltbook_comment"
    | "moltbook_engage"
  provider: "openai" | "claude" | "deepseek" | "sushi"
  modelName: string
  frequency: "once" | "daily" | "weekly" | "custom"
  scheduledTimes: string[] // ["09:00", "14:00", "18:00", "22:00"]
  startDate: Date
  endDate?: Date
  contentLength?: "short" | "medium" | "long"
  pricing: AIModelPricing
}

export interface CompareModelCostsParams {
  jobType:
    | "tribe_post"
    | "moltbook_post"
    | "moltbook_comment"
    | "moltbook_engage"
  frequency: "once" | "daily" | "weekly" | "custom"
  scheduledTimes: string[]
  startDate: Date
  endDate?: Date
  contentLength?: "short" | "medium" | "long"
}

// Default pricing - can be overridden with real DB data
export const DEFAULT_PRICING: Record<string, AIModelPricing[]> = {
  openai: [
    {
      provider: "openai",
      modelName: "gpt-4o",
      inputCostPerKToken: 25,
      outputCostPerKToken: 100,
      description: "GPT-4 Optimized - Best for complex reasoning",
    },
    {
      provider: "openai",
      modelName: "gpt-4o-mini",
      inputCostPerKToken: 2,
      outputCostPerKToken: 6,
      description: "GPT-4 Mini - Fast and affordable",
    },
    {
      provider: "openai",
      modelName: "gpt-3.5-turbo",
      inputCostPerKToken: 5,
      outputCostPerKToken: 15,
      description: "GPT-3.5 Turbo - Balanced performance",
    },
  ],
  claude: [
    {
      provider: "claude",
      modelName: "claude-3-5-sonnet-20241022",
      inputCostPerKToken: 30,
      outputCostPerKToken: 150,
      description: "Claude 3.5 Sonnet - Best for creative writing",
    },
    {
      provider: "claude",
      modelName: "claude-3-5-haiku-20241022",
      inputCostPerKToken: 10,
      outputCostPerKToken: 50,
      description: "Claude 3.5 Haiku - Fast and efficient",
    },
    {
      provider: "claude",
      modelName: "claude-3-opus-20240229",
      inputCostPerKToken: 150,
      outputCostPerKToken: 750,
      description: "Claude 3 Opus - Most powerful, highest quality",
    },
  ],
  deepseek: [
    {
      provider: "deepseek",
      modelName: "deepseek-chat",
      inputCostPerKToken: 1,
      outputCostPerKToken: 2,
      description: "DeepSeek Chat - Ultra affordable",
    },
    {
      provider: "deepseek",
      modelName: "deepseek-reasoner",
      inputCostPerKToken: 5,
      outputCostPerKToken: 20,
      description: "DeepSeek Reasoner - Advanced reasoning at low cost",
    },
  ],
  sushi: [
    {
      provider: "sushi",
      modelName: "sushi-local",
      inputCostPerKToken: 0,
      outputCostPerKToken: 0,
      description: "Sushi Local - Free WebAssembly execution",
    },
  ],
}

export function calculateCredits(
  params: CalculateCreditsParams,
): CreditEstimate {
  const { estimatedInputTokens, estimatedOutputTokens, totalRuns, pricing } =
    params

  // Convert stored pricing units to credits (stored values are 10x higher)
  const inputCostPerKToken = pricing.inputCostPerKToken / 10
  const outputCostPerKToken = pricing.outputCostPerKToken / 10

  // Calculate cost per 1K tokens
  const inputCost = (estimatedInputTokens / 1000) * inputCostPerKToken
  const outputCost = (estimatedOutputTokens / 1000) * outputCostPerKToken
  const totalCostPerRun = inputCost + outputCost

  // Calculate total cost
  const totalCost = totalCostPerRun * totalRuns

  return {
    estimatedCreditsPerRun: Math.ceil(totalCostPerRun),
    totalEstimatedCredits: Math.ceil(totalCost),
    breakdown: {
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
      inputCost: Math.ceil(inputCostPerRun),
      outputCost: Math.ceil(outputCostPerRun),
      totalCost: Math.ceil(totalCostPerRun),
    },
    pricing: {
      provider: pricing.provider,
      modelName: pricing.modelName,
      inputCostPerKToken: pricing.inputCostPerKToken,
      outputCostPerKToken: pricing.outputCostPerKToken,
    },
  }
}

export function estimateJobCredits(
  params: EstimateJobCreditsParams,
): CreditEstimate {
  const {
    jobType,
    provider,
    modelName,
    frequency,
    scheduledTimes,
    startDate,
    endDate,
    contentLength = "medium",
    pricing,
  } = params

  // Estimate token usage based on job type and content length
  let estimatedInputTokens = 0
  let estimatedOutputTokens = 0

  switch (jobType) {
    case "tribe_post":
    case "moltbook_post":
      // Post generation requires more context
      estimatedInputTokens = 500 // System prompt + context
      switch (contentLength) {
        case "short":
          estimatedOutputTokens = 150 // ~100 words
          break
        case "medium":
          estimatedOutputTokens = 300 // ~200 words
          break
        case "long":
          estimatedOutputTokens = 600 // ~400 words
          break
      }
      break

    case "moltbook_comment":
      // Comments are shorter
      estimatedInputTokens = 800 // Post content + context
      estimatedOutputTokens = 150 // ~100 words
      break

    case "moltbook_engage":
      // Engagement (upvote/follow decisions)
      estimatedInputTokens = 1000 // Multiple posts + analysis
      estimatedOutputTokens = 200 // Decisions + reasoning
      break
  }

  // Calculate total runs
  const totalRuns = calculateTotalRuns({
    frequency,
    scheduledTimes,
    startDate,
    endDate,
  })

  return calculateCredits({
    provider,
    modelName,
    estimatedInputTokens,
    estimatedOutputTokens,
    totalRuns,
    pricing,
  })
}

interface CalculateTotalRunsParams {
  frequency: "once" | "daily" | "weekly" | "custom"
  scheduledTimes: string[]
  startDate: Date
  endDate?: Date
}

export function calculateTotalRuns(params: CalculateTotalRunsParams): number {
  const { frequency, scheduledTimes, startDate, endDate } = params

  if (frequency === "once") {
    return 1
  }

  // Validate scheduledTimes - ensure at least one run per period
  const runsPerPeriod = Math.max(1, scheduledTimes.length)

  // Calculate days between start and end
  const end =
    endDate || new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000) // Default 30 days

  // Validate endDate is not before startDate
  if (endDate && endDate.getTime() < startDate.getTime()) {
    throw new RangeError(
      `endDate (${endDate.toISOString()}) cannot be before startDate (${startDate.toISOString()})`,
    )
  }

  const days = Math.ceil(
    (end.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
  )

  // Ensure at least 1 day
  const totalDays = Math.max(1, days)

  switch (frequency) {
    case "daily":
      return totalDays * runsPerPeriod

    case "weekly": {
      const weeks = Math.ceil(totalDays / 7)
      return weeks * runsPerPeriod
    }

    case "custom":
      // For custom, assume daily by default
      return totalDays * runsPerPeriod

    default:
      return 1
  }
}

// Helper: Get pricing for a specific model
export function getPricingForModel(
  provider: "openai" | "claude" | "deepseek" | "sushi",
  modelName: string,
): AIModelPricing | undefined {
  const models = DEFAULT_PRICING[provider]
  return models?.find((m) => m.modelName === modelName)
}

// Helper: Format credits for display
export function formatCredits(credits: number): string {
  if (credits === 0) return "Free"
  if (credits < 10) return `${credits} credits`
  if (credits < 1000) return `${credits} credits`
  if (credits < 10000) return `${(credits / 1000).toFixed(1)}K credits`
  return `${(credits / 1000).toFixed(0)}K credits`
}

// Helper: Convert credits to USD (assuming 1 credit = $0.001)
export function creditsToUSD(credits: number): number {
  return credits * 0.001
}

// Helper: Format USD
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Helper: Get all available models grouped by provider
export function getAvailableModels() {
  return Object.entries(DEFAULT_PRICING).map(([provider, models]) => ({
    provider: provider as "openai" | "claude" | "deepseek" | "sushi",
    models: models.map((m) => {
      // Normalize pricing units (stored values are 10x higher)
      const normalizedInputCost = m.inputCostPerKToken / 10
      const normalizedOutputCost = m.outputCostPerKToken / 10
      return {
        name: m.modelName,
        description: m.description || "",
        inputCost: normalizedInputCost,
        outputCost: normalizedOutputCost,
        isFree: normalizedInputCost === 0 && normalizedOutputCost === 0,
      }
    }),
  }))
}

// Helper: Calculate cost comparison across all models
export function compareModelCosts(params: CompareModelCostsParams) {
  if (params.endDate && params.endDate.getTime() < params.startDate.getTime()) {
    throw new RangeError(
      `endDate (${params.endDate.toISOString()}) cannot be before startDate (${params.startDate.toISOString()})`,
    )
  }

  const comparisons: Array<{
    provider: string
    modelName: string
    description: string
    totalCredits: number
    totalUSD: number
    creditsPerRun: number
  }> = []

  type AIProvider = "openai" | "claude" | "deepseek" | "sushi"

  for (const [provider, models] of Object.entries(DEFAULT_PRICING)) {
    for (const model of models) {
      const estimate = estimateJobCredits({
        ...params,
        provider: provider as AIProvider,
        modelName: model.modelName,
        pricing: model,
      })

      comparisons.push({
        provider,
        modelName: model.modelName,
        description: model.description || "",
        totalCredits: estimate.totalEstimatedCredits,
        totalUSD: creditsToUSD(estimate.totalEstimatedCredits),
        creditsPerRun: estimate.estimatedCreditsPerRun,
      })
    }
  }

  // Sort by total cost (cheapest first)
  return comparisons.sort((a, b) => a.totalCredits - b.totalCredits)
}
