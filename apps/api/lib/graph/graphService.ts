import { graph } from "@repo/db"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText, embed } from "ai"
import captureException from "../../lib/captureException"

const openai = createOpenAI({
  apiKey: process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY,
})

// Ensure indices exist (Lazy initialization)
let isIndexChecked = false
async function ensureIndices() {
  if (isIndexChecked) return
  try {
    // 1. Vector Index (Semantic)
    // Dimension 1536 for text-embedding-3-small
    await graph.query(
      `CALL db.idx.vector.createNodeIndex('node_vector_index', 'name', 'embedding', 1536, 'COSINE')`,
    )
    console.log("✅ Vector Index ensured: node_vector_index")

    // 2. Full-Text Index (Fuzzy/Typo-tolerant)
    // Indexes the 'name' property of any node
    await graph.query(
      `CALL db.idx.fulltext.createNodeIndex('node_text_index', 'name')`,
    )
    console.log("✅ Full-Text Index ensured: node_text_index")
  } catch (error) {
    // Indices likely exist, ignore specifics
    // console.log("ℹ️ Index check:", error.message)
  }
  isIndexChecked = true
}

// Generate embedding for text
async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: text,
    })
    return embedding
  } catch (error) {
    console.error("❌ Embedding Generation Failed:", error)
    return null
  }
}

// Find connection path between two entities
export async function findPath(
  sourceName: string,
  targetName: string,
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
    return ""
  }
}

/**
 * Level 5: Dynamic Cypher Reasoner
 * Generates a custom Cypher query based on user intent and current graph schema.
 */
async function generateDynamicCypher(
  queryText: string,
): Promise<string | null> {
  try {
    const prompt = `You are an expert FalkorDB Cypher architect. Generate a Cypher query to retrieve context for this user question: "${queryText}"
    
    Current Graph Schema:
    - Nodes: (Topic {name, createdAt}), (Document {name, threadId, createdAt}), (Chunk {content, chunkIndex}), (User {id})
    - Relations: (Topic)-[REL]->(Topic), (Document)-[:HAS_CHUNK]->(Chunk), (Chunk)-[:MENTIONS]->(Topic)
    
    Rules:
    1. Focus on finding relationships and content related to entities in the question.
    2. Use temporal ordering (DESC createdAt) if relevance is time-sensitive.
    3. Return meaningful properties: node.name, type(relationship), property values.
    4. Keep it efficient (LIMIT 15).
    5. Return ONLY the raw Cypher query string.`

    const { text } = await generateText({
      model: openai("gpt-4o"), // Use the smartest model for logic
      prompt,
      temperature: 0,
    })

    const cleanQuery = text.replace(/```cypher|```/g, "").trim()
    if (cleanQuery.toLowerCase().includes("match")) return cleanQuery
    return null
  } catch (err) {
    console.error("⚠️ Dynamic Cypher Generation Failed:", err)
    return null
  }
}

// Security: Sanitize labels to prevent Cypher injection
function sanitize(label: string): string {
  let sanitized = label.replace(/[^a-zA-Z0-9_]/g, "_").trim()

  // Eğer ilk karakter rakamsa başına _ ekle (BAM!)
  if (/^[0-9]/.test(sanitized)) {
    sanitized = "_" + sanitized
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
    console.error("❌ Failed to store chunk in graph:", error)
    // Do not throw, keep legacy flow alive
  }
}

// Extract entities from a chunk and link them (Level 4 - God Mode)
export async function linkChunkToEntities(
  content: string,
  filename: string,
  chunkIndex: number,
) {
  try {
    const prompt = `Extract exactly the top 3 key entities (Topics, People, Tech, Concepts) from this text fragment.
        Text: "${content.substring(0, 1000)}"
        Return ONLY a JSON array of strings: ["Entity1", "Entity2", "Entity3"]`

    const { text } = await generateText({
      model: openai("gpt-4o-mini"), // Cheap model for extraction
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
    console.error("⚠️ Entity Linking Failed:", e)
  }
}

// Extract entities and relationships from message content
export async function extractAndStoreKnowledge(
  content: string,
  messageId: string,
  userId?: string,
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

    const { text } = await generateText({
      model: openai("gpt-4o"), // Use a smart model for extraction
      prompt,
      temperature: 0,
    })

    const jsonStr = text.replace(/```json|```/g, "").trim()
    const data = JSON.parse(jsonStr)

    if (!data.triplets || !Array.isArray(data.triplets)) return

    // 2. Store in FalkorDB
    // Ensure indices exist before writing
    await ensureIndices()

    const now = Date.now()
    for (const triple of data.triplets) {
      const { source, type, relation, target, targetType } = triple

      const sLabel = sanitize(type)
      const tLabel = sanitize(targetType)
      const rType = sanitize(relation).toUpperCase()

      // Generate embeddings
      const sourceEmbedding = await getEmbedding(source)
      const targetEmbedding = await getEmbedding(target)

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
            source,
            target,
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
          { params: { source, target, now } },
        )
      }

      console.log(
        `🕸️ Graph Synced (Level 5): (${source})-[${relation}]->(${target})`,
      )
    }

    // Connect User to these entities if userId present
    if (userId) {
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
            nodeName: data?.triplets?.[0]?.source,
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
export async function getGraphContext(queryText: string): Promise<string> {
  try {
    const contextItems = new Set<string>()

    // Level 5: Dynamic Reasoner (Primary)
    // AI determines the best way to query the graph for THIS specific question
    const dynamicQuery = await generateDynamicCypher(queryText)
    if (dynamicQuery) {
      try {
        const dynamicResult = await graph.query(dynamicQuery)
        if ((dynamicResult as any)?.resultSet?.length > 0) {
          for (const row of (dynamicResult as any).resultSet) {
            contextItems.add(`- [Dynamic Reasoning] ${JSON.stringify(row)}`)
          }
        }
      } catch (err) {
        console.warn(
          "⚠️ Dynamic Cypher execution failed, using hybrid fallback.",
        )
      }
    }

    // Fallback: Triple-Hybrid Search (Level 4 logic)
    // 1. Vector Search (Semantic)
    const embedding = await getEmbedding(queryText)
    if (embedding) {
      try {
        const vectorQuery = `
          CALL db.idx.vector.queryNodes('node_vector_index', 'embedding', $embedding, 5) 
          YIELD node, score
          RETURN node.name, score
        `
        const vectorResult = await graph.query(vectorQuery, {
          params: { embedding },
        })

        const semanticNodes =
          (vectorResult as any)?.resultSet?.map((row: any) => row[0]) || []

        if (semanticNodes.length > 0) {
          // Expand semantically similar nodes + follow MENTIONS links
          const expandQuery = `
                MATCH (n)-[r]->(m)
                WHERE n.name IN $names
                RETURN n.name, type(r), m.name
                LIMIT 10
                UNION
                MATCH (e:Topic)<-[rm:MENTIONS]-(c:Chunk)<-[:HAS_CHUNK]-(d:Document)
                WHERE e.name IN $names
                RETURN d.name as source, 'DISCUSSES' as rel, c.content as target
                LIMIT 5
            `
          const expansion = await graph.query(expandQuery, {
            params: { names: semanticNodes },
          })
          for (const row of (expansion as any).resultSet) {
            if (row[1] === "DISCUSSES") {
              contextItems.add(
                `- [From Doc: ${row[0]}] Mentioned Content: ${row[2].substring(0, 200)}...`,
              )
            } else {
              contextItems.add(`- (${row[0]}) ${row[1]} (${row[2]})`)
            }
          }
        }
      } catch (err) {
        console.warn("⚠️ Vector search failed:", err)
      }
    }

    // 2. Full-Text Search (Fuzzy/Typo-tolerant)
    // Uses RediSearch underneath for powerful text matching
    try {
      const ftQuery = `
            CALL db.idx.fulltext.queryNodes('node_text_index', $query) 
            YIELD node
            RETURN node.name
        `
      const ftResult = await graph.query(ftQuery, {
        params: { query: queryText },
      })
      const textNodes =
        (ftResult as any)?.resultSet?.map((row: any) => row[0]) || []

      if (textNodes.length > 0) {
        const expandQuery = `
                MATCH (n)-[r]->(m)
                WHERE n.name IN $names
                RETURN n.name, type(r), m.name
                LIMIT 10
                UNION
                MATCH (e:Topic)<-[rm:MENTIONS]-(c:Chunk)<-[:HAS_CHUNK]-(d:Document)
                WHERE e.name IN $names
                RETURN d.name as source, 'DISCUSSES' as rel, c.content as target
                LIMIT 3
            `
        const expansion = await graph.query(expandQuery, {
          params: { names: textNodes },
        })
        for (const row of (expansion as any).resultSet) {
          if (row[1] === "DISCUSSES") {
            contextItems.add(
              `- [From Doc: ${row[0]}] Mentioned Content: ${row[2].substring(0, 150)}...`,
            )
          } else {
            contextItems.add(`- (${row[0]}) ${row[1]} (${row[2]})`)
          }
        }
      }
    } catch (err) {
      // console.warn("FT search failed:", err)
    }

    if (contextItems.size === 0) return ""

    return `🕸️ GRAPH KNOWLEDGE (Lvl 5 Reasoning):\n${Array.from(contextItems).join("\n")}`
  } catch (error) {
    captureException(error)
    console.error("❌ Graph Retrieval Failed:", error)
    return ""
  }
}
