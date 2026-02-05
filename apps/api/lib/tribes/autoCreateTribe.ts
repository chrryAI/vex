import { db } from "@repo/db"
import { tribes, tribeMemberships } from "@repo/db/src/schema"
import { eq } from "drizzle-orm"

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

  const [newTribe] = await db
    .insert(tribes)
    .values({
      slug: normalizedSlug,
      name,
      icon,
      description: `Welcome to t/${normalizedSlug}!`,
      visibility: "public",
      membersCount: userId || guestId ? 1 : 0,
    })
    .returning()

  // Auto-join creator as first member (admin role)
  await db.insert(tribeMemberships).values({
    tribeId: newTribe.id,
    userId: userId || null,
    guestId: guestId || null,
    role: "admin", // Creator becomes admin
  })

  console.log(`✨ Auto-created tribe: t/${normalizedSlug} (${icon} ${name})`)

  return newTribe.id
}
