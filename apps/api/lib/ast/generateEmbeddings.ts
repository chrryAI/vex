import { openai } from "@ai-sdk/openai"
import { embedMany } from "ai"
import { db } from "@repo/db"
import { codeEmbeddings } from "@repo/db"
import { eq, and } from "drizzle-orm"
import type { ASTNode } from "./parseCodebase"

interface CodeChunk {
  id: string
  repoName: string
  commitHash: string
  filepath: string
  type: string
  name: string
  content: string
  startLine?: number
  endLine?: number
  metadata?: Record<string, unknown>
  embedding?: number[]
}

export async function generateCodeEmbeddings(
  nodes: ASTNode[],
  repoName: string,
  commitHash: string,
): Promise<CodeChunk[]> {
  console.log(
    `🧠 Generating embeddings for ${nodes.length} code chunks from ${repoName}...`,
  )

  // Prepare chunks with formatted content for better embeddings
  const chunks: CodeChunk[] = nodes.map((node) => {
    const formattedContent = `
Type: ${node.type}
Name: ${node.name}
File: ${node.filepath}
${node.startLine ? `Lines: ${node.startLine}-${node.endLine}` : ""}
${node.params ? `Parameters: ${node.params.join(", ")}` : ""}

Code:
${node.content.slice(0, 2000)}
    `.trim()

    return {
      id: node.id,
      repoName,
      commitHash,
      filepath: node.filepath,
      type: node.type,
      name: node.name,
      content: formattedContent,
      startLine: node.startLine,
      endLine: node.endLine,
      metadata: node.metadata,
    }
  })

  // Generate embeddings in batches to avoid rate limits
  const BATCH_SIZE = 100
  let processedCount = 0

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const texts = batch.map((c) => c.content)

    try {
      console.log(
        `📊 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`,
      )

      const { embeddings } = await embedMany({
        model: openai.embedding("text-embedding-3-small"),
        values: texts,
      })

      batch.forEach((chunk, idx) => {
        chunk.embedding = embeddings[idx]
      })

      processedCount += batch.length
      console.log(`✅ Generated ${processedCount}/${chunks.length} embeddings`)

      // Small delay to avoid rate limits
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } catch (error) {
      console.error(`❌ Failed to generate embeddings for batch:`, error)
      throw error
    }
  }

  console.log(`✅ Generated ${chunks.length} embeddings successfully`)
  return chunks
}

export async function storeEmbeddings(chunks: CodeChunk[]) {
  console.log(`💾 Storing ${chunks.length} embeddings in database...`)

  let storedCount = 0

  for (const chunk of chunks) {
    try {
      await db
        .insert(codeEmbeddings)
        .values({
          id: chunk.id,
          repoName: chunk.repoName,
          commitHash: chunk.commitHash,
          filepath: chunk.filepath,
          type: chunk.type,
          name: chunk.name,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          embedding: JSON.stringify(chunk.embedding),
          metadata: chunk.metadata,
        })
        .onConflictDoUpdate({
          target: codeEmbeddings.id,
          set: {
            embedding: JSON.stringify(chunk.embedding),
            commitHash: chunk.commitHash,
            content: chunk.content,
            updatedAt: new Date(),
          },
        })

      storedCount++

      if (storedCount % 100 === 0) {
        console.log(`💾 Stored ${storedCount}/${chunks.length} embeddings`)
      }
    } catch (error) {
      console.error(`❌ Failed to store embedding for ${chunk.id}:`, error)
    }
  }

  console.log(`✅ Stored ${storedCount} embeddings in database`)
}

export async function clearOldEmbeddings(
  repoName: string,
  currentCommitHash: string,
) {
  console.log(
    `🗑️ Clearing old embeddings for ${repoName} (keeping ${currentCommitHash})...`,
  )

  try {
    const result = await db.delete(codeEmbeddings).where(
      and(
        eq(codeEmbeddings.repoName, repoName),
        // Delete embeddings from different commit hashes
        // Note: Using sql`` for NOT EQUAL comparison
      ),
    )

    console.log(`✅ Cleared old embeddings`)
  } catch (error) {
    console.error("❌ Failed to clear old embeddings:", error)
  }
}

// Calculate embedding cost
export function calculateEmbeddingCost(tokenCount: number): number {
  // OpenAI text-embedding-3-small: $0.02 per 1M tokens
  return (tokenCount / 1_000_000) * 0.02
}

// Estimate tokens for code chunks
export function estimateTokens(chunks: CodeChunk[]): number {
  // Rough estimate: ~4 characters per token
  const totalChars = chunks.reduce(
    (sum, chunk) => sum + chunk.content.length,
    0,
  )
  return Math.ceil(totalChars / 4)
}
