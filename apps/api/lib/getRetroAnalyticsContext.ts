// ==================== TYPES ====================

import {
  and,
  db,
  desc,
  eq,
  inArray,
  retroResponses,
  retroSessions,
} from "@repo/db"

type RetroSession = typeof retroSessions.$inferSelect
type RetroResponse = typeof retroResponses.$inferSelect
interface RetroAnalyticsParams {
  appId?: string
  userId?: string
  guestId?: string
  limit?: number
}

interface SessionMetrics {
  totalSessions: number
  completedSessions: number
  completionRate: number
  avgQuestionsAnswered: number
  avgDuration: number
}

interface ResponseMetrics {
  totalResponses: number
  skippedCount: number
  avgResponseLength: number
  skipRate: number
}

interface TopQuestion {
  question: string
  count: number
}

// ==================== QUERY HELPERS ====================

/**
 * Build sessions query based on filters
 */
function buildSessionsQuery(
  appId?: string,
  userId?: string,
  guestId?: string,
  limit: number = 50,
) {
  const conditions = [
    appId ? eq(retroSessions.appId, appId) : undefined,
    userId ? eq(retroSessions.userId, userId) : undefined,
    guestId ? eq(retroSessions.guestId, guestId) : undefined,
  ].filter(Boolean)

  return db
    .select()
    .from(retroSessions)
    .where(and(...conditions))
    .orderBy(desc(retroSessions.startedAt))
    .limit(limit)
}

/**
 * Fetch recent retro sessions
 */
async function fetchRecentSessions(
  appId?: string,
  userId?: string,
  guestId?: string,
  limit: number = 50,
) {
  const query = buildSessionsQuery(appId, userId, guestId, limit)
  return await query
}

/**
 * Fetch responses for given sessions
 */
async function fetchSessionResponses(
  sessionIds: string[],
  userId?: string,
  guestId?: string,
) {
  if (!sessionIds || sessionIds.length === 0) return []
  const conditions = [
    inArray(retroResponses.sessionId, sessionIds),
    userId ? eq(retroResponses.userId, userId) : undefined,
    guestId ? eq(retroResponses.guestId, guestId) : undefined,
  ].filter(Boolean)

  return await db
    .select()
    .from(retroResponses)
    .where(and(...conditions))
    .orderBy(desc(retroResponses.askedAt))
    .limit(100)
}

// ==================== CALCULATION HELPERS ====================

/**
 * Calculate session-level metrics
 */
function calculateSessionMetrics(sessions: RetroSession[]): SessionMetrics {
  const totalSessions = sessions.length
  const completedSessions = sessions.filter((s) => s.completedAt).length
  const completionRate = (completedSessions / totalSessions) * 100

  const avgQuestionsAnswered =
    sessions.reduce((sum, s) => sum + s.questionsAnswered, 0) / totalSessions

  const sessionsWithDuration = sessions.filter((s) => s.duration)
  const avgDuration =
    sessionsWithDuration.length > 0
      ? sessionsWithDuration.reduce((sum, s) => sum + (s.duration || 0), 0) /
        sessionsWithDuration.length
      : 0

  return {
    totalSessions,
    completedSessions,
    completionRate,
    avgQuestionsAnswered,
    avgDuration,
  }
}

/**
 * Calculate response-level metrics
 */
function calculateResponseMetrics(responses: RetroResponse[]): ResponseMetrics {
  const totalResponses = responses.length
  const skippedCount = responses.filter((r) => r.skipped).length
  const skipRate =
    totalResponses > 0 ? (skippedCount / totalResponses) * 100 : 0

  const responsesWithLength = responses.filter((r) => r.responseLength)
  const avgResponseLength =
    responsesWithLength.length > 0
      ? responsesWithLength.reduce(
          (sum, r) => sum + (r.responseLength || 0),
          0,
        ) / responsesWithLength.length
      : 0

  return {
    totalResponses,
    skippedCount,
    avgResponseLength,
    skipRate,
  }
}

/**
 * Find most answered questions
 */
function findTopQuestions(
  responses: RetroResponse[],
  topN: number = 5,
): TopQuestion[] {
  const questionCounts = responses.reduce(
    (acc, r) => {
      if (!r.skipped) {
        acc[r.questionText] = (acc[r.questionText] || 0) + 1
      }
      return acc
    },
    {} as Record<string, number>,
  )

  return Object.entries(questionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([question, count]) => ({ question, count }))
}

// ==================== INSIGHT HELPERS ====================

/**
 * Get engagement level indicator
 */
function getEngagementLevel(rate: number): string {
  if (rate > 70) return "🟢 High"
  if (rate > 40) return "🟡 Medium"
  return "🔴 Low"
}

/**
 * Get response quality indicator
 */
function getResponseQuality(avgLength: number): string {
  if (avgLength > 100) return "🟢 Detailed"
  if (avgLength > 50) return "🟡 Moderate"
  return "🔴 Brief"
}

/**
 * Get skip rate indicator
 */
function getSkipRateLevel(skipRate: number): string {
  if (skipRate < 20) return "🟢 Low"
  if (skipRate < 40) return "🟡 Medium"
  return "🔴 High"
}

/**
 * Format duration for display
 */
function formatDuration(durationSeconds: number): string {
  return durationSeconds > 0
    ? `${Math.round(durationSeconds / 60)} minutes`
    : "N/A"
}

// ==================== FORMATTING HELPERS ====================

/**
 * Format session metrics section
 */
function formatSessionMetrics(metrics: SessionMetrics): string {
  return `**Session Metrics:**
- Total Sessions: ${metrics.totalSessions}
- Completed Sessions: ${metrics.completedSessions} (${metrics.completionRate.toFixed(1)}% completion rate)
- Avg Questions Answered: ${metrics.avgQuestionsAnswered.toFixed(1)} per session
- Avg Session Duration: ${formatDuration(metrics.avgDuration)}`
}

/**
 * Format response metrics section
 */
function formatResponseMetrics(metrics: ResponseMetrics): string {
  return `**Response Metrics:**
- Total Responses: ${metrics.totalResponses}
- Skipped Questions: ${metrics.skippedCount} (${metrics.skipRate.toFixed(1)}%)
- Avg Response Length: ${Math.round(metrics.avgResponseLength)} characters`
}

/**
 * Format top questions section
 */
function formatTopQuestions(topQuestions: TopQuestion[]): string {
  if (topQuestions.length === 0) {
    return "**Most Answered Questions:**\n- No questions answered yet"
  }

  const questionsList = topQuestions
    .map(({ question, count }) => {
      const preview = question.substring(0, 60)
      return `- "${preview}..." (${count} responses)`
    })
    .join("\n")

  return `**Most Answered Questions:**\n${questionsList}`
}

/**
 * Format engagement insights section
 */
function formatEngagementInsights(
  sessionMetrics: SessionMetrics,
  responseMetrics: ResponseMetrics,
): string {
  return `**Engagement Insights:**
- Completion Rate: ${getEngagementLevel(sessionMetrics.completionRate)}
- Response Quality: ${getResponseQuality(responseMetrics.avgResponseLength)}
- Skip Rate: ${getSkipRateLevel(responseMetrics.skipRate)}`
}

/**
 * Format complete analytics context
 */
function formatAnalyticsContext(
  sessionMetrics: SessionMetrics,
  responseMetrics: ResponseMetrics,
  topQuestions: TopQuestion[],
): string {
  return `
📊 RETRO (DAILY CHECK-IN) ANALYTICS (Last ${sessionMetrics.totalSessions} sessions):

${formatSessionMetrics(sessionMetrics)}

${formatResponseMetrics(responseMetrics)}

${formatTopQuestions(topQuestions)}

${formatEngagementInsights(sessionMetrics, responseMetrics)}

Use this data to answer questions about daily check-in engagement, completion rates, and question effectiveness.
`
}

// ==================== MAIN FUNCTION ====================

export async function getRetroAnalyticsContext({
  appId,
  userId,
  guestId,
  limit = 50,
}: RetroAnalyticsParams): Promise<string> {
  try {
    // 1. Fetch sessions
    const sessions = await fetchRecentSessions(appId, userId, guestId, limit)

    if (sessions.length === 0) {
      return ""
    }

    // 2. Calculate session metrics
    const sessionMetrics = calculateSessionMetrics(sessions)

    // 3. Fetch responses
    const sessionIds = sessions.map((s) => s.id)
    const responses = await fetchSessionResponses(sessionIds, userId, guestId)

    // 4. Calculate response metrics
    const responseMetrics = calculateResponseMetrics(responses)

    // 5. Find top questions
    const topQuestions = findTopQuestions(responses, 5)

    // 6. Format and return context
    return formatAnalyticsContext(sessionMetrics, responseMetrics, topQuestions)
  } catch (error) {
    console.error("Error fetching retro analytics context:", error)
    return ""
  }
}
