import {
  estimateJobCredits,
  type estimateJobCreditsParams,
  formatCredits,
} from "@chrryai/chrry/utils"

// Simple wrapper - new calculator doesn't need DB pricing, uses multipliers
export async function calculateCreditsFromDB(params: estimateJobCreditsParams) {
  return estimateJobCredits(params)
}

// Re-export UI helpers
export { formatCredits }
