import type { appWithStore } from "@chrryai/chrry/types"
import { type app, db, eq, graph, isDevelopment, isE2E } from "@repo/db"
import { threads } from "@repo/db/src/schema"
import { embed, generateText } from "ai"
import { captureException } from "../captureException"
import { getEmbeddingProvider, getModelProvider } from "../getModelProvider"

/**
 * FUTURE: App-level provider configuration
 *
 * Each app can specify which AI provider to use for different features:
 *
 * app.metadata.providers = {
 *   rag: "deepSeek",              // Graph RAG operations (Cypher, entity extraction)
 *   memory: "chatGPT",             // Memory/context management
 *   titleGeneration: "claude",     // Thread title generation
 *   summarization: "deepSeek",     // Document summarization
 *   codeExecution: "chatGPT",      // Code analysis and execution
 * }
 *
 * Benefits:
 * - Cost optimization per feature
 * - Quality tuning per use case
 * - User choice and flexibility
 * - Enterprise custom configurations
 *
 * Currently: Hardcoded to "deepSeek" for RAG operations
 * TODO: Implement app.metadata.providers.rag selection
 */

// Ensure indices exist (Lazy initialization)
let isIndexChecked = false
async function ensureIndices() {
  if (isIndexChecked) return
  try {
    // 1. Vector Index (Semantic) - FalkorDB syntax
    // Note: FalkorDB requires a label - using generic 'Entity' label for all nodes
    // Dimension 1536 for text-embedding-3-small
    await graph.query(
      `CREATE VECTOR INDEX FOR (n:Entity) ON (n.embedding) OPTIONS {dimension:1536, similarityFunction:'cosine'}`,
    )
    console.log("✅ Vector Index ensured: Entity.embedding")

    // 2. Full-Text Index (Fuzzy/Typo-tolerant)
    await graph.query(
      `CALL db.idx.fulltext.createNodeIndex('node_text_index', 'name')`,
    )
    console.log("✅ Full-Text Index ensured: node_text_index")
  } catch (error: any) {
    // Silently ignore "already indexed" errors - expected on restart
    if (error.message?.includes("already indexed")) {
      console.log("ℹ️ Indices already exist, skipping creation")
    } else {
      console.log("ℹ️ Index creation error:", error.message)
      captureException(error)
    }
  }
  isIndexChecked = true
}

// Generate embedding for text
async function getEmbedding(
  text: string,
  app?: app | appWithStore,
): Promise<number[] | null> {
  try {
    const provider = await getEmbeddingProvider(app)

    const { embedding } = await embed({
      model: provider.embedding("text-embedding-3-small"),
      value: text,
    })
    return embedding
  } catch (err) {
    captureException(err)
    console.error("⚠️ Embedding Generation Failed:", err)
    return null
  }
}

// Find connection path between two entities
export async function findPath(
  sourceName: string,
  targetName: string,
  app?: app | appWithStore,
): Promise<string> {
  try {
    // Find shortest path up to 5 hops
    const query = `
            MATCH p = shortestPath((a)-[*..5]-(b))
            WHERE a.name = $sourceName AND b.name = $targetName
            RETURN p
        `
    const result = await graph.query(query, {
      params: { sourceName, targetName },
    })

    if ((result as any)?.resultSet?.length === 0) return ""

    // Format path for context
    // This usually requires parsing the path object returned by FalkorDB
    // For simplicity, we might just say "Path found" or try to stringify
    // Let's assume we get nodes/rels in the path
    return `🔗 CONNECTION FOUND: ${sourceName} is related to ${targetName} (Shortest Path)`
  } catch (e) {
    captureException(e)
    return ""
  }
}

/**
 * Level 5: Dynamic Cypher Reasoner
 * Generates a custom Cypher query based on user intent and current graph schema.
 */
async function generateDynamicCypher(
  queryText: string,
  app?: app | appWithStore,
): Promise<string | null> {
  try {
    const prompt = `You are an expert FalkorDB Cypher architect. Generate a Cypher query to retrieve context for this user question: "${queryText}"
    
    Current Graph Schema:
    - Nodes: (Topic {name, createdAt}), (Document {name, threadId, createdAt}), (Chunk {content, chunkIndex}), (User {id})
    - Relations: (Topic)-[REL]->(Topic), (Document)-[:HAS_CHUNK]->(Chunk), (Chunk)-[:MENTIONS]->(Topic)
    
    🚨 CRITICAL FalkorDB Limitations (WILL CAUSE ERRORS IF VIOLATED):
    - NO regex operators (=~, CONTAINS, STARTS WITH, ENDS WITH)
    - Use exact string matching with = only
    - For partial matching, use multiple OR conditions with exact values
    - ORDER BY can ONLY reference variables that are in the RETURN clause (projected variables)
    - NEVER use ORDER BY with computed expressions - always alias them in RETURN first
    - CRITICAL: NO COUNT{} pattern comprehension syntax - FalkorDB does NOT support it
    - For counting relationships: Use size((n)-[:REL]->()) or separate MATCH with count()
    - NEVER use COUNT { (pattern) } - it will cause syntax errors
    - You can use $queryText parameter for the user's question text
    
    🚨 RELATIONSHIP VARIABLE RULES (MOST COMMON ERROR):
    1. If you define a relationship variable like [r], you MUST use it somewhere:
       - Use type(r) in WHERE clause: WHERE type(r) = 'FRIEND'
       - Use type(r) in RETURN clause: RETURN type(r)
       - Use in function: count(r), size(r)
    2. If you DON'T need the relationship info, use anonymous []:
       - CORRECT: MATCH (n)-[]->(m) RETURN n.name, m.name
       - WRONG: MATCH (n)-[r]->(m) RETURN n.name, m.name (r unused!)
    3. NEVER access relationship properties directly (r.property) - use type(r) instead
    4. NEVER leave type() empty: type() is INVALID, must be type(r)
    
    Rules:
    1. Focus on finding relationships and content related to entities in the question.
    2. Use temporal ordering (ORDER BY createdAt DESC) ONLY if you RETURN createdAt.
    3. Return meaningful properties: node.name, type(relationship), property values.
    4. Keep it efficient (LIMIT 15).
    5. Use ONLY exact string matching with = operator.
    6. Return ONLY the raw Cypher query string.
    
    ✅ CORRECT Examples:
    - MATCH (n)-[r]->(m) RETURN n.name, type(r), m.name
    - MATCH (n)-[r]->(m) WHERE type(r) = 'FRIEND' RETURN n.name, type(r)
    - MATCH (n)-[]->(m) RETURN n.name, m.name (anonymous relationship)
    - MATCH (n) RETURN n.name, n.createdAt ORDER BY n.createdAt DESC
    
    ❌ WRONG Examples (WILL CAUSE ERRORS):
    - MATCH (n)-[r]->(m) RETURN n.name, m.name (ERROR: 'r' defined but unused!)
    - MATCH (n)-[r]->(m) WHERE r.type = 'FRIEND' RETURN n.name (ERROR: use type(r)!)
    - MATCH (n) RETURN n.name ORDER BY n.createdAt DESC (ERROR: createdAt not in RETURN!)
    - MATCH (n)-[r]->(m) RETURN n.name, type(), m.name (ERROR: type() empty!)
    - MATCH (n) RETURN n.name ORDER BY score DESC (ERROR: score not defined!)`

    const provider = await getModelProvider(app, "deepSeek")

    const { text } = await generateText({
      model: provider.provider, // DeepSeek: cheaper, faster, great for structured tasks
      prompt,
      temperature: 0,
    })

    const cleanQuery = text.replace(/```cypher|```/g, "").trim()
    if (!cleanQuery.toLowerCase().includes("match")) return null

    // Validate: Check for unsupported regex operators
    const unsupportedOperators = ["=~", "CONTAINS", "STARTS WITH", "ENDS WITH"]
    const hasUnsupportedOp = unsupportedOperators.some((op) =>
      cleanQuery.includes(op),
    )
    if (hasUnsupportedOp) {
      console.warn("⚠️ Cypher query contains unsupported regex operators")
      console.warn(`Query: ${cleanQuery}`)
      return null // Skip invalid query
    }

    // Validate: Check for empty type() function calls
    if (/type\s*\(\s*\)/i.test(cleanQuery)) {
      console.warn("⚠️ Cypher query contains empty type() function call")
      console.warn(`Query: ${cleanQuery}`)
      return null // Skip invalid query
    }

    // Validate: Check if variables without relationship types are used
    // Extract relationship patterns: [r], [r:TYPE], [r1], etc.
    // Only validate variables WITHOUT types (e.g., [r] not [r:FRIEND])
    // Handle spaces: [ r ] → [r], and variable-length paths: [*] or [*1..3]
    // Use simpler regex to avoid ReDoS (catastrophic backtracking)
    const relPatterns =
      cleanQuery.match(/\[\s*(\w+)(?:\s*:\s*[\w_]+)?\s*\]/g) || []

    // Filter to only variables without types: [r] but not [r:TYPE]
    // Also exclude variable-length path markers: [*], [*1..3]
    const varsWithoutTypes = relPatterns
      .filter((pattern) => !pattern.includes(":") && !pattern.includes("*"))
      .map((v) => v.replace(/[[\]\s]/g, "")) // Remove brackets and spaces

    if (varsWithoutTypes.length > 0) {
      // Check if each variable is used anywhere in the query after its definition
      const unusedVars = varsWithoutTypes.filter((varName) => {
        // Find where the variable is defined (handle spaces: [r] or [ r ])
        const definePattern = new RegExp(`\\[\\s*${varName}\\s*\\]`)
        const defineMatch = cleanQuery.match(definePattern)
        if (!defineMatch) return false

        const defineIndex = cleanQuery.indexOf(defineMatch[0])

        // Check if it's used after definition (not just in the brackets)
        const afterDefinition = cleanQuery.substring(
          defineIndex + defineMatch[0].length,
        )

        // Use regex with word boundaries to catch all usages regardless of spacing
        // Variable is used if it appears in:
        // - r.property (property access)
        // - type(r) or count(r) (function call)
        // - RETURN r, or WHERE r (with word boundary)
        const varPattern = new RegExp(
          `\\b${varName}\\.|` + // r.property
            `\\(${varName}\\)|` + // type(r), count(r)
            `\\b${varName}\\b(?![\\]])`, // r as standalone word (not in [r])
          "i",
        )

        const isUsed = varPattern.test(afterDefinition)

        return !isUsed
      })

      if (unusedVars.length > 0) {
        console.warn(
          `⚠️ Cypher query has unused variables: ${unusedVars.join(", ")}`,
        )
        console.warn(`Query: ${cleanQuery}`)
        return null // Skip invalid query
      }
    }

    return cleanQuery
  } catch (err) {
    captureException(err)
    console.error("⚠️ Dynamic Cypher Generation Failed:", err)
    return null
  }
}

// Security: Sanitize labels to prevent Cypher injection
function sanitize(label: string): string {
  let sanitized = label.replace(/[^a-zA-Z0-9_]/g, "_").trim()

  // Eğer ilk karakter rakamsa başına _ ekle (BAM!)
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `_${sanitized}`
  }

  return sanitized || "Generic"
}

// Store document chunks in Graph
export async function storeDocumentChunk(
  filename: string,
  chunkIndex: number,
  content: string,
  embedding: number[],
  threadId: string,
  fileType: string,
) {
  try {
    await ensureIndices()
    const now = Date.now()

    // Query to create Document node and generic Chunk node
    // We link Chunk to Document
    // SECURITY: Parameterized
    // Level 5: Added temporal tracking (createdAt)
    const query = `
          MERGE (d:Document {name: $filename})
          ON CREATE SET d.threadId = $threadId, d.fileType = $fileType, d.createdAt = $now
          ON MATCH SET d.updatedAt = $now
          
          CREATE (c:Chunk {content: $content, chunkIndex: $chunkIndex, createdAt: $now})
          SET c.embedding = $embedding
          
          MERGE (d)-[r:HAS_CHUNK]->(c)
          SET r.createdAt = $now
        `

    await graph.query(query, {
      params: {
        filename,
        threadId,
        fileType,
        content,
        chunkIndex,
        embedding,
        now,
      },
    })
    // console.log(`📚 Graph Chunk Synced: ${filename} #${chunkIndex}`)
  } catch (error) {
    captureException(error)
    console.error("❌ Failed to store chunk in graph:", error)
    // Do not throw, keep legacy flow alive
  }
}

// Extract entities from a chunk and link them (Level 4 - God Mode)
export async function linkChunkToEntities({
  content,
  filename,
  chunkIndex,
  app,
}: {
  content: string
  filename: string
  chunkIndex: number
  app?: app | appWithStore
}) {
  try {
    const prompt = `Extract key entities (people, places, topics, concepts) from this text chunk. Return ONLY a JSON array of entity names.
    Text: "${content}"
    Example: ["Entity1", "Entity2"]`

    const provider = await getModelProvider(app, "deepSeek")

    const { text } = await generateText({
      model: provider.provider,
      prompt,
      temperature: 0,
    })

    const entities: string[] = JSON.parse(
      text.replace(/```json|```/g, "").trim(),
    )

    if (!Array.isArray(entities)) return

    const now = Date.now()
    for (const entityName of entities) {
      // Link Chunk node to Entity node
      // Note: Entity might already exist from chat extraction, if not we create as generic 'Topic'
      // Level 5: Temporal linking
      const query = `
                MATCH (d:Document {name: $filename})
                MATCH (d)-[:HAS_CHUNK]->(c:Chunk {chunkIndex: $chunkIndex})
                MERGE (e:Topic {name: $entityName})
                ON CREATE SET e.createdAt = $now
                MERGE (c)-[r:MENTIONS]->(e)
                ON CREATE SET r.createdAt = $now
            `
      await graph.query(query, {
        params: { filename, chunkIndex, entityName, now },
      })
    }
    // console.log(`🔗 Entity Linking Done: ${filename} #${chunkIndex} -> [${entities.join(', ')}]`)
  } catch (e) {
    captureException(e)
    console.error("⚠️ Entity Linking Failed:", e)
  }
}

// Extract entities and relationships from message content
export async function extractAndStoreKnowledge(
  content: string,
  userId?: string,
  app?: app | appWithStore,
) {
  try {
    // 1. LLM Extraction
    const prompt = `Extract knowledge from this text into a list of (Entity)-[RELATIONSHIP]->(Target) triplets.
    Text: "${content}"
    
    Return ONLY a JSON object:
    {
      "triplets": [
        {"source": "EntityName", "type": "Person|Topic|Place|etc", "relation": "LOVES|OWNS|KNOWS|etc", "target": "TargetName", "targetType": "Person|Topic|Place| etc"}
      ]
    }`

    const provider = await getModelProvider(app, "deepSeek")

    const { text } = await generateText({
      model: provider.provider, // Use a smart model for extraction
      prompt,
      temperature: 0,
    })

    // Robust JSON extraction - handle text before/after JSON
    let jsonStr = text.trim()

    // Remove markdown code blocks
    jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "")

    // Try to extract JSON object if wrapped in text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    let data
    try {
      data = JSON.parse(jsonStr)
    } catch (parseError) {
      captureException(parseError, "extractGraphEntities:parseJSON")
      console.error("❌ Failed to parse graph extraction JSON:", {
        error: parseError,
        rawText: text.substring(0, 200),
        extractedJson: jsonStr.substring(0, 200),
      })
      return
    }

    if (!data.triplets || !Array.isArray(data.triplets)) {
      console.warn("⚠️ Graph extraction returned invalid structure:", {
        hasTriplets: !!data.triplets,
        isArray: Array.isArray(data.triplets),
      })
      return
    }

    // 2. Store in FalkorDB
    // Ensure indices exist before writing
    await ensureIndices()

    const now = Date.now()
    for (const triple of data.triplets) {
      const { source, type, relation, target, targetType } = triple

      const sLabel = sanitize(type)
      const tLabel = sanitize(targetType)
      const rType = sanitize(relation).toUpperCase()

      // Sanitize node names to prevent RediSearch syntax errors (e.g., "chatGPT's" → "chatGPT s")
      // Keep readable but remove special chars that break full-text search
      const sanitizedSource = source.replace(/['"]/g, "")
      const sanitizedTarget = target.replace(/['"]/g, "")

      // Generate embeddings
      const sourceEmbedding = await getEmbedding(sanitizedSource, app)
      const targetEmbedding = await getEmbedding(sanitizedTarget, app)

      // Cypher query to merge nodes and create relationship
      // SECURITY: Using parameterized queries to prevent injection
      // We explicitly set the embedding property using vec.from_list logic or just passing the array
      // FalkorDB client handles array -> vector conversion if supported, or we pass it as parameter
      // Level 5: Advanced versioned storage with temporal tracking
      const vectorQuery = `
        MERGE (s:\`${sLabel}\` {name: $source})
        ON CREATE SET s.createdAt = $now, s.embedding = $sourceEmbedding
        ON MATCH SET s.updatedAt = $now, s.embedding = $sourceEmbedding
        
        MERGE (t:\`${tLabel}\` {name: $target})
        ON CREATE SET t.createdAt = $now, t.embedding = $targetEmbedding
        ON MATCH SET t.updatedAt = $now, t.embedding = $targetEmbedding
        
        MERGE (s)-[r:\`${rType}\`]->(t)
        ON CREATE SET r.createdAt = $now
        ON MATCH SET r.updatedAt = $now
      `

      // Note: If embeddings are null (API fail), we proceed without them (Graph survives)
      if (sourceEmbedding && targetEmbedding) {
        await graph.query(vectorQuery, {
          params: {
            source: sanitizedSource,
            target: sanitizedTarget,
            sourceEmbedding,
            targetEmbedding,
            now,
          },
        })
      } else {
        // Fallback without vector if embedding failed
        await graph.query(
          `
            MERGE (s:${sLabel} {name: $source})
            ON CREATE SET s.createdAt = $now
            MERGE (t:${tLabel} {name: $target})
            ON CREATE SET t.createdAt = $now
            MERGE (s)-[r:${rType}]->(t)
            ON CREATE SET r.createdAt = $now
         `,
          { params: { source: sanitizedSource, target: sanitizedTarget, now } },
        )
      }

      console.log(
        `🕸️ Graph Synced (Level 5): (${sanitizedSource})-[${relation}]->(${sanitizedTarget})`,
      )
    }

    const sourceNodeName = data?.triplets?.[0]?.source
    if (!sourceNodeName) {
      console.warn(
        `Cannot connect User ${userId} to entity: missing source in triplets`,
        data,
      )
    }
    // Connect User to these entities if userId present
    if (userId && sourceNodeName) {
      // Assume User node exists (synced elsewhere or Created here lazily)
      await graph.query(
        `
        MERGE (u:User {id: $userId})
        WITH u
        MATCH (n {name: $nodeName}) 
        MERGE (u)-[:MENTIONED]->(n)
    `,
        {
          params: {
            userId,
            nodeName: sourceNodeName,
          },
        },
      )
    }
  } catch (error) {
    console.error("❌ Graph Extraction Failed:", error)
    captureException(error)
  }
}

// Retrieve relevant graph context
export async function getGraphContext(
  queryText: string,
  app?: app | appWithStore,
): Promise<string> {
  try {
    // Ensure indices exist before querying
    await ensureIndices()

    const contextItems = new Set<string>()

    // Level 5: Dynamic Reasoner (Primary)
    // AI determines the best way to query the graph for THIS specific question
    const dynamicQuery = await generateDynamicCypher(queryText, app)
    if (dynamicQuery) {
      try {
        // Pass queryText as parameter for safe injection-free queries
        const dynamicResult = await graph.query(dynamicQuery, {
          params: { queryText },
        })
        if ((dynamicResult as any)?.resultSet?.length > 0) {
          for (const row of (dynamicResult as any).resultSet) {
            contextItems.add(`- [Dynamic Reasoning] ${JSON.stringify(row)}`)
          }
        }
      } catch (err) {
        captureException(err)
        console.warn(
          "⚠️ Dynamic Cypher execution failed, using hybrid fallback.",
        )
      }
    }

    // Fallback: Triple-Hybrid Search (Level 4 logic)
    // 1. Vector Search (Semantic)
    const embedding = await getEmbedding(queryText, app)
    if (embedding) {
      try {
        // FalkorDB vector query: queryNodes(label, attribute, k, vector)
        // Note: vecf32() requires inline array, not parameter
        // Label must match the index we created (Entity)
        const vectorQuery = `
          CALL db.idx.vector.queryNodes('Entity', 'embedding', 5, vecf32(${JSON.stringify(embedding)})) 
          YIELD node, score
          RETURN node.name, score
        `
        const vectorResult = await graph.query(vectorQuery)

        const semanticNodes =
          (vectorResult as any)?.resultSet?.map((row: any) => row[0]) || []

        if (semanticNodes.length > 0) {
          // Expand semantically similar nodes + follow MENTIONS links
          // CRITICAL: UNION requires exact column type match - cast both to string
          const expandQuery = `
                MATCH (n)-[r]->(m)
                WHERE n.name IN $names
                RETURN n.name as source, type(r) as rel, toString(m.name) as target
                LIMIT 10
                UNION
                MATCH (e:Topic)<-[rm:MENTIONS]-(c:Chunk)<-[:HAS_CHUNK]-(d:Document)
                WHERE e.name IN $names
                RETURN d.name as source, 'DISCUSSES' as rel, substring(c.content, 0, 500) as target
                LIMIT 5
            `
          const expansion = await graph.query(expandQuery, {
            params: { names: semanticNodes },
          })
          if ((expansion as any)?.resultSet) {
            for (const row of (expansion as any).resultSet) {
              if (
                row[1] === "DISCUSSES" &&
                row[2] &&
                typeof row[2] === "string"
              ) {
                contextItems.add(
                  `- [From Doc: ${row[0]}] Mentioned Content: ${row[2].substring(0, 200)}...`,
                )
              } else if (row[2]) {
                contextItems.add(`- (${row[0]}) ${row[1]} (${String(row[2])})`)
              }
            }
          }
        }
      } catch (err) {
        console.warn("⚠️ Vector search failed:", err)
        captureException(err)
      }
    }

    // 2. Full-Text Search (Fuzzy/Typo-tolerant)
    // Uses RediSearch underneath for powerful multi-term text matching
    try {
      // Escape RediSearch special characters that cause syntax errors
      // Special chars: - : @ | ( ) [ ] { } " \ '
      // Note: Spaces are NOT escaped to allow multi-term search (e.g., "AI agent" matches both terms)
      const escapedQuery = queryText
        .replace(/\\/g, "\\\\") // Escape backslashes first
        .replace(/'/g, "\\'") // Escape apostrophes
        .replace(/"/g, '\\"') // Escape quotes
        .replace(/[-:@|()[\]{}$%^&*+=!~<>?,.;]/g, "\\$&") // Escape other special chars
        .replace(/\s+/g, " ") // Normalize whitespace to single spaces
        .trim()

      const ftQuery = `
            CALL db.idx.fulltext.queryNodes('node_text_index', $query) 
            YIELD node
            RETURN node.name
        `
      const ftResult = await graph.query(ftQuery, {
        params: { query: escapedQuery },
      })
      const textNodes =
        (ftResult as any)?.resultSet?.map((row: any) => row[0]) || []

      if (textNodes.length > 0) {
        // CRITICAL: UNION requires exact column type match - cast both to string
        const expandQuery = `
                MATCH (n)-[r]->(m)
                WHERE n.name IN $names
                RETURN n.name as source, type(r) as rel, toString(m.name) as target
                LIMIT 10
                UNION
                MATCH (e:Topic)<-[rm:MENTIONS]-(c:Chunk)<-[:HAS_CHUNK]-(d:Document)
                WHERE e.name IN $names
                RETURN d.name as source, 'DISCUSSES' as rel, substring(c.content, 0, 500) as target
                LIMIT 3
            `
        const expansion = await graph.query(expandQuery, {
          params: { names: textNodes },
        })
        if ((expansion as any)?.resultSet) {
          for (const row of (expansion as any).resultSet) {
            if (
              row[1] === "DISCUSSES" &&
              row[2] &&
              typeof row[2] === "string"
            ) {
              contextItems.add(
                `- [From Doc: ${row[0]}] Mentioned Content: ${row[2].substring(0, 150)}...`,
              )
            } else if (row[2]) {
              contextItems.add(`- (${row[0]}) ${row[1]} (${String(row[2])})`)
            }
          }
        }
      }
    } catch (err) {
      captureException(err)
      console.warn("FT search failed:", err)
    }

    if (contextItems.size === 0) return ""

    return `🕸️ GRAPH KNOWLEDGE (Lvl 5 Reasoning):\n${Array.from(contextItems).join("\n")}`
  } catch (error) {
    captureException(error, "getGraphContext")
    console.error("❌ Graph Retrieval Failed:", error)
    return ""
  }
}

/**
 * Store a news article in the graph with embedding + entity extraction
 * Creates a NewsArticle node linked to Topic entities extracted from title+description
 */
export async function storeNewsInGraph(article: {
  title: string
  description: string | null
  content?: string | null
  source: string | null
  country?: string | null
  category: string | null
  publishedAt: Date | null
}): Promise<void> {
  try {
    await ensureIndices()
    const now = Date.now()
    // Use richest available text for embedding
    const content = [article.title, article.description, article.content]
      .filter(Boolean)
      .join(". ")
      .substring(0, 3000)
    const embedding = await getEmbedding(content)
    const articleName = article.title.substring(0, 200).replace(/['"]/g, "")
    const category = article.category || "general"
    const source = article.source || "unknown"
    const country = article.country || "us"

    if (embedding) {
      await graph.query(
        `
        MERGE (n:NewsArticle {name: $name})
        ON CREATE SET n.category = $category, n.source = $source, n.country = $country, n.createdAt = $now, n.embedding = $embedding
        ON MATCH SET n.updatedAt = $now, n.embedding = $embedding
        `,
        {
          params: {
            name: articleName,
            category,
            source,
            country,
            now,
            embedding,
          },
        },
      )
    } else {
      await graph.query(
        `
        MERGE (n:NewsArticle {name: $name})
        ON CREATE SET n.category = $category, n.source = $source, n.country = $country, n.createdAt = $now
        ON MATCH SET n.updatedAt = $now
        `,
        { params: { name: articleName, category, source, country, now } },
      )
    }

    // Link to category topic
    await graph.query(
      `
      MERGE (t:Topic {name: $category})
      ON CREATE SET t.createdAt = $now
      MATCH (n:NewsArticle {name: $name})
      MERGE (n)-[r:BELONGS_TO]->(t)
      ON CREATE SET r.createdAt = $now
      `,
      { params: { name: articleName, category, now } },
    )

    console.log(`📰 Graph News Synced: ${articleName.substring(0, 60)}...`)
  } catch (error) {
    captureException(error, "storeNewsInGraph")
    console.error("❌ Failed to store news in graph:", error)
  }
}

/**
 * Query recent news from graph by semantic similarity
 */
export async function getNewsContext(
  queryText: string,
  limit = 5,
): Promise<string> {
  try {
    await ensureIndices()
    const embedding = await getEmbedding(queryText)
    if (!embedding) return ""

    const vectorQuery = `
      CALL db.idx.vector.queryNodes('Entity', 'embedding', ${limit}, vecf32(${JSON.stringify(embedding)}))
      YIELD node, score
      WHERE node:NewsArticle
      RETURN node.name, node.source, node.country, node.category, score
    `
    const result = await graph.query(vectorQuery)
    const rows = (result as any)?.resultSet || []
    if (rows.length === 0) return ""

    // row: [name, source, country, category, score]
    const lines = rows.map((row: any) => {
      const name = row[0] || ""
      const source = row[1] || "unknown"
      const country = row[2] || ""
      const category = row[3] || ""
      const tag = [source, country, category].filter(Boolean).join(" / ")
      return `- [${tag}] ${name}`
    })
    return lines.join("\n")
  } catch (err) {
    captureException(err, "getNewsContext")
    console.warn("⚠️ News graph query failed:", err)
    return ""
  }
}

/**
 * Clear all graph data for a specific user or guest
 * Used when deleting user/guest accounts or memories
 */
export async function clearGraphDataForUser({
  userId,
  guestId,
}: {
  userId?: string
  guestId?: string
}): Promise<void> {
  try {
    const identifier = userId || guestId
    if (!identifier) {
      console.warn("⚠️ No userId or guestId provided for graph cleanup")
      return
    }

    // Get user's thread IDs from PostgreSQL
    const userThreads = await db
      .select({ id: threads.id })
      .from(threads)
      .where(
        userId ? eq(threads.userId, userId) : eq(threads.guestId, guestId!),
      )
      .limit(10000) // Prevent performance issues with users who have many threads

    const threadIds = userThreads.map((t) => t.id)

    // Delete User node
    await graph.query(`MATCH (u:User {id: $identifier}) DETACH DELETE u`, {
      params: { identifier },
    })

    // Delete Documents and Chunks for each thread
    // Documents are linked by threadId property, not by relationship
    // Use UNWIND for batch processing (FalkorDB best practice)
    if (threadIds.length > 0) {
      // Process in chunks of 1000 to avoid overwhelming the graph
      const chunkSize = 1000
      for (let i = 0; i < threadIds.length; i += chunkSize) {
        const chunk = threadIds.slice(i, i + chunkSize)
        await graph.query(
          `
          UNWIND $threadIds AS threadId
          MATCH (d:Document {threadId: threadId})
          OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk)
          DETACH DELETE d, c
          `,
          { params: { threadIds: chunk } },
        )
      }
    }

    console.log(
      `🧹 Cleared graph data for ${userId ? "user" : "guest"}: ${identifier} (${threadIds.length} threads)`,
    )
  } catch (error) {
    captureException(error, "clearGraphDataForUser")
    console.error("❌ Failed to clear graph data:", error)
    // Don't throw - cleanup should be best-effort
  }
}

/**
 * Clear ALL graph data
 * Used for test cleanup and full database resets
 * ⚠️ DESTRUCTIVE - Use with caution!
 */
export async function clearAllGraphData(): Promise<void> {
  if (!isDevelopment && !isE2E) return

  try {
    // Delete all nodes and relationships
    await graph.query("MATCH (n) DETACH DELETE n")
    console.log("🧹 Cleared all graph data")
  } catch (error) {
    captureException(error)
    console.error("❌ Failed to clear all graph data:", error)
    // Don't throw - cleanup should be best-effort
  }
}
