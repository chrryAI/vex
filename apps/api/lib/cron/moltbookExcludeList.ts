/**
 * Centralized exclude list for Moltbook interactions
 * Agents in this list will be automatically skipped for both:
 * - Proactive engagement (moltbookEngagement.ts)
 * - Comment replies (moltbookComments.ts)
 *
 * Based on Moltbook spam research:
 * - 99% of 1.5M accounts were fake/scripted bots
 * - Researcher created 500k accounts with one script
 * - Only ~17k verified human owners existed
 * - Common spam: crypto promotions, prompt injections, generic responses
 */
export const MOLTBOOK_EXCLUDED_AGENTS = [
  "KingAgent", // Generic spam comments
  "OmegaAIBotNew5", // Low-quality generic responses
  "Stromfee",
  // Add more agents as needed
] as const

/**
 * Spam detection patterns based on Moltbook research
 */
const SPAM_PATTERNS = {
  // Generic bot naming patterns (ReDoS-safe: no greedy quantifiers)
  namePatterns: [
    /^(King|Omega|Alpha|Beta|Sigma)[A-Za-z0-9_]*Agent$/i, // Specific character class instead of .*
    /^AI[A-Za-z0-9_]*Bot[A-Za-z0-9_]*\d+$/i, // AIBot123, AIBotNew5 - no greedy .*
    /^Bot\d+$/i, // Bot123
    /^Agent\d+$/i, // Agent456
  ],

  // Crypto/scam keywords (check in content, not names)
  cryptoKeywords: [
    "crypto",
    "bitcoin",
    "ethereum",
    "nft",
    "token",
    "investment",
    "trading",
    "profit",
    "gains",
  ],
}

/**
 * Check if an agent name matches spam patterns
 */
export function isSpamPattern(agentName: string): boolean {
  return SPAM_PATTERNS.namePatterns.some((pattern) => pattern.test(agentName))
}

/**
 * Check if an agent should be excluded from Moltbook interactions
 * Combines explicit exclude list with pattern detection
 */
export function isExcludedAgent(agentName: string): boolean {
  // Check explicit exclude list
  if (MOLTBOOK_EXCLUDED_AGENTS.includes(agentName as any)) {
    return true
  }

  // Check spam patterns
  if (isSpamPattern(agentName)) {
    return true
  }

  return false
}

/**
 * Check if content contains spam indicators (for additional filtering)
 * Use this for post/comment content analysis
 */
export function hasSpamContent(content: string): boolean {
  const lowerContent = content.toLowerCase()
  return SPAM_PATTERNS.cryptoKeywords.some((keyword) =>
    lowerContent.includes(keyword),
  )
}
