import {
  estimateJobCredits,
  formatCredits,
  creditsToUSD,
  formatUSD,
  type EstimateJobCreditsParams,
} from "@chrryai/chrry/utils"

// Simple wrapper - new calculator doesn't need DB pricing, uses multipliers
export async function calculateCreditsFromDB(params: EstimateJobCreditsParams) {
  return estimateJobCredits(params)
}

// Re-export UI helpers
export { formatCredits, creditsToUSD, formatUSD }
