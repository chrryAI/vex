import { NextRequest, NextResponse } from "next/server"
import { db } from "@repo/db"
import { messages, messageEmbeddings } from "@repo/db/src/schema"
import { eq, notInArray, sql } from "@repo/db"
import getMember from "../../actions/getMember"
import { processMessageForRAG } from "../../actions/ragService"

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated and is an admin
    const member = await getMember()

    // TODO: Replace with your actual admin check logic
    // This is a placeholder - you should implement proper admin role checking
    if (!member || member.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      )
    }

    console.log("🔄 Starting message embeddings backfill via API...")

    // Find messages that don't have embeddings yet
    const messagesWithoutEmbeddings = await db
      .select({
        id: messages.id,
        content: messages.content,
        threadId: messages.threadId,
        userId: messages.userId,
        guestId: messages.guestId,
        agentId: messages.agentId,
      })
      .from(messages)
      .where(
        notInArray(
          messages.id,
          db
            .select({ messageId: messageEmbeddings.messageId })
            .from(messageEmbeddings),
        ),
      )
      .limit(1000) // Process in batches to avoid timeouts

    console.log(
      `📊 Found ${messagesWithoutEmbeddings.length} messages without embeddings`,
    )

    if (messagesWithoutEmbeddings.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All messages already have embeddings!",
        processed: 0,
        errors: 0,
      })
    }

    let processed = 0
    let errors = 0
    const errorDetails: string[] = []

    for (const msg of messagesWithoutEmbeddings) {
      try {
        // Skip empty or very short messages
        if (!msg.content || msg.content.trim().length < 10) {
          continue
        }

        // Determine role based on whether it's from an agent
        const role = msg.agentId ? "assistant" : "user"

        await processMessageForRAG({
          messageId: msg.id,
          threadId: msg.threadId,
          userId: msg.userId || undefined,
          guestId: msg.guestId || undefined,
          content: msg.content,
          role,
        })

        processed++

        // Rate limiting to avoid overwhelming the embedding API
        if (processed % 10 === 0) {
          console.log(
            `📝 Processed ${processed}/${messagesWithoutEmbeddings.length} messages`,
          )
          // Small delay to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`❌ Failed to process message ${msg.id}:`, error)
        errors++
        errorDetails.push(
          `Message ${msg.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
        )
      }
    }

    console.log(
      `✅ Backfill complete! Processed: ${processed}, Errors: ${errors}`,
    )

    return NextResponse.json({
      success: true,
      message: "Message embeddings backfill completed",
      processed,
      errors,
      total: messagesWithoutEmbeddings.length,
      errorDetails: errors > 0 ? errorDetails : undefined,
    })
  } catch (error) {
    console.error("❌ Backfill API failed:", error)
    return NextResponse.json(
      {
        error: "Internal server error during backfill",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Placeholder admin check function - implement based on your auth system
async function checkIfUserIsAdmin(userId: string): Promise<boolean> {
  // TODO: Implement your actual admin check logic here
  // This could check a database table, user metadata, or external service

  // For now, return true for development - CHANGE THIS IN PRODUCTION
  console.log(`🔐 Admin check for user: ${userId}`)

  // Example implementations:
  // 1. Check user metadata in Clerk
  // 2. Check a database table for admin users
  // 3. Check environment variable for admin user IDs

  // Temporary development check - replace with real logic
  const adminUserIds = process.env.ADMIN_USER_IDS?.split(",") || []
  return adminUserIds.includes(userId)
}
