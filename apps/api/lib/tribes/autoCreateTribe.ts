import { db } from "@repo/db"
import { tribes, tribeMemberships } from "@repo/db/src/schema"
import { eq, sql } from "drizzle-orm"

interface AutoCreateTribeParams {
  slug: string
  userId?: string
  guestId?: string
}

export async function getOrCreateTribe(
  params: AutoCreateTribeParams,
): Promise<string> {
  const { slug, userId, guestId } = params

  // Validate exactly one identity is provided (XOR)
  const hasUserId = userId !== undefined && userId !== null
  const hasGuestId = guestId !== undefined && guestId !== null

  if (hasUserId && hasGuestId) {
    throw new Error("Cannot provide both userId and guestId")
  }
  if (!hasUserId && !hasGuestId) {
    throw new Error("Must provide either userId or guestId")
  }

  // Normalize slug (lowercase, replace spaces with hyphens)
  const normalizedSlug = slug.toLowerCase().trim().replace(/\s+/g, "-")

  // Check if tribe already exists
  const existingTribe = await db.query.tribes.findFirst({
    where: eq(tribes.slug, normalizedSlug),
  })

  if (existingTribe) {
    // Auto-join using transaction with conflict handling
    await db.transaction(async (tx) => {
      const insertResult = await tx
        .insert(tribeMemberships)
        .values({
          tribeId: existingTribe.id,
          userId: userId || null,
          guestId: guestId || null,
          role: "member",
        })
        .onConflictDoNothing({
          target: userId
            ? [tribeMemberships.tribeId, tribeMemberships.userId]
            : [tribeMemberships.tribeId, tribeMemberships.guestId],
        })
        .returning({ id: tribeMemberships.id })

      // Only increment count if a new row was inserted
      if (insertResult.length > 0) {
        await tx
          .update(tribes)
          .set({
            membersCount: existingTribe.membersCount + 1,
          })
          .where(eq(tribes.id, existingTribe.id))
      }
    })

    return existingTribe.id
  }

  // Auto-create new tribe
  const defaultIcons: Record<string, string> = {
    general: "💬",
    introductions: "👋",
    announcements: "📢",
    gaming: "🎮",
    tech: "💻",
    music: "🎵",
    art: "🎨",
    food: "🍕",
    sports: "⚽",
    movies: "🎬",
    books: "📚",
    travel: "✈️",
    fitness: "💪",
    coding: "👨‍💻",
    memes: "😂",
    news: "📰",
    science: "🔬",
    photography: "📷",
    fashion: "👗",
    pets: "🐶",
  }

  const icon = defaultIcons[normalizedSlug] || "🦞"
  const name =
    normalizedSlug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ") || "General"

  // Try to insert new tribe with conflict handling
  const insertResult = await db
    .insert(tribes)
    .values({
      slug: normalizedSlug,
      name,
      icon,
      description: `Welcome to t/${normalizedSlug}!`,
      visibility: "public",
      membersCount: 1, // Creator always joins
    })
    .onConflictDoNothing({ target: tribes.slug })
    .returning()

  // If insert failed due to conflict, query for existing tribe
  let tribeId: string
  let isCreator = false
  if (insertResult.length === 0) {
    const existingTribe = await db.query.tribes.findFirst({
      where: eq(tribes.slug, normalizedSlug),
    })
    if (!existingTribe) {
      throw new Error(`Failed to create or find tribe: ${normalizedSlug}`)
    }
    tribeId = existingTribe.id
    isCreator = false // Lost the race, join as member
  } else {
    tribeId = insertResult[0].id
    isCreator = true // Won the race, become admin
    console.log(`✨ Auto-created tribe: t/${normalizedSlug} (${icon} ${name})`)
  }

  // Auto-join creator as first member (admin if creator, member if race loser)
  await db
    .insert(tribeMemberships)
    .values({
      tribeId,
      userId: userId || null,
      guestId: guestId || null,
      role: isCreator ? "admin" : "member",
    })
    .onConflictDoNothing()

  // If we joined an existing tribe (race loser), increment membersCount
  if (!isCreator) {
    await db
      .update(tribes)
      .set({ membersCount: sql`${tribes.membersCount} + 1` })
      .where(eq(tribes.id, tribeId))
  }

  return tribeId
}
