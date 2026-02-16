import { Hono } from "hono"
import { queryCodebase } from "../../lib/ast/queryCodebase"
import { generateText } from "ai"
import { getModelProvider } from "../../lib/getModelProvider"
import { db } from "@repo/db"
import { codebaseQueries } from "@repo/db"
import { eq, and, gte, count } from "drizzle-orm"
import { startOfDay } from "date-fns"

type Variables = {
  userId?: string
  guestId?: string
  member?: any
}

const codebase = new Hono<{ Variables: Variables }>()

// Daily query limits by tier
const DAILY_LIMITS = {
  coder: 50,
  architect: 200,
}

const ALLOWED_REPOS = [
  "chrryAI/vex",
  "chrryAI/chrry",
  "chrryAI/sushi",
  "chrryAI/pepper",
  "chrryAI/waffles",
  "chrryAI/wine",
  // Add more repos as needed
]

// POST /codebase/query - Query codebase with AI
codebase.post("/query", async (c) => {
  const { query, repoName = "chrryAI/vex", appId } = await c.req.json()

  if (!query || typeof query !== "string") {
    return c.json({ error: "Query is required" }, 400)
  }

  // Check if repo is allowed
  if (!ALLOWED_REPOS.includes(repoName)) {
    return c.json(
      {
        error: "Codebase AI only available for official repositories",
        allowedRepos: ALLOWED_REPOS,
      },
      403,
    )
  }

  // Get user/guest from context
  const userId = c.get("userId")
  const guestId = c.get("guestId")
  const member = c.get("member")

  if (!userId && !guestId) {
    return c.json({ error: "Authentication required" }, 401)
  }

  // Check Sushi tier requirement
  if (!member?.sushiTier || member.sushiTier === "free") {
    return c.json(
      {
        error: "Codebase AI requires Sushi Coder or Architect tier",
        upgrade: "https://chrry.ai/subscribe?plan=coder",
      },
      403,
    )
  }

  // Check daily rate limit
  const dailyLimit =
    DAILY_LIMITS[member.sushiTier as keyof typeof DAILY_LIMITS] || 0

  if (dailyLimit > 0) {
    const now = new Date()
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    )

    const [usageResult] = await db
      .select({ count: count() })
      .from(codebaseQueries)
      .where(
        and(
          userId
            ? eq(codebaseQueries.userId, userId)
            : eq(codebaseQueries.guestId, guestId!),
          gte(codebaseQueries.createdAt, todayStart),
        ),
      )

    const todayUsage = usageResult?.count || 0

    if (todayUsage >= dailyLimit) {
      return c.json(
        {
          error: "Daily codebase query limit reached",
          limit: dailyLimit,
          usage: todayUsage,
          resetAt: new Date(
            todayStart.getTime() + 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        429,
      )
    }
  }

  const startTime = Date.now()

  try {
    // Step 1: RAG query to find relevant code
    const context = await queryCodebase(query, repoName, {
      limit: 10,
      minSimilarity: 0.7,
      includeGraph: true,
    })

    if (context.codeChunks.length === 0) {
      return c.json({
        response:
          "I couldn't find any relevant code for your query. Try rephrasing or being more specific.",
        sources: [],
      })
    }

    // Step 2: Build AI prompt with context
    const prompt = `You are an AI assistant that understands the ${repoName} codebase.

USER QUERY: "${query}"

RELEVANT CODE:
${context.codeChunks
  .map(
    (chunk) => `
File: ${chunk.filepath}
Type: ${chunk.type}
Name: ${chunk.name}
Lines: ${chunk.startLine}-${chunk.endLine}
Similarity: ${chunk.similarity.toFixed(2)}

Code:
${chunk.content}
`,
  )
  .join("\n---\n")}

${
  context.relationships.length > 0
    ? `
RELATIONSHIPS:
${context.relationships
  .map(
    (rel) => `
${rel.from.name} (${rel.from.filepath}) --[${rel.relation.type}]--> ${rel.to.name} (${rel.to.filepath})
`,
  )
  .join("\n")}
`
    : ""
}

Explain how this code works, referencing specific files, functions, and line numbers. Be concise and accurate.`

    // Step 3: Generate AI response
    const app = await db.query.apps.findFirst({
      where: (apps, { eq }) => eq(apps.id, appId),
    })

    if (!app) {
      return c.json({ error: "App not found" }, 404)
    }

    const { provider } = await getModelProvider(app, "claude-sonnet-4.5")

    const { text, usage } = await generateText({
      model: provider,
      prompt,
      maxRetries: 2,
    })

    const responseTime = Date.now() - startTime

    // Step 4: Log query for rate limiting and cost tracking
    const tokensUsed = usage?.totalTokens || 0
    const costUSD = (tokensUsed / 1_000_000) * 0.02 // Rough estimate

    await db.insert(codebaseQueries).values({
      userId,
      guestId,
      appId,
      repoName,
      query,
      responseTime,
      tokensUsed,
      costUSD,
    })

    return c.json({
      response: text,
      sources: context.codeChunks.map((chunk) => ({
        filepath: chunk.filepath,
        type: chunk.type,
        name: chunk.name,
        lines: `${chunk.startLine}-${chunk.endLine}`,
        similarity: chunk.similarity,
      })),
      relationships: context.relationships,
      metadata: {
        responseTime,
        tokensUsed,
        codeChunksFound: context.codeChunks.length,
      },
    })
  } catch (error) {
    console.error("❌ Codebase query failed:", error)
    return c.json(
      {
        error: "Failed to query codebase",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})

// GET /codebase/stats - Get usage stats
codebase.get("/stats", async (c) => {
  const userId = c.get("userId")
  const guestId = c.get("guestId")

  if (!userId && !guestId) {
    return c.json({ error: "Authentication required" }, 401)
  }

  const todayStart = startOfDay(new Date())

  const [todayUsage] = await db
    .select({ count: count() })
    .from(codebaseQueries)
    .where(
      and(
        userId
          ? eq(codebaseQueries.userId, userId)
          : eq(codebaseQueries.guestId, guestId!),
        gte(codebaseQueries.createdAt, todayStart),
      ),
    )

  const member = c.get("member")
  const tier = member?.sushiTier || "free"
  const dailyLimit = DAILY_LIMITS[tier as keyof typeof DAILY_LIMITS] || 0

  return c.json({
    tier,
    dailyLimit,
    todayUsage: todayUsage?.count || 0,
    remaining: Math.max(0, dailyLimit - (todayUsage?.count || 0)),
    resetAt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  })
})

export default codebase
