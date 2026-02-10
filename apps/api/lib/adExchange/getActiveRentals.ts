import { db, eq, and, gte, lte } from "@repo/db"
import { slotRentals, storeTimeSlots } from "@repo/db"
import { getApp as getAppDb } from "@repo/db"

/**
 * Get active slot rentals for a store at current time
 * Returns rented apps with rental metadata
 */
export async function getActiveRentalsForStore({
  storeId,
  userId,
  guestId,
}: {
  storeId: string
  userId?: string
  guestId?: string
}) {
  try {
    const now = new Date()

    // Get active rentals with manual join to avoid relations error
    const activeRentals = await db
      .select({
        rental: slotRentals,
        slot: storeTimeSlots,
      })
      .from(slotRentals)
      .innerJoin(storeTimeSlots, eq(slotRentals.slotId, storeTimeSlots.id))
      .where(
        and(
          eq(slotRentals.status, "active"),
          eq(storeTimeSlots.storeId, storeId),
          lte(slotRentals.startTime, now),
          gte(slotRentals.endTime, now),
        ),
      )

    if (activeRentals.length === 0) {
      return []
    }

    // Fetch full app details for each rented app
    const rentedApps = await Promise.all(
      activeRentals.map(async ({ rental }) => {
        const app = await getAppDb({
          id: rental.appId,
          userId,
          guestId,
          depth: 1,
          skipCache: true, // Don't cache rented apps
        })

        if (!app) return null

        // Add rental metadata to app
        return {
          ...app,
          _rental: {
            id: rental.id,
            startTime: rental.startTime,
            endTime: rental.endTime,
            durationHours: rental.durationHours,
            creditsCharged: rental.creditsCharged,
            priceEur: rental.priceEur,
            slotId: rental.slotId,
            campaignId: rental.campaignId,
            isRented: true, // Flag to identify rented apps
          },
        }
      }),
    )

    return rentedApps.filter(Boolean)
  } catch (error) {
    console.error("Failed to fetch active rentals:", error)
    return []
  }
}

/**
 * Check if a specific time slot is currently active
 */
export function isSlotActive(slot: {
  dayOfWeek: number
  startTime: string
  endTime: string
}): boolean {
  const now = new Date()
  const currentDay = now.getDay() // 0 = Sunday, 1 = Monday, etc.
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

  // Check if current day matches slot day
  if (currentDay !== slot.dayOfWeek) {
    return false
  }

  // Check if current time is within slot time range
  return currentTime >= slot.startTime && currentTime <= slot.endTime
}
