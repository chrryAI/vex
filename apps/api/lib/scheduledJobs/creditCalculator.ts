import { db } from "@repo/db"
import { aiModelPricing } from "@repo/db/src/schema"
import { eq, and } from "drizzle-orm"
import {
  calculateCredits as calculateCreditsShared,
  estimateJobCredits as estimateJobCreditsShared,
  getPricingForModel,
  type CreditEstimate,
  type EstimateJobCreditsParams,
} from "@repo/shared"

// API wrapper that fetches pricing from DB and uses shared calculator
export async function calculateCreditsFromDB(params: {
  provider: "openai" | "claude" | "deepseek" | "sushi"
  modelName: string
  estimatedInputTokens: number
  estimatedOutputTokens: number
  totalRuns: number
}): Promise<CreditEstimate> {
  const {
    provider,
    modelName,
    estimatedInputTokens,
    estimatedOutputTokens,
    totalRuns,
  } = params

  // Get pricing from database
  const pricingFromDB = await db.query.aiModelPricing.findFirst({
    where: and(
      eq(aiModelPricing.provider, provider),
      eq(aiModelPricing.modelName, modelName),
      eq(aiModelPricing.isActive, true),
    ),
  })

  if (!pricingFromDB) {
    // Fallback to default pricing from shared package
    const defaultPricing = getPricingForModel(provider, modelName)
    if (!defaultPricing) {
      throw new Error(`Pricing not found for ${provider}/${modelName}`)
    }

    return calculateCreditsShared({
      provider,
      modelName,
      estimatedInputTokens,
      estimatedOutputTokens,
      totalRuns,
      pricing: defaultPricing,
    })
  }

  // Use DB pricing
  return calculateCreditsShared({
    provider,
    modelName,
    estimatedInputTokens,
    estimatedOutputTokens,
    totalRuns,
    pricing: {
      provider: pricingFromDB.provider,
      modelName: pricingFromDB.modelName,
      inputCostPerKToken: pricingFromDB.inputCostPerKToken,
      outputCostPerKToken: pricingFromDB.outputCostPerKToken,
      description: pricingFromDB.description || undefined,
    },
  })
}

// API wrapper for job estimation with DB pricing
export async function estimateJobCreditsFromDB(
  params: Omit<EstimateJobCreditsParams, "pricing">,
): Promise<CreditEstimate> {
  const { provider, modelName } = params

  // Get pricing from database
  const pricingFromDB = await db.query.aiModelPricing.findFirst({
    where: and(
      eq(aiModelPricing.provider, provider),
      eq(aiModelPricing.modelName, modelName),
      eq(aiModelPricing.isActive, true),
    ),
  })

  if (!pricingFromDB) {
    // Fallback to default pricing
    const defaultPricing = getPricingForModel(provider, modelName)
    if (!defaultPricing) {
      throw new Error(`Pricing not found for ${provider}/${modelName}`)
    }

    return estimateJobCreditsShared({
      ...params,
      pricing: defaultPricing,
    })
  }

  // Use DB pricing
  return estimateJobCreditsShared({
    ...params,
    pricing: {
      provider: pricingFromDB.provider,
      modelName: pricingFromDB.modelName,
      inputCostPerKToken: pricingFromDB.inputCostPerKToken,
      outputCostPerKToken: pricingFromDB.outputCostPerKToken,
      description: pricingFromDB.description || undefined,
    },
  })
}

// Helper: Get all active AI models with pricing from DB
export async function getAvailableModels() {
  const models = await db.query.aiModelPricing.findMany({
    where: eq(aiModelPricing.isActive, true),
  })

  // Group by provider
  const grouped = models.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = []
      }
      acc[model.provider].push({
        name: model.modelName,
        description: model.description || "",
        inputCost: model.inputCostPerKToken,
        outputCost: model.outputCostPerKToken,
      })
      return acc
    },
    {} as Record<
      string,
      Array<{
        name: string
        description: string
        inputCost: number
        outputCost: number
      }>
    >,
  )

  return grouped
}

// Re-export shared helpers
export {
  formatCredits,
  creditsToUSD,
  formatUSD,
  calculateTotalRuns,
  compareModelCosts,
} from "@repo/shared"
