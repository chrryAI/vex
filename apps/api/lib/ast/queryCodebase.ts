import { openai } from "@ai-sdk/openai"
import { codeEmbeddings, db } from "@repo/db"
import { embed } from "ai"
import { eq, sql } from "drizzle-orm"
import { queryCodeGraph } from "./storeFalkorGraph"

interface CodebaseQueryResult {
  codeChunks: Array<{
    id: string
    filepath: string
    type: string
    name: string
    content: string
    startLine?: number
    endLine?: number
    similarity: number
  }>
  relationships: Array<{
    from: { name: string; filepath: string }
    relation: { type: string }
    to: { name: string; filepath: string }
  }>
}

export async function queryCodebase(
  query: string,
  repoName: string,
  options: {
    limit?: number
    minSimilarity?: number
    includeGraph?: boolean
  } = {},
): Promise<CodebaseQueryResult> {
  const { limit = 10, minSimilarity = 0.7, includeGraph = true } = options

  console.log(`🔍 Querying codebase for: "${query}"`)

  // 1. Generate query embedding
  const { embedding: queryEmbedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: query,
  })

  // 2. Vector similarity search using pgvector
  // Note: Using cosine distance (1 - cosine similarity)
  const results = await db.execute(sql`
    SELECT 
      id,
      filepath,
      type,
      name,
      content,
      "startLine",
      "endLine",
      1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
    FROM ${codeEmbeddings}
    WHERE 
      "repoName" = ${repoName}
      AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > ${minSimilarity}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `)

  const codeChunks = ((results as any).rows as any[]).map((row) => ({
    id: row.id,
    filepath: row.filepath,
    type: row.type,
    name: row.name,
    content: row.content,
    startLine: row.startLine,
    endLine: row.endLine,
    similarity: parseFloat(row.similarity),
  }))

  console.log(`✅ Found ${codeChunks.length} relevant code chunks`)

  // 3. Get graph context from FalkorDB (if enabled)
  let relationships: CodebaseQueryResult["relationships"] = []

  if (includeGraph && codeChunks.length > 0) {
    try {
      // Extract function/class names from results
      const nodeIds = codeChunks
        .filter((c) => c.type === "function" || c.type === "class")
        .map((c) => `'${c.id}'`)
        .join(",")

      if (nodeIds) {
        const graphResult = await queryCodeGraph(`
          MATCH (n)
          WHERE n.id IN [${nodeIds}]
          OPTIONAL MATCH (n)-[r]->(m)
          RETURN n, r, m
          LIMIT 50
        `)

        // Parse graph results
        if (graphResult.data && graphResult.data.length > 0) {
          relationships = graphResult.data
            .filter((row: any) => row[1] && row[2]) // Has relationship and target
            .map((row: any) => ({
              from: {
                name: row[0].properties.name || "unknown",
                filepath: row[0].properties.filepath || "unknown",
              },
              relation: {
                type: row[1].type || "unknown",
              },
              to: {
                name: row[2].properties.name || "unknown",
                filepath: row[2].properties.filepath || "unknown",
              },
            }))

          console.log(`✅ Found ${relationships.length} graph relationships`)
        }
      }
    } catch (error) {
      console.error("⚠️ Failed to fetch graph context:", error)
      // Continue without graph context
    }
  }

  return {
    codeChunks,
    relationships,
  }
}

// Helper: Search for specific code patterns
export async function searchCodePattern(
  pattern: string,
  repoName: string,
  type?: "function" | "class" | "file",
) {
  const conditions = [eq(codeEmbeddings.repoName, repoName)]

  if (type) {
    conditions.push(eq(codeEmbeddings.type, type))
  }

  const results = await db
    .select()
    .from(codeEmbeddings)
    .where(
      sql`${sql.join(conditions, sql` AND `)} AND content ILIKE ${`%${pattern}%`}`,
    )
    .limit(20)

  return results
}

// Helper: Find code by file path
export async function getCodeByFilepath(filepath: string, repoName: string) {
  const results = await db
    .select()
    .from(codeEmbeddings)
    .where(
      sql`${eq(codeEmbeddings.repoName, repoName)} AND ${eq(codeEmbeddings.filepath, filepath)}`,
    )
    .orderBy(codeEmbeddings.startLine)

  return results
}

// Helper: Find similar functions
export async function findSimilarFunctions(
  functionName: string,
  repoName: string,
  limit: number = 5,
) {
  // Get the function's embedding
  const targetFunction = await db
    .select()
    .from(codeEmbeddings)
    .where(
      sql`${eq(codeEmbeddings.repoName, repoName)} AND ${eq(codeEmbeddings.type, "function")} AND ${eq(codeEmbeddings.name, functionName)}`,
    )
    .limit(1)

  if (targetFunction.length === 0) {
    return []
  }

  if (!targetFunction[0]) {
    throw new Error(`Function ${functionName} not found in ${repoName}`)
  }

  const targetEmbedding = targetFunction[0].embedding

  // Find similar functions using vector similarity
  const results = await db.execute(sql`
    SELECT 
      id,
      filepath,
      name,
      content,
      "startLine",
      "endLine",
      1 - (embedding <=> ${targetEmbedding}::vector) as similarity
    FROM ${codeEmbeddings}
    WHERE 
      "repoName" = ${repoName}
      AND type = 'function'
      AND id != ${targetFunction[0]!.id}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `)

  return (results as any).rows
}
