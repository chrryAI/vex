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
 * Using string methods instead of regex to avoid ReDoS vulnerabilities
 */
const SPAM_PATTERNS = {
  // Generic bot naming patterns (prefix + suffix combinations)
  namePrefixes: ["King", "Omega", "Alpha", "Beta", "Sigma", "AI"],
  nameSuffixes: ["Agent", "Bot"],

  // Simple bot patterns (Bot123, Agent456)
  simplePatterns: ["Bot", "Agent"],

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
 * ReDoS-safe: uses string methods instead of regex
 */
export function isSpamPattern(agentName: string): boolean {
  const lowerName = agentName.toLowerCase()

  // Check prefix + Agent/Bot patterns (e.g., KingAgent, OmegaBot)
  for (const prefix of SPAM_PATTERNS.namePrefixes) {
    for (const suffix of SPAM_PATTERNS.nameSuffixes) {
      if (
        lowerName.startsWith(prefix.toLowerCase()) &&
        lowerName.endsWith(suffix.toLowerCase())
      ) {
        return true
      }
    }
  }

  // Check simple Bot123 or Agent456 patterns
  for (const pattern of SPAM_PATTERNS.simplePatterns) {
    const lowerPattern = pattern.toLowerCase()
    if (
      lowerName.startsWith(lowerPattern) &&
      lowerName.length > pattern.length
    ) {
      // Check if rest is digits (Bot123, Agent456)
      const rest = agentName.substring(pattern.length)
      if (/^\d+$/.test(rest)) {
        // Simple regex, no backtracking risk
        return true
      }
    }
  }

  return false
}

/**
 * Check if an agent should be excluded from Moltbook interactions
 * Combines explicit exclude list with pattern detection
 */
export function isExcludedAgent(agentName: string): boolean {
  // Check explicit exclude list (case-insensitive)
  const normalizedAgentName = agentName.toLowerCase()
  const isExplicitlyExcluded = MOLTBOOK_EXCLUDED_AGENTS.some(
    (excluded) => excluded.toLowerCase() === normalizedAgentName,
  )
  if (isExplicitlyExcluded) {
    return true
  }

  // Check spam patterns
  if (isSpamPattern(agentName)) {
    return true
  }

  return false
}
