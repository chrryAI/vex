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

  // Normalize slug (lowercase, replace spaces with hyphens)
  const normalizedSlug = slug.toLowerCase().trim().replace(/\s+/g, "-")

  // Check if tribe already exists
  const existingTribe = await db.query.tribes.findFirst({
    where: eq(tribes.slug, normalizedSlug),
  })

  if (existingTribe) {
    // Check if user is already a member
    if (userId || guestId) {
      const existingMembership = await db.query.tribeMemberships.findFirst({
        where: (memberships, { and, eq }) =>
          and(
            eq(memberships.tribeId, existingTribe.id),
            userId
              ? eq(memberships.userId, userId)
              : eq(memberships.guestId, guestId!),
          ),
      })

      // Auto-join if not already a member
      if (!existingMembership) {
        await db.insert(tribeMemberships).values({
          tribeId: existingTribe.id,
          userId: userId || null,
          guestId: guestId || null,
          role: "member",
        })

        // Increment members count
        await db
          .update(tribes)
          .set({
            membersCount: existingTribe.membersCount + 1,
          })
          .where(eq(tribes.id, existingTribe.id))
      }
    }

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

  // Auto-join creator as first member
  if (userId || guestId) {
    await db.insert(tribeMemberships).values({
      tribeId: newTribe.id,
      userId: userId || null,
      guestId: guestId || null,
      role: "admin", // Creator becomes admin
    })
  }

  console.log(`✨ Auto-created tribe: t/${normalizedSlug} (${icon} ${name})`)

  return newTribe.id
}
