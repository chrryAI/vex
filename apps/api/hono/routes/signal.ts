import { Hono } from "hono"
import { z } from "zod"
import { db } from "@repo/db"
import * as schema from "@repo/db/src/schema"
import { eq } from "drizzle-orm"

const app = new Hono()

/**
 * Grape Signal Protocol v1
 * Universal analytics ingestion endpoint
 */

const GrapeSignalSchema = z.object({
  // Identity
  project_id: z.string().min(1),
  user_hash: z.string().min(1),

  // Event
  signal: z.string().min(1),

  // Context
  context: z
    .object({
      value: z.number().optional(),
      path: z.string().optional(),
      error_stack: z.string().optional(),
      meta: z.record(z.any()).optional(),
    })
    .optional(),

  // Intelligence request
  require_insight: z.boolean().optional().default(false),
})

type GrapeSignal = z.infer<typeof GrapeSignalSchema>

/**
 * POST /api/signal
 * Accept analytics signals from any developer
 */
app.post("/", async (c) => {
  try {
    // Parse and validate payload
    const body = await c.req.json()
    const signal = GrapeSignalSchema.parse(body)

    // Verify API key from Authorization header
    const apiKey = c.req.header("Authorization")?.replace("Bearer ", "")
    if (!apiKey) {
      return c.json({ error: "Missing API key" }, 401)
    }

    // Verify project exists and API key is valid
    const project = await db.query.grapeProjects.findFirst({
      where: eq(schema.grapeProjects.apiKey, apiKey),
    })

    if (!project) {
      return c.json({ error: "Invalid API key" }, 401)
    }

    if (project.id !== signal.project_id) {
      return c.json({ error: "Project ID mismatch" }, 403)
    }

    // Store signal in database
    const [storedSignal] = await db
      .insert(schema.grapeSignals)
      .values({
        projectId: signal.project_id,
        userHash: signal.user_hash,
        signal: signal.signal,
        context: signal.context || {},
        requireInsight: signal.require_insight,
        timestamp: new Date(),
      })
      .returning()

    // If insight requested, analyze with AI
    let insight = null
    if (signal.require_insight) {
      insight = await generateInsight(signal, project)
    }

    return c.json({
      success: true,
      signal_id: storedSignal.id,
      insight: insight || undefined,
    })
  } catch (error) {
    console.error("Grape Signal error:", error)

    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid payload", details: error.errors }, 400)
    }

    return c.json({ error: "Internal server error" }, 500)
  }
})

/**
 * Generate AI insight for a signal
 */
async function generateInsight(signal: GrapeSignal, project: any) {
  // Get recent signals for context
  const recentSignals = await db.query.grapeSignals.findMany({
    where: eq(schema.grapeSignals.projectId, signal.project_id),
    orderBy: (signals, { desc }) => [desc(signals.timestamp)],
    limit: 100,
  })

  // Build context for AI
  const context = `
Project: ${project.name}
Recent Signal: ${signal.signal}
Context: ${JSON.stringify(signal.context, null, 2)}

Recent Activity (last 100 signals):
${recentSignals
  .map((s) => `- ${s.signal} (${new Date(s.timestamp).toISOString()})`)
  .join("\n")}

Analyze this signal and provide:
1. What this signal means
2. Any patterns or anomalies
3. Actionable recommendations
`

  // Call AI (using your existing AI infrastructure)
  // This would integrate with your Grape AI agent
  const insight = {
    summary: "Signal received and analyzed",
    patterns: [],
    recommendations: [],
    // TODO: Integrate with actual Grape AI
  }

  return insight
}

export default app
