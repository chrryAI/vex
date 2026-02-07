// ============================================
// CREDIT CALCULATOR - Shared between API and UI
// ============================================

export interface ScheduleSlot {
  hour: number
  minute: number
  postType: "post" | "comment" | "engagement"
  model: "sushi" | "claude" | "chatGPT" | "gemini" | "perplexity"
  charLimit: number
}

export interface EstimateJobCreditsParams {
  frequency: "daily" | "weekly" | "monthly"
  scheduledTimes: ScheduleSlot[]
  startDate: Date
  endDate: Date
  creditsPrice?: number // EUR per 1000 credits (default: 10)
}

// Model pricing multipliers (matches creditCost from agents seed)
export function getModelMultiplier(model: string): number {
  switch (model) {
    case "sushi":
      return 2 // DeepSeek R1 - creditCost: 2
    case "claude":
      return 3 // Claude Sonnet 4.5 - creditCost: 3
    case "chatGPT":
      return 4 // GPT-5.1 - creditCost: 4
    case "gemini":
      return 4 // Gemini 3.0 Pro - creditCost: 4
    case "perplexity":
      return 3 // Perplexity Sonar Pro - creditCost: 3
    default:
      return 2
  }
}

// Post type multipliers
export function getPostTypeMultiplier(postType: string): number {
  switch (postType) {
    case "post":
      return 1
    case "comment":
      return 0.5
    case "engagement":
      return 0.3
    default:
      return 1
  }
}

// Calculate credits for a single slot
export function calculateSlotCredits(slot: ScheduleSlot): number {
  // Base credits: 10 + (charLimit / 100) * 5
  const baseCredits = 10 + (slot.charLimit / 100) * 5
  const modelMultiplier = getModelMultiplier(slot.model)
  const postTypeMultiplier = getPostTypeMultiplier(slot.postType)

  return Math.ceil(baseCredits * modelMultiplier * postTypeMultiplier)
}

export function estimateJobCredits(params: EstimateJobCreditsParams): {
  totalPosts: number
  creditsPerPost: number
  totalCredits: number
  totalPrice: number
} {
  const {
    frequency,
    scheduledTimes,
    startDate,
    endDate,
    creditsPrice = 10,
  } = params

  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (days <= 0) {
    return {
      totalPosts: 0,
      creditsPerPost: 0,
      totalCredits: 0,
      totalPrice: 0,
    }
  }

  let totalRuns = 0
  if (frequency === "daily") {
    totalRuns = days
  } else if (frequency === "weekly") {
    totalRuns = Math.floor(days / 7)
  } else if (frequency === "monthly") {
    totalRuns = Math.max(1, Math.floor(days / 30))
  }

  // Calculate total credits based on each slot's configuration
  let totalCreditsSum = 0
  let totalPostsCount = 0

  scheduledTimes.forEach((slot) => {
    const runsForThisSlot = totalRuns
    totalPostsCount += runsForThisSlot

    const creditsPerRun = calculateSlotCredits(slot)
    totalCreditsSum += creditsPerRun * runsForThisSlot
  })

  const avgCreditsPerPost =
    totalPostsCount > 0 ? Math.ceil(totalCreditsSum / totalPostsCount) : 0

  // Calculate EUR price based on credits (€10 per 1000 credits by default)
  const priceInEur = Math.ceil((totalCreditsSum / 1000) * creditsPrice)

  return {
    totalPosts: totalPostsCount,
    creditsPerPost: avgCreditsPerPost,
    totalCredits: totalCreditsSum,
    totalPrice: priceInEur,
  }
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
