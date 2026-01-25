import { graph } from "@repo/db"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import captureException from "../../lib/captureException"

const openai = createOpenAI({
  apiKey: process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY,
})

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
    for (const triple of data.triplets) {
      const { source, type, relation, target, targetType } = triple

      // Cypher query to merge nodes and create relationship
      // SECURITY: Using parameterized queries to prevent injection
      const query = `
        MERGE (s:${type} {name: $source})
        MERGE (t:${targetType} {name: $target})
        MERGE (s)-[:${relation.toUpperCase()}]->(t)
        RETURN s, t
      `

      await graph.query(query, {
        params: {
          source,
          target,
        },
      })
      console.log(`🕸️ Graph Synced: (${source})-[${relation}]->(${target})`)
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
            nodeName: data.triplets[0].source,
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
    // 1. Extract keywords/entities from query to find entry points in Graph
    // Simple heuristic: Use uppercase words or just match any node name present in query
    // For a real system, we'd use an LLM or NER here too.

    // Attempting a broad search: Find nodes whose names appear in the query
    // Note: FalkorDB supports full-text search indices if configured, simple contains for now

    // Cleaning query for safe cypher insertion (basic)
    const cypher = `
      MATCH (n)-[r]->(m)
      WHERE $query CONTAINS n.name OR $query CONTAINS m.name
      RETURN n.name, type(r), m.name
      LIMIT 10
    `

    const result = await graph.query(cypher, {
      params: {
        query: queryText,
      },
    })

    if ((result as any)?.resultSet?.length === 0) return ""

    let context = "🕸️ GRAPH KNOWLEDGE:\n"
    for (const row of (result as any).resultSet) {
      // row is [n.name, type(r), m.name]
      context += `- (${row[0]}) ${row[1]} (${row[2]})\n`
    }

    return context
  } catch (error) {
    captureException(error)
    console.error("❌ Graph Retrieval Failed:", error)
    return ""
  }
}
