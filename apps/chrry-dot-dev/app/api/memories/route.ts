import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { NextResponse } from "next/server"
import {
  getMemories,
  deleteMemory,
  getThreadSummaries,
  updateThreadSummary,
} from "@repo/db"

export async function GET() {
  const member = await getMember(true)
  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const memories = await getMemories({
    userId: member?.id,
    guestId: guest?.id,
    pageSize: 100000,
  })

  // GDPR Article 20 - Right to Data Portability
  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    userId: member?.id || guest?.id,
    memories: memories.memories,
  })
}

export async function DELETE() {
  const member = await getMember(true)
  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const memories = await getMemories({
    userId: member?.id,
    guestId: guest?.id,
    pageSize: 100000,
  })

  const threadSummaries = await getThreadSummaries({
    userId: member?.id,
    guestId: guest?.id,
    pageSize: 100000,
    hasMemories: true,
  })

  await Promise.all(
    threadSummaries.threadSummaries.map((threadSummary) =>
      updateThreadSummary({
        ...threadSummary,
        userMemories: null,
      }),
    ),
  )

  await Promise.all(
    memories.memories.map((memory) => deleteMemory({ id: memory.id })),
  )

  return NextResponse.json({ success: true })
}
