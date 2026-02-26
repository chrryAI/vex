import { createOpenAI } from "@ai-sdk/openai"
import type { appWithStore } from "@chrryai/chrry/types"
import {
  type app,
  db,
  desc,
  eq,
  getUser,
  isDevelopment,
  isE2E as isE2EInternal,
  sql,
  VEX_LIVE_FINGERPRINTS,
} from "@repo/db"
import {
  documentChunks,
  documentSummaries,
  messageEmbeddings,
} from "@repo/db/src/schema"
import { generateText } from "ai"
import { captureException } from "../../lib/captureException"
import {
  extractAndStoreKnowledge,
  getGraphContext,
  linkChunkToEntities,
  storeDocumentChunk,
} from "../../lib/graph/graphService"
import { getModelProvider } from "../getModelProvider"

const API_KEY = process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY

const _openaiProvider = createOpenAI({
  apiKey: API_KEY,
})

// Text chunking utility
export function chunkText(
  text: string,
  options = { maxSize: 1200, overlap: 150 },
): string[] {
  const { maxSize, overlap } = options
  const chunks: string[] = []

  const paragraphs = text.split(/\n\s*\n/)
  let currentChunk = ""

  for (const paragraph of paragraphs) {
    if (
      currentChunk.length + paragraph.length > maxSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim())
      const words = currentChunk.split(" ")
      const overlapWords = words.slice(-Math.floor(overlap / 6))
      currentChunk = `${overlapWords.join(" ")} ${paragraph}`
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter((chunk) => chunk.length > 50)
}

// Generate embeddings using OpenAI API
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.substring(0, 8000),
        encoding_format: "float",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `OpenAI Embeddings API error: ${response.status} - ${errorText}`,
      )
    }

    const data = await response.json()
    return data.data[0].embedding
  } catch (error) {
    console.error("❌ Error generating embedding:", error)
    captureException(error)
    throw error
  }
}

// Generate document summary
export async function generateDocumentSummary(
  content: string,
  filename: string,
  app?: app | appWithStore,
): Promise<{
  summary: string
  keyTopics: string[]
}> {
  try {
    const prompt = `Analyze this document and provide ONLY a valid JSON response:

Document: "${filename}"
Content: ${content.slice(0, 3000)}

Required JSON format:
{
  "summary": "2-3 sentence summary here",
  "keyTopics": ["topic1", "topic2", "topic3"]
}`

    const provider = await getModelProvider(app, "deepSeek")

    const result = await generateText({
      model: provider.provider,
      prompt,
      temperature: 0.1,
    })

    try {
      let cleanText = result.text.trim()
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/^```json\s*/, "").replace(/\s*```$/, "")
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```\s*/, "").replace(/\s*```$/, "")
      }

      const parsed = JSON.parse(cleanText)
      return {
        summary: parsed.summary || `Document: ${filename}`,
        keyTopics: Array.isArray(parsed.keyTopics)
          ? parsed.keyTopics.slice(0, 5)
          : [],
      }
    } catch (parseError) {
      console.warn(
        "⚠️ Failed to parse summary JSON, using fallback:",
        parseError,
      )
      return {
        summary: `Document: ${filename} (${Math.round(content.length / 1000)}k chars)`,
        keyTopics: [],
      }
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error generating document summary:", error)
    return {
      summary: `Document: ${filename}`,
      keyTopics: [],
    }
  }
}

// Process files for RAG
export async function processFileForRAG({
  content,
  filename,
  fileType,
  fileSizeBytes,
  messageId,
  threadId,
  userId,
  guestId,
  app,
}: {
  content: string
  filename: string
  fileType: string
  fileSizeBytes: number
  messageId: string
  threadId: string
  userId?: string
  guestId?: string
  app?: app | appWithStore
}): Promise<void> {
  console.log(
    `📚 Processing ${filename} for RAG (${Math.round(fileSizeBytes / 1024)}KB)...`,
  )

  try {
    // 1. Generate document summary
    const { summary, keyTopics } = await generateDocumentSummary(
      content,
      filename,
      app,
    )
    console.log(
      `📋 Generated summary for ${filename}:`,
      summary.substring(0, 100),
    )

    // 2. Chunk the content
    const chunks = chunkText(content, { maxSize: 1200, overlap: 150 })
    console.log(`📄 Split ${filename} into ${chunks.length} chunks`)

    // 3. Generate embeddings for chunks
    const chunksWithEmbeddings: Array<{
      messageId: string
      threadId: string
      userId: string | null
      guestId: string | null
      content: string
      chunkIndex: number
      filename: string
      fileType: string
      embedding: number[]
      metadata: any
      tokenCount: number
    }> = []
    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunk = chunks[i]
        if (!chunk) continue
        const embedding = await generateEmbedding(chunk)

        chunksWithEmbeddings.push({
          messageId,
          threadId,
          userId: userId || null,
          guestId: guestId || null,
          content: chunk,
          chunkIndex: i,
          filename,
          fileType,
          embedding,
          metadata: {
            filename,
            chunkIndex: i,
            totalChunks: chunks.length,
            chunkLength: chunk?.length || 0,
          },
          tokenCount: Math.ceil(chunk.length / 4),
        })

        // 3b. SYNC TO FALKORDB (Graph RAG)
        // We do this in parallel or background to not block legacy flow
        storeDocumentChunk(filename, i, chunk, embedding, threadId, fileType)
          .then(() => {
            // Level 4: Entity Linking (God Mode)
            // Extract topics from chunk and link to Graph entities
            return linkChunkToEntities({
              content: chunk,
              filename,
              chunkIndex: i,
              app,
            })
          })
          .catch((err) => console.error("⚠️ Graph Sync/Linking Error:", err))

        // Rate limiting
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (embeddingError) {
        captureException(embeddingError)
        console.error(
          `❌ Failed to generate embedding for chunk ${i}:`,
          embeddingError,
        )
      }
    }

    console.log(
      `🔢 Generated embeddings for ${chunksWithEmbeddings.length}/${chunks.length} chunks`,
    )

    // 4. Store in database
    await db.transaction(async (tx) => {
      // Verify message exists before creating summary
      const messageExists = await tx.execute(sql`
        SELECT id FROM messages WHERE id = ${messageId} LIMIT 1
      `)

      if (!messageExists || messageExists.length === 0) {
        console.warn(
          `⚠️ Message ${messageId} not found, skipping document summary creation`,
        )
        return
      }

      // Store document summary
      await tx.insert(documentSummaries).values({
        messageId,
        threadId,
        filename,
        fileType,
        fileSizeBytes,
        summary,
        keyTopics,
        totalChunks: chunksWithEmbeddings.length,
      })

      // Store chunks in batches
      if (chunksWithEmbeddings.length > 0) {
        for (let i = 0; i < chunksWithEmbeddings.length; i += 10) {
          const batch = chunksWithEmbeddings.slice(i, i + 10)
          await tx.insert(documentChunks).values(batch)
        }
      }
    })

    console.log(
      `✅ Successfully stored ${filename} - ${chunksWithEmbeddings.length} chunks in RAG database`,
    )
  } catch (error) {
    captureException(error)
    console.error(`❌ Failed to process ${filename} for RAG:`, error)
    throw error
  }
}

// Vector similarity search using pgvector
export async function findRelevantChunks({
  query,
  threadId,
  limit = 5,
  threshold = 0.75,
}: {
  query: string
  threadId: string
  limit?: number
  threshold?: number
}): Promise<
  Array<{
    content: string
    filename: string
    chunkIndex: number
    similarity: number
    metadata: any
  }>
> {
  try {
    console.log(
      `🔍 Searching for content relevant to: "${query.substring(0, 50)}..."`,
    )

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query)

    // Use raw SQL for vector similarity search with pgvector
    // CRITICAL: Use raw operator in ORDER BY for index usage (HNSW/IVFFlat)
    const thresholdDistance = 1 - threshold // Convert similarity to distance
    const relevantChunks = await db.execute(sql`
      SELECT 
        content,
        filename,
        "chunkIndex",
        metadata,
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM document_chunks 
      WHERE "threadId" = ${threadId}
        AND embedding <=> ${JSON.stringify(queryEmbedding)}::vector < ${thresholdDistance}
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector ASC
      LIMIT ${limit}
    `)

    const results = relevantChunks.map((row: any) => ({
      content: row.content,
      filename: row.filename,
      chunkIndex: row.chunkIndex,
      similarity: row.similarity,
      metadata: row.metadata,
    }))

    console.log(
      `📊 Found ${results.length} relevant chunks (threshold: ${threshold})`,
    )
    return results
  } catch (error) {
    captureException(error)
    console.error("❌ Error in vector similarity search:", error)
    return []
  }
}

// Get document summaries for a thread
export async function getDocumentSummaries(threadId: string) {
  try {
    const summaries = await db
      .select()
      .from(documentSummaries)
      .where(eq(documentSummaries.threadId, threadId))
      .orderBy(desc(documentSummaries.createdOn))

    console.log(`📚 Found ${summaries.length} documents in thread ${threadId}`)
    return summaries
  } catch (error) {
    console.error("❌ Error fetching document summaries:", error)
    return []
  }
}

// Build RAG context for AI
export async function buildRAGContext(
  query: string,
  threadId: string,
): Promise<string> {
  const [relevantChunks, documentSummaries] = await Promise.all([
    findRelevantChunks({ query, threadId, limit: 3, threshold: 0.7 }),
    getDocumentSummaries(threadId),
  ])

  let context = ""

  // Add document summaries for broad context
  if (documentSummaries.length > 0) {
    context += "\n\n📚 AVAILABLE DOCUMENTS:\n"
    documentSummaries.forEach((doc) => {
      context += `• ${doc.filename}: ${doc.summary}\n`
    })
  }

  // Add relevant chunks for specific information
  if (relevantChunks.length > 0) {
    context += "\n\n🔍 RELEVANT INFORMATION:\n"
    relevantChunks.forEach((chunk) => {
      context += `[${chunk.filename}] ${chunk.content}\n\n`
    })
  }

  return context
}

// Process message for semantic search (called after message creation)
export async function processMessageForRAG({
  messageId,
  threadId,
  userId,
  guestId,
  content,
  role,
  app,
}: {
  messageId: string
  threadId: string
  userId?: string
  guestId?: string
  content: string
  role: "user" | "assistant"
  app?: app | appWithStore
}): Promise<void> {
  try {
    // Skip only empty messages
    if (!content || content.trim().length === 0) {
      console.log("⏭️ Skipping message - empty")
      return
    }

    const member = userId
      ? await getUser({
          id: userId,
        })
      : undefined

    const isE2E =
      member?.role !== "admin" &&
      member?.fingerprint &&
      !VEX_LIVE_FINGERPRINTS.includes(member?.fingerprint) &&
      isE2EInternal

    // Only log content in E2E/dev mode for debugging (privacy)
    console.log(`📝 Processing ${role} message for RAG:`, {
      messageId,
      threadId,
      contentLength: content.length,
      hasApp: !!app,
      appId: app?.id,
      ...((isE2E || isDevelopment) && {
        contentPreview: `${content.substring(0, 250)}...`,
      }), // Redacted preview ❤️ 🐰
    })

    // Generate embedding for the message
    console.log("🔢 Generating embedding...")
    const embedding = await generateEmbedding(content)
    console.log("✅ Embedding generated:", embedding.length, "dimensions")

    // Store message embedding
    await db.insert(messageEmbeddings).values({
      messageId,
      threadId,
      userId: userId || null,
      guestId: guestId || null,
      content,
      role,
      embedding,
      metadata: {
        length: content.length,
        timestamp: new Date().toISOString(),
      },
      tokenCount: Math.ceil(content.length / 4),
    })

    console.log(
      `📝 Processed message for RAG: ${isE2E || isDevelopment ? `${content.substring(0, 50)}...` : "[content hidden]"}`,
    )

    // Extract and Store Knowledge Graph Data
    if (process.env.ENABLE_GRAPH_RAG === "true") {
      extractAndStoreKnowledge(content, userId || guestId, app).catch((err) => {
        console.error("Failed to extract knowledge graph:", err)
      })
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error processing message for RAG:", error)
    // Don't throw - message processing should continue even if RAG fails
  }
}

// Find semantically similar messages from conversation history
export async function findRelevantMessages({
  query,
  threadId,
  userId,
  guestId,
  limit = 5,
  threshold = 0.75,
  excludeMessageId,
}: {
  query: string
  threadId: string
  userId?: string
  guestId?: string
  limit?: number
  threshold?: number
  excludeMessageId?: string
}): Promise<
  Array<{
    messageId: string
    content: string
    role: string
    similarity: number
    metadata: any
    createdOn: Date
  }>
> {
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query)

    // Search for similar messages using pgvector
    // CRITICAL: Use raw operator in ORDER BY for index usage (HNSW/IVFFlat)
    const thresholdDistance = 1 - threshold // Convert similarity to distance
    const relevantMessages = await db.execute(sql`
      SELECT 
        "messageId",
        content,
        role,
        metadata,
        "createdOn",
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM message_embeddings 
      WHERE "threadId" = ${threadId}
        AND embedding <=> ${JSON.stringify(queryEmbedding)}::vector < ${thresholdDistance}
        ${excludeMessageId ? sql`AND "messageId" != ${excludeMessageId}` : sql``}
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector ASC
      LIMIT ${limit}
    `)

    const results = relevantMessages.map((row: any) => ({
      messageId: row.messageId,
      content: row.content,
      role: row.role,
      similarity: row.similarity,
      metadata: row.metadata,
      createdOn: row.createdOn,
    }))

    console.log(
      `🔍 Found ${results.length} relevant messages for: "${query.substring(0, 50)}..."`,
    )
    return results
  } catch (error) {
    captureException(error)
    console.error("❌ Error finding relevant messages:", error)
    return []
  }
}

// Enhanced context builder that combines documents + message history
export async function buildEnhancedRAGContext({
  query,
  threadId,
  excludeMessageId,
  app,
}: {
  query: string
  threadId: string
  excludeMessageId?: string
  app?: app | appWithStore
}): Promise<string> {
  const [relevantChunks, documentSummaries, relevantMessages, graphContext] =
    await Promise.all([
      findRelevantChunks({ query, threadId, limit: 3, threshold: 0.7 }),
      getDocumentSummaries(threadId),
      findRelevantMessages({
        query,
        threadId,
        limit: 3,
        threshold: 0.7,
        excludeMessageId,
      }),
      // Graph Retrieval - Only if enabled
      process.env.ENABLE_GRAPH_RAG === "true"
        ? getGraphContext(query, app).catch((err) => {
            console.error("Failed to get graph context:", err)
            return ""
          })
        : Promise.resolve(""),
    ])

  let context = ""

  // Add Graph Context (FalkorDB)
  if (graphContext) {
    context += `\n${graphContext}\n`
  }

  // Add document summaries for broad context
  if (documentSummaries.length > 0) {
    context += "\n\n📚 AVAILABLE DOCUMENTS:\n"
    documentSummaries.forEach((doc) => {
      context += `• ${doc.filename}: ${doc.summary}\n`
    })
  }

  // Add relevant document chunks
  if (relevantChunks.length > 0) {
    context += "\n\n🔍 RELEVANT DOCUMENT INFORMATION:\n"
    relevantChunks.forEach((chunk) => {
      context += `[${chunk.filename}] ${chunk.content}\n\n`
    })
  }

  // Add relevant past messages
  if (relevantMessages.length > 0) {
    context += "\n\n💬 RELEVANT PAST CONVERSATION:\n"
    relevantMessages.forEach((msg) => {
      const timeAgo = new Date(msg.createdOn).toLocaleDateString()
      context += `[${timeAgo}] ${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n\n`
    })
  }

  return context
}
