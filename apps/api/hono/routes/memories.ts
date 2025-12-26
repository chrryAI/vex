import { Hono } from "hono"
import { getMember, getGuest } from "../lib/auth"
import {
  getMemories,
  deleteMemory,
  getThreadSummaries,
  updateThreadSummary,
  getInstructions,
  deleteInstruction,
  getPlaceHolders,
  deletePlaceHolder,
} from "@repo/db"
import { isOwner } from "@repo/db"

export const memories = new Hono()

// GET /memories - Export all memories (GDPR Article 20 - Right to Data Portability)
memories.get("/", async (c) => {
  const member = await getMember(c, { full: true })
  const guest = member ? undefined : await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const memoriesData = await getMemories({
    userId: member?.id,
    guestId: guest?.id,
    pageSize: 100000,
  })

  // GDPR Article 20 - Right to Data Portability
  return c.json({
    exportedAt: new Date().toISOString(),
    userId: member?.id || guest?.id,
    memories: memoriesData.memories.filter((memory) =>
      isOwner(memory, {
        userId: member?.id,
        guestId: guest?.id,
      }),
    ),
  })
})

// DELETE /memories - Delete all memories (GDPR compliance)
memories.delete("/", async (c) => {
  const member = await getMember(c, { full: true })
  const guest = member ? undefined : await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const memoriesData = await getMemories({
    userId: member?.id,
    guestId: guest?.id,
    pageSize: 100000,
  })

  const instructionsData = await getInstructions({
    userId: member?.id,
    guestId: guest?.id,
    pageSize: 100000,
  })

  await Promise.all(
    instructionsData.map((instruction) =>
      deleteInstruction({ id: instruction.id }),
    ),
  )

  const paceholderData = await getPlaceHolders({
    userId: member?.id,
    guestId: guest?.id,
  })

  await Promise.all(
    paceholderData.map((placeholder) =>
      deletePlaceHolder({ id: placeholder.id }),
    ),
  )

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
    memoriesData.memories.map((memory) => deleteMemory({ id: memory.id })),
  )

  return c.json({ success: true })
})
