import { NextRequest, NextResponse } from "next/server"
import getMember from "../../../actions/getMember"
import getGuest from "../../../actions/getGuest"
import { createAppOrder, installApp, getInstall, db, and, eq } from "@repo/db"
import { appOrders, storeInstalls, apps } from "@repo/db/src/schema"
import captureException from "../../../../lib/captureException"

interface ReorderItem {
  appId: string
  order: number
  autoInstall?: boolean // If true, install app if not already installed
  storeId?: string // Optional: order within specific store context
}

interface ReorderRequest {
  apps: ReorderItem[]
  storeId?: string // Optional: apply ordering to specific store
}

export async function POST(request: NextRequest) {
  try {
    const member = await getMember()
    const guest = await getGuest()

    if (!member && !guest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as ReorderRequest

    if (!body.apps || !Array.isArray(body.apps)) {
      return NextResponse.json(
        { error: "Invalid request: apps array required" },
        { status: 400 },
      )
    }

    // Validate each item
    for (const item of body.apps) {
      if (!item.appId || typeof item.order !== "number") {
        return NextResponse.json(
          { error: "Invalid request: each app must have appId and order" },
          { status: 400 },
        )
      }
    }

    const storeId = body.storeId

    console.log("🔄 Reordering apps:", {
      userId: member?.id,
      guestId: guest?.id,
      storeId,
      appsCount: body.apps.length,
    })

    // Process each app
    const results = {
      updated: 0,
      created: 0,
      installed: 0,
      storeUpdated: 0,
      skipped: 0,
      errors: [] as string[],
    }

    for (const item of body.apps) {
      try {
        const itemStoreId = item.storeId || storeId

        // Check if app order already exists
        const conditions = [
          eq(appOrders.appId, item.appId),
          itemStoreId ? eq(appOrders.storeId, itemStoreId) : undefined,
          member?.id ? eq(appOrders.userId, member.id) : undefined,
          guest?.id ? eq(appOrders.guestId, guest.id) : undefined,
        ].filter(Boolean)

        const [existingOrder] = await db
          .select()
          .from(appOrders)
          .where(and(...conditions))
          .limit(1)

        if (existingOrder) {
          // Update existing order
          console.log(
            `✏️  Updating order for app: ${item.appId} (${existingOrder.order} → ${item.order})`,
          )
          await db
            .update(appOrders)
            .set({
              order: item.order,
              updatedOn: new Date(),
            })
            .where(and(...conditions))
          results.updated++
        } else {
          // Create new order
          console.log(
            `➕ Creating order for app: ${item.appId} (order: ${item.order})`,
          )
          await createAppOrder({
            appId: item.appId,
            storeId: itemStoreId || null,
            userId: member?.id || null,
            guestId: guest?.id || null,
            order: item.order,
          })
          results.created++
        }

        // If user owns the app and storeId is provided, also update storeInstalls.displayOrder
        if (itemStoreId && member?.id) {
          // Check if user owns this app
          const [appOwnership] = await db
            .select()
            .from(apps)
            .where(and(eq(apps.id, item.appId), eq(apps.userId, member.id)))
            .limit(1)

          if (appOwnership) {
            // User owns this app, update store-level display order
            const [storeInstall] = await db
              .select()
              .from(storeInstalls)
              .where(
                and(
                  eq(storeInstalls.appId, item.appId),
                  eq(storeInstalls.storeId, itemStoreId),
                ),
              )
              .limit(1)

            if (storeInstall) {
              console.log(
                `🏪 Updating store display order for app: ${item.appId} (${storeInstall.displayOrder} → ${item.order})`,
              )
              await db
                .update(storeInstalls)
                .set({
                  displayOrder: item.order,
                  updatedOn: new Date(),
                })
                .where(
                  and(
                    eq(storeInstalls.appId, item.appId),
                    eq(storeInstalls.storeId, itemStoreId),
                  ),
                )
              results.storeUpdated++
            }
          }
        }

        // Handle auto-install if requested
        if (item.autoInstall) {
          const existingInstall = await getInstall({
            appId: item.appId,
            userId: member?.id,
            guestId: guest?.id,
          })

          if (!existingInstall) {
            console.log(`📦 Auto-installing app: ${item.appId}`)
            await installApp({
              appId: item.appId,
              userId: member?.id,
              guestId: guest?.id,
            })
            results.installed++
          }
        }
      } catch (error) {
        // Sanitize appId for logging
        const safeAppId = String(item.appId).replace(/[^\w-]/g, "_")
        console.error(`❌ Error processing app ${safeAppId}:`, error)
        results.errors.push(`Failed to process app ${safeAppId}`)
      }
    }

    console.log("✅ Reorder complete:", results)

    // Build success message
    const messages = []
    if (results.updated > 0)
      messages.push(
        `Updated ${results.updated} app${results.updated > 1 ? "s" : ""}`,
      )
    if (results.created > 0)
      messages.push(
        `created ${results.created} app${results.created > 1 ? "s" : ""}`,
      )
    if (results.installed > 0)
      messages.push(
        `installed ${results.installed} app${results.installed > 1 ? "s" : ""}`,
      )

    const message = messages.length > 0 ? messages.join(", ") : "No changes"

    return NextResponse.json(
      {
        success: true,
        message,
        results,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error reordering apps:", error)
    captureException(error)
    return NextResponse.json(
      { error: "Failed to reorder apps" },
      { status: 500 },
    )
  }
}
