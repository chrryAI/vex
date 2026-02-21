import { graph } from "@repo/db"
import { captureException } from "../captureException"

/**
 * Sync SonarCloud issues to graph database
 */
export async function syncIssuesToGraph(
  issues: Array<{
    key: string
    severity: string
    type: string
    message: string
    status: string
    filePath: string
    lineNumber?: number
    ruleKey: string
  }>,
) {
  if (!issues.length) {
    console.log("ℹ️ No issues to sync to graph")
    return
  }

  console.log(`📊 Syncing ${issues.length} issues to graph...`)

  try {
    for (const issue of issues) {
      // Create or update File node
      const fileQuery = `
        MERGE (f:File {path: $path})
        ON CREATE SET 
          f.createdAt = timestamp(),
          f.language = $language
        ON MATCH SET 
          f.updatedAt = timestamp()
        RETURN f
      `

      // Extract language from file extension
      const ext = issue.filePath.split(".").pop() || "unknown"
      const languageMap: Record<string, string> = {
        ts: "TypeScript",
        tsx: "TypeScript",
        js: "JavaScript",
        jsx: "JavaScript",
        py: "Python",
        go: "Go",
        rs: "Rust",
        java: "Java",
        kt: "Kotlin",
        swift: "Swift",
      }

      await graph.query(fileQuery, {
        params: {
          path: issue.filePath,
          language: languageMap[ext] || ext,
        },
      })

      // Create or update Issue node
      const issueQuery = `
        MERGE (i:Issue {key: $key})
        ON CREATE SET 
          i.severity = $severity,
          i.type = $type,
          i.message = $message,
          i.status = $status,
          i.ruleKey = $ruleKey,
          i.lineNumber = $lineNumber,
          i.createdAt = timestamp()
        ON MATCH SET 
          i.status = $status,
          i.updatedAt = timestamp()
        RETURN i
      `

      await graph.query(issueQuery, {
        params: {
          key: issue.key,
          severity: issue.severity,
          type: issue.type,
          message: issue.message,
          status: issue.status,
          ruleKey: issue.ruleKey,
          lineNumber: issue.lineNumber || null,
        },
      })

      // Create relationship: File -[:HAS_ISSUE]-> Issue
      const relationQuery = `
        MATCH (f:File {path: $path})
        MATCH (i:Issue {key: $key})
        MERGE (f)-[r:HAS_ISSUE]->(i)
        ON CREATE SET r.createdAt = timestamp()
        RETURN r
      `

      await graph.query(relationQuery, {
        params: {
          path: issue.filePath,
          key: issue.key,
        },
      })

      // Extract topics from issue message and create relations
      // Example: "Remove this unused import" -> Topic: "code quality", "imports"
      const keywords = extractKeywords(issue.message)
      for (const keyword of keywords) {
        const topicQuery = `
          MERGE (t:Topic {name: $name})
          ON CREATE SET t.createdAt = timestamp()
          MATCH (i:Issue {key: $key})
          MERGE (i)-[r:RELATES_TO]->(t)
          ON CREATE SET r.createdAt = timestamp()
          RETURN t
        `

        await graph.query(topicQuery, {
          params: {
            name: keyword,
            key: issue.key,
          },
        })
      }
    }

    console.log(`✅ Synced ${issues.length} issues to graph`)
  } catch (error) {
    console.error("❌ Failed to sync issues to graph:", error)
    captureException(error)
  }
}

/**
 * Sync SonarCloud metrics to graph database
 */
export async function syncMetricsToGraph(
  projectKey: string,
  metrics: Array<{
    metricKey: string
    value: number
  }>,
  measuredAt: Date,
) {
  if (!metrics.length) {
    console.log("ℹ️ No metrics to sync to graph")
    return
  }

  console.log(`📊 Syncing ${metrics.length} metrics to graph...`)

  try {
    // Create or update Project node
    const projectQuery = `
      MERGE (p:Project {key: $key})
      ON CREATE SET p.createdAt = timestamp()
      ON MATCH SET p.updatedAt = timestamp()
      RETURN p
    `

    await graph.query(projectQuery, {
      params: { key: projectKey },
    })

    // Create metric nodes and relationships
    for (const metric of metrics) {
      const metricQuery = `
        MATCH (p:Project {key: $projectKey})
        CREATE (m:Metric {
          name: $name,
          value: $value,
          measuredAt: $measuredAt
        })
        CREATE (p)-[r:HAS_METRIC]->(m)
        SET r.createdAt = timestamp()
        RETURN m
      `

      await graph.query(metricQuery, {
        params: {
          projectKey,
          name: metric.metricKey,
          value: metric.value,
          measuredAt: measuredAt.toISOString(),
        },
      })
    }

    console.log(`✅ Synced ${metrics.length} metrics to graph`)
  } catch (error) {
    console.error("❌ Failed to sync metrics to graph:", error)
    captureException(error)
  }
}

/**
 * Extract keywords from issue message for topic linking
 */
function extractKeywords(message: string): string[] {
  const keywords: string[] = []

  // Common code quality topics
  const topicPatterns: Record<string, RegExp[]> = {
    "code-smell": [/code smell/i, /refactor/i, /complexity/i],
    security: [/security/i, /vulnerability/i, /injection/i, /xss/i],
    performance: [/performance/i, /optimization/i, /slow/i],
    "unused-code": [/unused/i, /dead code/i],
    imports: [/import/i],
    "error-handling": [/error/i, /exception/i, /try-catch/i],
    testing: [/test/i, /coverage/i, /assertion/i],
    documentation: [/comment/i, /documentation/i, /javadoc/i],
    "type-safety": [/type/i, /null/i, /undefined/i],
    "best-practices": [/best practice/i, /convention/i],
  }

  for (const [topic, patterns] of Object.entries(topicPatterns)) {
    if (patterns.some((pattern) => pattern.test(message))) {
      keywords.push(topic)
    }
  }

  // If no specific topic matched, add generic "code-quality"
  if (keywords.length === 0) {
    keywords.push("code-quality")
  }

  return keywords
}

/**
 * Query graph for code quality insights
 */
export async function getCodeQualityInsights(options?: {
  severity?: string
  type?: string
  filePath?: string
}) {
  try {
    let query = `
      MATCH (f:File)-[:HAS_ISSUE]->(i:Issue)
      WHERE i.status <> 'RESOLVED'
    `

    const params: Record<string, any> = {}

    if (options?.severity) {
      query += ` AND i.severity = $severity`
      params.severity = options.severity
    }

    if (options?.type) {
      query += ` AND i.type = $type`
      params.type = options.type
    }

    if (options?.filePath) {
      query += ` AND f.path CONTAINS $filePath`
      params.filePath = options.filePath
    }

    query += `
      RETURN f.path as file, 
             COUNT(i) as issueCount,
             COLLECT(DISTINCT i.severity) as severities,
             COLLECT(DISTINCT i.type) as types
      ORDER BY issueCount DESC
      LIMIT 20
    `

    const result = await graph.query(query, { params })
    return result.data || []
  } catch (error) {
    console.error("❌ Failed to get code quality insights:", error)
    captureException(error)
    return []
  }
}

/**
 * Get files with most issues (hotspots)
 */
export async function getCodeHotspots() {
  try {
    const query = `
      MATCH (f:File)-[:HAS_ISSUE]->(i:Issue)
      WHERE i.status <> 'RESOLVED'
      WITH f, COUNT(i) as issueCount,
           SUM(CASE i.severity 
             WHEN 'BLOCKER' THEN 10
             WHEN 'CRITICAL' THEN 5
             WHEN 'MAJOR' THEN 3
             WHEN 'MINOR' THEN 1
             ELSE 0
           END) as riskScore
      RETURN f.path as file,
             f.language as language,
             issueCount,
             riskScore
      ORDER BY riskScore DESC
      LIMIT 10
    `

    const result = await graph.query(query)
    return result.data || []
  } catch (error) {
    console.error("❌ Failed to get code hotspots:", error)
    captureException(error)
    return []
  }
}

/**
 * Clear all SonarCloud data from graph database
 * Used in seed/cleanup scripts
 */
export async function clearSonarCloudGraph() {
  // unstable
  return
  try {
    console.log("🧹 Clearing SonarCloud data from graph...")

    // Delete all Issue nodes and their relationships
    await graph.query(`
      MATCH (i:Issue)
      DETACH DELETE i
    `)

    // Delete all Metric nodes and their relationships
    await graph.query(`
      MATCH (m:Metric)
      DETACH DELETE m
    `)

    // Delete all Project nodes and their relationships
    await graph.query(`
      MATCH (p:Project)
      DETACH DELETE p
    `)

    // Delete File nodes that have no other relationships
    // (keep files that might be referenced by Document chunks)
    await graph.query(`
      MATCH (f:File)
      WHERE NOT (f)-[:HAS_CHUNK]-()
        AND NOT (f)<-[:MENTIONS]-()
      DELETE f
    `)

    console.log("✅ SonarCloud graph data cleared")
  } catch (error) {
    console.error("❌ Failed to clear SonarCloud graph:", error)
    captureException(error)
  }
}
