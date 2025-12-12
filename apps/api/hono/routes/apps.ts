/* eslint-disable @typescript-eslint/no-unused-expressions */
import { Hono } from "hono"
import { getApp, getApp as getAppDb, getApps, getStore } from "@repo/db"
import { apps } from "@repo/db/src/schema"
import { getMember, getGuest } from "../lib/auth"
import { getChrryUrl } from "../lib/getChrryUrl"
import { getSiteConfig, whiteLabels } from "@chrryai/chrry/utils/siteConfig"
import { getAppAndStoreSlugs } from "@chrryai/chrry/utils/url"
import { appWithStore } from "@chrryai/chrry/types"
import { appSchema } from "@chrryai/chrry/schemas/appSchema"

import {
  installApp,
  createStore,
  createStoreInstall,
  updateStore,
  createOrUpdateApp,
  createAppOrder,
  getInstall,
  db,
  and,
  eq,
} from "@repo/db"
import { appOrders, storeInstalls } from "@repo/db/src/schema"
import captureException from "../../lib/captureException"
import { upload, deleteFile } from "../../lib/minio"
import slugify from "slug"
import { v4 as uuid } from "uuid"
import { reorderApps } from "@chrryai/chrry/lib"

export const app = new Hono()

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

// GET /apps - Intelligent app resolution (no ID)
app.get("/", async (c) => {
  const request = c.req.raw

  const member = await getMember(c, { full: true, skipCache: true })
  const guest = !member ? await getGuest(c, { skipCache: true }) : undefined

  // Get query parameters
  const appIdParam = c.req.query("appId")
  const appSlugParam = c.req.query("appSlug")
  const storeSlugParam = c.req.query("storeSlug")
  const chrryUrlParam = c.req.query("chrryUrl")

  const pathnameParam = c.req.query("pathname")

  // Get headers
  const appIdHeader = request.headers.get("x-app-id")
  const storeSlugHeader = request.headers.get("x-app-slug")

  const pathnameHeader = request.headers.get("x-pathname")

  const storeSlug = storeSlugParam || storeSlugHeader || undefined

  const pathname =
    (pathnameParam
      ? decodeURIComponent(pathnameParam)
      : pathnameHeader || "/"
    ).split("?")[0] || "/"
  const appId = appIdParam || appIdHeader || undefined

  // Get store from header if provided
  const storeFromHeader = storeSlug
    ? await getStore({
        slug: storeSlug,
        userId: member?.id,
        guestId: guest?.id,
        depth: 1,
      })
    : null

  // Get chrryUrl
  const chrryUrl = chrryUrlParam || (await getChrryUrl(request))
  const siteConfig = getSiteConfig(chrryUrl)

  // Get site app
  const siteApp = await getAppDb({
    slug: siteConfig.slug,
    storeSlug: siteConfig.storeSlug,
  })

  // Get chrry store
  const chrryStore = await getStore({
    domain: siteConfig.store,
    userId: member?.id,
    guestId: guest?.id,
    depth: 1,
  })

  // Parse app/store slugs from pathname
  let { appSlug: appSlugGenerated, storeSlug: storeSlugGenerated } =
    getAppAndStoreSlugs(pathname, {
      defaultAppSlug: siteConfig.slug,
      defaultStoreSlug: siteConfig.storeSlug,
    })

  // Override with params if provided
  if (appSlugParam) appSlugGenerated = appSlugParam
  if (storeSlugParam) storeSlugGenerated = storeSlugParam

  // Check white label
  const whiteLabel = whiteLabels.find(
    (label) => label.slug === appSlugGenerated && label.isStoreApp,
  )
  if (whiteLabel) {
    storeSlugGenerated = whiteLabel.storeSlug
  }

  // Resolve app (priority: appId > storeFromHeader > slug)
  const appInternal = appId
    ? await getAppDb({
        id: appId,
        userId: member?.id,
        guestId: guest?.id,
        depth: 1,
      })
    : storeFromHeader?.store?.appId
      ? await getAppDb({
          id: storeFromHeader.store.appId,
          userId: member?.id,
          guestId: guest?.id,
          depth: 1,
        })
      : await getAppDb({
          slug: appSlugGenerated,
          storeSlug: storeSlugGenerated,
          userId: member?.id,
          guestId: guest?.id,
          depth: 1,
        })

  const store = appInternal?.store || chrryStore

  // Find base app
  const baseApp =
    store?.apps?.find(
      (app) =>
        app.slug === siteConfig.slug &&
        app.store?.slug === siteConfig.storeSlug,
    ) || store?.app

  // Get final app
  const app =
    appInternal ||
    (await getAppDb({
      id: baseApp?.id,
      userId: member?.id,
      guestId: guest?.id,
      depth: 1,
    }))

  if (!app) {
    return c.json({ error: "App not found" }, 404)
  }

  // Enrich store.apps with store.app references
  if (app?.store?.apps?.length) {
    const currentStoreApps = app.store.apps || []
    const storeApps = [...currentStoreApps]

    const enrichedApps = await Promise.all(
      storeApps.map(async (storeApp) => {
        if (!storeApp) return null

        const isBaseApp = storeApp?.id === storeApp?.store?.appId

        let storeBaseApp: appWithStore | null = null
        if (isBaseApp) {
          storeBaseApp =
            (await getAppDb({
              id: storeApp?.id,
              userId: member?.id,
              guestId: guest?.id,
              depth: 1,
            })) || null
        } else if (storeApp?.store?.appId) {
          const baseAppData = await getAppDb({
            id: storeApp.store.appId,
            userId: member?.id,
            guestId: guest?.id,
            depth: 0,
          })
          storeBaseApp = baseAppData ?? null
        }

        return {
          ...storeApp,
          store: {
            ...storeApp?.store,
            app: storeBaseApp,
          },
        } as appWithStore
      }),
    )

    const validApps = enrichedApps.filter(Boolean) as appWithStore[]
    app.store.apps = validApps
  }

  // Add site app if not already in list
  if (
    app &&
    siteApp &&
    app.store?.apps &&
    !app.store.apps.some((a) => a.id === siteApp.id)
  ) {
    app.store.apps.push(siteApp)
  }

  return c.json(app)
})

// GET /apps/:id - Get single app by ID
app.get("/:id", async (c) => {
  const id = c.req.param("id")

  const member = await getMember(c, { full: true, skipCache: true })
  const guest = !member ? await getGuest(c, { skipCache: true }) : undefined

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const app = await getAppDb({
    id,
    userId: member?.id,
    guestId: guest?.id,
    depth: 1,
  })

  if (!app) {
    return c.json({ error: "App not found" }, 404)
  }

  return c.json(app)
})

app.post("/", async (c) => {
  try {
    const member = await getMember(c)

    if (!member) {
      return c.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse JSON body
    const body = await c.req.json()
    // console.log("📦 Received app data:", JSON.stringify(body, null, 2))

    // Extract fields from JSON
    const {
      name,
      title,
      description,
      icon,
      systemPrompt,
      tone,
      language,
      defaultModel,
      temperature,
      visibility,
      themeColor,
      backgroundColor,
      displayMode,
      pricing,
      price,
      currency,
      subscriptionInterval,
      apiEnabled,
      apiPricing,
      apiPricePerRequest,
      apiMonthlyPrice,
      apiRateLimit,
      capabilities,
      highlights,
      tags,
      tools,
      extends: extendsData,
      image: imageUrl,
      apiKeys,
      tips,
    } = body

    const guest = await getGuest(c)

    // Validate app name: no spaces, must be unique
    if (!name || typeof name !== "string") {
      return c.json({ error: "App name is required" }, { status: 400 })
    }

    if (name.includes(" ")) {
      return c.json(
        {
          error:
            "App name cannot contain spaces. Use hyphens or camelCase instead.",
        },
        { status: 400 },
      )
    }

    // Check if app name is unique for this user/guest
    const existingApps = await getApps({
      userId: member?.id,
      guestId: guest?.id,
    })

    const nameExists = existingApps.items.some(
      (app) => app.name.toLowerCase() === name.toLowerCase(),
    )

    if (nameExists) {
      return c.json(
        {
          error: `An app with the name "${name}" already exists. Please choose a different name.`,
        },
        { status: 400 },
      )
    }

    // Get or create user's store

    // Handle image - accept URL from /api/image endpoint

    // Build the data object for validation
    // Schema will sanitize via sanitizedString helper
    const appData = {
      name,
      title,
      description: description || undefined,
      icon: icon || undefined,
      systemPrompt: systemPrompt || undefined,
      tone: tone || undefined,
      language: language || undefined,
      defaultModel: defaultModel || undefined,
      temperature,
      capabilities,
      highlights,
      tips,
      tags,
      tools,
      extends: extendsData,
      visibility: visibility || undefined,
      themeColor: themeColor || undefined,
      backgroundColor: backgroundColor || undefined,
      displayMode: displayMode || undefined,
      pricing: pricing || undefined,
      price,
      currency: currency || undefined,
      subscriptionInterval: subscriptionInterval || undefined,
      apiEnabled,
      apiPricing: apiPricing || undefined,
      apiPricePerRequest,
      apiMonthlyPrice,
      apiRateLimit,
    }

    const chrry = await getStore({
      parentStoreId: null,
    })

    if (!chrry) {
      return c.json({ error: "Chrry store not found" }, { status: 404 })
    }

    // Validate with Zod schema
    console.log("🔍 Validating app data:", appData)
    const validationResult = appSchema.safeParse(appData)

    if (!validationResult.success) {
      console.error("❌ Validation failed:", validationResult.error.format())
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.format(),
        },
        { status: 400 },
      )
    }

    if (!validationResult?.data?.extends?.length) {
      return c.json(
        { error: "1 You must provide at least one extended app" },
        { status: 400 },
      )
    }

    let subjectStore = member
      ? await getStore({
          slug: member?.userName,
        })
      : guest
        ? await getStore({
            slug: guest?.id,
          })
        : undefined

    const extendedApps = validationResult?.data.extends
      ? (
          await Promise.all(
            validationResult?.data.extends.map(async (extendedAppId) => {
              console.log("🔍 Looking up extended app:", extendedAppId)

              // Try to look up by ID first (handles UUIDs)

              return await getApp({
                id: extendedAppId,
              })
            }),
          )
        ).filter(Boolean)
      : []

    if (!extendedApps.length) {
      return c.json(
        { error: "You must provide at least one extended app" },
        { status: 400 },
      )
    }

    console.log(
      "✅ Validation passed",
      extendedApps.map((app) => app?.name),
    )

    let images: Array<{
      url: string
      width?: number
      height?: number
      id: string
    }> = []
    if (imageUrl && imageUrl.startsWith("http")) {
      try {
        console.log("📸 Processing app image from URL:", imageUrl)

        // Validate URL to prevent SSRF attacks
        const parsedUrl = new URL(imageUrl)
        const ALLOWED_HOSTNAMES = [
          "utfs.io",
          "uploadthing.com",
          "images.unsplash.com",
          "cdn.jsdelivr.net",
        ]
        const isAllowed = ALLOWED_HOSTNAMES.some(
          (hostname) =>
            parsedUrl.hostname === hostname ||
            parsedUrl.hostname.endsWith(`.${hostname}`),
        )
        if (!isAllowed) {
          throw new Error(`Image host not allowed: ${parsedUrl.hostname}`)
        }

        // Generate optimized versions for all use cases
        const versions = [
          { size: 512, name: "large" }, // PWA icon (required)
          { size: 192, name: "medium" }, // PWA icon (required)
          { size: 180, name: "apple" }, // Apple touch icon
          { size: 128, name: "small" }, // UI thumbnails
          { size: 32, name: "favicon" }, // Browser favicon
        ]

        const uploadPromises = versions.map(async ({ size, name }) => {
          const result = await upload({
            url: imageUrl,
            messageId: `${slugify(name)}-${Date.now()}`,
            options: {
              width: size,
              height: size,
              fit: "contain", // Center image, don't crop (adds padding if needed)
              position: "center",
              title: `${name}-${size}x${size}`,
            },
            context: "apps", // Use apps UploadThing account
          })
          return {
            url: result.url,
            width: size,
            height: size,
            id: uuid(),
          }
        })

        images = await Promise.all(uploadPromises)

        console.log("✅ Generated image versions:", {
          large: images[0]?.url,
          medium: images[1]?.url,
          favicon: images[2]?.url,
        })

        // Delete temporary image from /api/image
        try {
          await deleteFile(imageUrl)
          console.log("🗑️ Deleted temporary image:", imageUrl)
        } catch (deleteError) {
          console.error("⚠️ Failed to delete temp image:", deleteError)
          // Continue anyway - not critical
        }
      } catch (uploadError) {
        console.error("❌ Image processing failed:", uploadError)
        // Continue without image
      }
    }

    if (!subjectStore) {
      // Create a new store for the user
      let storeSlug = member
        ? member.userName
          ? slugify(member.userName)
          : member.id
        : guest
          ? `${guest.id}`
          : `${uuid()}`

      console.log(`🏪 Creating new store with slug: ${storeSlug}`)

      // Check if slug is already taken (race condition protection)
      const existingStore = await getStore({ slug: storeSlug })
      if (existingStore) {
        // Slug taken, append UUID to make it unique
        storeSlug = `${storeSlug}-${uuid().slice(0, 8)}`
        console.log(`⚠️ Store slug taken, using: ${storeSlug}`)
      }

      const created = await createStore({
        slug: storeSlug,
        name: member?.userName || `Guest Store`,
        title: `${member?.userName + "'s" || "My"} Store`,
        // domain: `${storeSlug}.chrry.dev`,
        userId: member?.id,
        guestId: guest?.id,
        parentStoreId: chrry.store.id,
        visibility: "private",
        description: `Personal app store for ${member?.userName || "guest user"}`,
      })

      if (!created) {
        return c.json({ error: "Failed to create user store" }, { status: 500 })
      }

      subjectStore = await getStore({
        id: created.id,
        userId: member?.id,
        guestId: guest?.id,
      })

      if (!subjectStore) {
        return c.json({ error: "Failed to create user store" }, { status: 500 })
      }

      console.log(`✅ Store created: ${subjectStore.store.slug}`)
    }

    if (!subjectStore) {
      return c.json({ error: "Failed to create user store" }, { status: 500 })
    }

    const id = uuid()
    let appSlug = slugify(name, { lower: true })

    // Check if slug is unique within the store
    const existingAppInStore = await getApp({
      userId: member?.id,
      guestId: guest?.id,
      slug: appSlug,
    })

    if (
      existingAppInStore &&
      existingAppInStore?.store?.id === subjectStore?.store.id
    ) {
      // Slug already exists in this store, append UUID to make it unique
      appSlug = `${appSlug}-${uuid().slice(0, 8)}`
      console.log(`⚠️ App slug taken in store, using: ${appSlug}`)
    }

    // Create the app in the database
    const newApp = await createOrUpdateApp({
      app: {
        id,
        slug: appSlug,
        storeId: subjectStore.store.id,
        userId: member?.id,
        guestId: guest?.id,
        ...validationResult.data,
        tools: validationResult.data.tools as
          | ("calendar" | "location" | "weather")[]
          | null
          | undefined,
        defaultModel: validationResult.data.defaultModel,
        images: images.length > 0 ? images : undefined,
        apiKeys: apiKeys || undefined,
      },
      extends: extendedApps
        .map((app) => (app ? app.id : undefined))
        .filter(Boolean) as string[],
    })

    console.log("✅ App created successfully:", newApp?.images)

    if (!newApp) {
      return c.json({ error: "Failed to create app" }, { status: 500 })
    }

    if (!subjectStore.store.appId) {
      const updated = await updateStore({
        ...subjectStore.store,
        appId: newApp.id,
      })

      if (!updated) {
        return c.json({ error: "Failed to update user store" }, { status: 500 })
      }

      subjectStore = await getStore({
        id: updated.id,
        userId: member?.id,
        guestId: guest?.id,
      })

      if (!subjectStore) {
        return c.json({ error: "Failed to update user store" }, { status: 500 })
      }
    }

    // Install app to the store
    subjectStore?.store.id &&
      (await createStoreInstall({
        storeId: subjectStore?.store.id,
        appId: newApp.id,
      }))

    console.log(`✅ App installed to store: ${subjectStore?.store.slug}`)

    // 🎉 Auto-install and put first: Get all apps, add new app to top, send to reorder
    const storeAppsResult = await getApps({
      userId: member?.id,
      guestId: guest?.id,
    })

    // Install the main app for the user
    await installApp({
      appId: newApp.id,
      userId: member?.id,
      guestId: guest?.id,
      order: 0,
    })

    // Extended apps are already installed to store by createOrUpdateApp
    // No need to manually install them here

    // New app first, then up to 5 existing apps (total 6)
    const appsToReorder = [
      newApp,
      ...storeAppsResult.items
        .filter((app) => app.id !== newApp.id)
        .slice(0, 5),
    ]

    await reorderApps({
      token: member?.token || guest?.fingerprint!,
      apps: appsToReorder,
      autoInstall: false, // New app already installed above, just reorder
    })

    return c.json(await getApp({ id: newApp.id }), { status: 201 })
  } catch (error) {
    console.error("Error creating app:", error)
    captureException(error)
    return c.json({ error: "Failed to create app" }, { status: 500 })
  }
})

// POST /apps/reorder - Reorder apps
app.post("/apps/reorder", async (c) => {
  try {
    const member = await getMember(c)
    const guest = await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await c.req.json()) as ReorderRequest

    if (!body.apps || !Array.isArray(body.apps)) {
      return c.json(
        { error: "Invalid request: apps array required" },
        { status: 400 },
      )
    }

    // Validate each item
    for (const item of body.apps) {
      if (!item.appId || typeof item.order !== "number") {
        return c.json(
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
        console.error("❌ Error processing app %s:", safeAppId, error)
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

    return c.json(
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
    return c.json({ error: "Failed to reorder apps" }, { status: 500 })
  }
})
