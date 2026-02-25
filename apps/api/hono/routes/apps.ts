/* eslint-disable @typescript-eslint/no-unused-expressions */

import { reorderApps } from "@chrryai/chrry/lib"
import { appSchema } from "@chrryai/chrry/schemas/appSchema"
import { isOwner } from "@chrryai/chrry/utils"
import {
  and,
  createAppOrder,
  createOrUpdateApp,
  createStore,
  createStoreInstall,
  db,
  deleteApp,
  deleteInstall,
  encrypt,
  eq,
  getApp as getAppDb,
  getApps as getAppsDb,
  getInstall,
  getStore,
  getStoreInstall,
  getStoreInstalls,
  installApp,
  isDevelopment,
  isE2E,
  isNotNull,
  ne,
  safeDecrypt,
  updateApp,
  updateStore,
} from "@repo/db"
import { appOrders, apps, storeInstalls } from "@repo/db/src/schema"
import { Hono } from "hono"
import slugify from "slug"
import { v4 as uuid, validate } from "uuid"
import { captureException } from "../../lib/captureException"
import { deleteFile, upload } from "../../lib/minio"
import { redact } from "../../lib/redaction"
import { getApp, getGuest, getMember } from "../lib/auth"

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
  const accountApp = c.req.param("accountApp") === "true"
  // Get final app
  const app = await getApp({ c })

  if (!app) {
    if (accountApp) {
      return c.json(null)
    }
    return c.json({ error: "App not found" })
  }

  return c.json(app)
})

const getApps = async ({
  userId,
  guestId,
  storeId,
}: {
  userId?: string
  storeId?: string
  guestId?: string
}) => {
  const conditions = []
  if (userId) conditions.push(eq(apps.userId, userId))
  if (guestId) conditions.push(eq(apps.guestId, guestId))
  if (!userId && !guestId) conditions.push(eq(apps.visibility, "public"))
  if (storeId) conditions.push(eq(apps.storeId, storeId))

  const res = await db
    .select()
    .from(apps)
    .where(and(...conditions))

  return res
}

// GET /apps/:storeSlug/:appSlug - Get app by store and app slug (SEO-friendly)
app.get("/:storeSlug/:appSlug", async (c) => {
  const storeSlug = c.req.param("storeSlug")
  const appSlug = c.req.param("appSlug")

  const app = await getApp({
    c,
    storeSlug,
    appSlug,
    skipCache: true,
  })

  const accountApp = c.req.param("accountApp") === "true"

  if (!app) {
    if (accountApp) {
      return c.json(null)
    }
    return c.json({ error: "App not found" })
  }

  return c.json(app)
})

// GET /apps/:id - Get single app by ID
app.get("/:id", async (c) => {
  const id = c.req.param("id")
  const accountApp = c.req.param("accountApp") === "true"

  const app = await getApp({ c, appId: id })

  if (!app) {
    if (accountApp) {
      return c.json(null)
    }
    return c.json({ error: "App not found" })
  }

  return c.json(app)
})

app.post("/", async (c) => {
  try {
    const member = await getMember(c, {
      skipCache: true,
    })

    const guest = await getGuest(c, {
      skipCache: true,
    })

    if (!member && !guest) {
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
      placeholder,
      moltHandle,
      moltApiKey,
      tier,
    } = body

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

    const nameExists = existingApps.some(
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

    let appSlug = slugify(name, { lower: true })

    const existingBlossomApp = await getAppDb({
      slug: appSlug,
      role: "admin",
    })

    if (
      existingBlossomApp &&
      !isOwner(existingBlossomApp, { userId: member?.id })
    ) {
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
      name: typeof name === "string" ? await redact(name) : name,
      title: typeof title === "string" ? await redact(title) : title,
      description:
        typeof description === "string"
          ? await redact(description)
          : description,
      icon, // URLs shouldn't be redacted
      systemPrompt:
        typeof systemPrompt === "string"
          ? await redact(systemPrompt)
          : systemPrompt,
      tone,
      language,
      defaultModel,
      temperature,
      capabilities,
      highlights,
      tips,
      tags,
      tools,
      extends: extendsData,
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
      tier,
      placeholder:
        typeof placeholder === "string"
          ? await redact(placeholder)
          : placeholder,
      moltHandle:
        typeof moltHandle === "string" ? await redact(moltHandle) : moltHandle,
      moltApiKey:
        typeof moltApiKey === "string" && moltApiKey.trim()
          ? await encrypt(moltApiKey.trim())
          : undefined,
    }

    if (tier && tier !== "free" && !member) {
      return c.json(
        { error: "You must be logged in to create a paid app" },
        { status: 401 },
      )
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
          skipCache: true,
        })
      : guest
        ? await getStore({
            slug: guest?.id,
            skipCache: true,
          })
        : undefined

    const extendedApps = validationResult?.data.extends
      ? (
          await Promise.all(
            validationResult?.data.extends.map(async (extendedAppId) => {
              console.log("🔍 Looking up extended app:", extendedAppId)

              // Try to look up by ID first (handles UUIDs)

              return await getAppDb({
                id: extendedAppId,
                userId: member?.id,
                guestId: guest?.id,
                skipCache: true,
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
    if (imageUrl?.startsWith("http")) {
      try {
        console.log("📸 Processing app image from URL:", imageUrl)

        // Validate URL to prevent SSRF attacks
        const parsedUrl = new URL(imageUrl)
        const ALLOWED_HOSTNAMES = [
          "utfs.io",
          "uploadthing.com",
          "images.unsplash.com",
          "cdn.jsdelivr.net",
          "minio.chrry.dev", // Our MinIO server (development/staging)
          "minio.chrry.ai", // Our MinIO server (production)
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
          // Generate content-based hash for deduplication
          // Same image + same size = same hash = no duplicates
          // Using SHA256 for security compliance (MD5 flagged by security scanners)
          const crypto = await import("node:crypto")
          const contentHash = crypto
            .createHash("sha256")
            .update(`${imageUrl}-${size}x${size}`)
            .digest("hex")
            .substring(0, 16)

          const result = await upload({
            url: imageUrl,
            messageId: `${slugify(name)}-${contentHash}`,
            options: {
              width: size,
              height: size,
              fit: "contain", // Center image, don't crop (adds padding if needed)
              position: "center",
              title: `${name}-${size}x${size}`,
              type: "image",
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
      const storeSlug = member
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
        return c.json({ error: "Store slug taken" }, { status: 400 })
      }

      const chrry = await getStore({
        parentStoreId: null,
      })

      if (!chrry) {
        return c.json({ error: "Chrry store not found" }, { status: 404 })
      }

      const created = await createStore({
        slug: storeSlug,
        name: member?.userName || `GuestStore`,
        title: `${`${member?.userName}'s` || "My"} Store`,
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
        skipCache: true,
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

    // Check if slug is unique within the store
    const existingAppInStore = await getAppDb({
      userId: member?.id,
      guestId: guest?.id,
      slug: appSlug,
      skipCache: true,
    })

    if (
      existingAppInStore &&
      existingAppInStore?.store?.id === subjectStore?.store.id
    ) {
      // Slug already exists in this store, append UUID to make it unique
      appSlug = `${appSlug}-${uuid().slice(0, 8)}`
      console.log(`⚠️ App slug taken in store, using: ${appSlug}`)
    }

    // Hash API keys before saving
    let hashedApiKeys: Record<string, string> | undefined
    if (apiKeys && typeof apiKeys === "object") {
      hashedApiKeys = {}
      for (const [key, value] of Object.entries(apiKeys)) {
        if (value && typeof value === "string" && value.trim()) {
          // Encrypt the API key using AES-256-GCM
          hashedApiKeys[key] = await encrypt(value.trim())
        }
      }
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
        tier: validationResult.data.tier as "free" | "plus" | "pro",
        tools: validationResult.data.tools as
          | ("calendar" | "location" | "weather")[]
          | null
          | undefined,
        defaultModel: validationResult.data.defaultModel,
        images: images.length > 0 ? images : undefined,
        apiKeys: hashedApiKeys || undefined,
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
        skipCache: true,
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
      ...storeAppsResult.filter((app) => app.id !== newApp.id).slice(0, 5),
    ]

    await reorderApps({
      token: member?.token || guest?.fingerprint!,
      apps: appsToReorder,
      autoInstall: false, // New app already installed above, just reorder
    })

    return c.json(await getAppDb({ id: newApp.id, skipCache: true }), {
      status: 201,
    })
  } catch (error) {
    console.error("Error creating app:", error)
    captureException(error)
    return c.json({ error: "Failed to create app" }, { status: 500 })
  }
})

// POST /apps/reorder - Reorder apps
app.post("/reorder", async (c) => {
  try {
    const member = await getMember(c, {
      skipCache: true,
    })
    const guest = await getGuest(c, {
      skipCache: true,
    })

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
        const safeAppId = String(item.appId).replaceAll(/[^\w-]/g, "_")
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

// PATCH /apps/:id - Update existing app
app.patch("/:id", async (c) => {
  try {
    const member = await getMember(c, {
      skipCache: true,
    })
    const guest = await getGuest(c, {
      skipCache: true,
    })
    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, { status: 401 })
    }

    const appId = c.req.param("id")

    if (!validate(appId)) {
      return c.json({ error: "Invalid app ID" }, { status: 400 })
    }

    // Get existing app
    const existingApp = await getAppDb({
      id: appId,
      userId: member?.id,
      guestId: guest?.id,
      skipCache: true,
    })

    if (!existingApp) {
      return c.json({ error: "App not found" }, { status: 404 })
    }

    // Verify ownership
    if (!isOwner(existingApp, { userId: member?.id, guestId: guest?.id })) {
      return c.json({ error: "Forbidden" }, { status: 403 })
    }

    // Parse JSON body
    const body = await c.req.json()

    // Extract fields from JSON (all optional for PATCH)
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
      extends: extendsData,
      tools,
      image: imageUrl,
      placeholder,
      apiKeys,
      moltHandle,
      moltApiKey,
      tier,
    } = body

    const skipDangerousZone =
      isDevelopment || isE2E || body.dangerousZone === true

    if (!skipDangerousZone) {
      if (member?.role === "admin") {
        return c.json(
          { error: "Send dangerousZone to confirm" },
          { status: 401 },
        )
      }
    }

    if (tier && tier !== "free" && !member) {
      return c.json(
        { error: "You must be logged in to create a paid app" },
        { status: 401 },
      )
    }

    // Handle image - accept URL from /api/image endpoint
    let images = existingApp.images || []
    let shouldUpdateImages = false

    // Build the update data object (only include provided fields)
    const updateData: any = {}

    if (name !== undefined)
      updateData.name =
        name === null
          ? null
          : typeof name === "string"
            ? await redact(name)
            : name
    if (placeholder !== undefined)
      updateData.placeholder =
        placeholder === null
          ? null
          : typeof placeholder === "string"
            ? await redact(placeholder)
            : placeholder
    if (title !== undefined)
      updateData.title =
        title === null
          ? null
          : typeof title === "string"
            ? await redact(title)
            : title
    if (description !== undefined)
      updateData.description =
        description === null
          ? null
          : typeof description === "string"
            ? await redact(description)
            : description
    if (icon !== null) updateData.icon = icon
    if (systemPrompt !== undefined)
      updateData.systemPrompt =
        systemPrompt === null
          ? null
          : typeof systemPrompt === "string"
            ? await redact(systemPrompt)
            : systemPrompt
    if (tone !== null) updateData.tone = tone
    if (language !== null) updateData.language = language
    if (defaultModel !== null) updateData.defaultModel = defaultModel
    if (temperature !== undefined) updateData.temperature = temperature
    if (capabilities !== undefined) updateData.capabilities = capabilities
    if (highlights !== undefined) updateData.highlights = highlights
    if (tags !== undefined) updateData.tags = tags
    if (tools !== undefined) updateData.tools = tools
    if (extendsData !== undefined) updateData.extends = extendsData
    if (visibility !== null) updateData.visibility = visibility
    if (themeColor !== null) updateData.themeColor = themeColor
    if (backgroundColor !== null) updateData.backgroundColor = backgroundColor
    if (displayMode !== null) updateData.displayMode = displayMode
    if (pricing !== null) updateData.pricing = pricing
    if (price !== undefined) updateData.price = price
    if (tier !== undefined) updateData.tier = tier
    if (moltHandle !== undefined)
      updateData.moltHandle =
        moltHandle === null
          ? null
          : typeof moltHandle === "string"
            ? await redact(moltHandle)
            : moltHandle
    // moltApiKey is handled below with encrypt

    if (currency !== null) updateData.currency = currency
    if (subscriptionInterval !== null)
      updateData.subscriptionInterval = subscriptionInterval
    if (apiEnabled !== undefined) updateData.apiEnabled = apiEnabled
    if (apiPricing !== null) updateData.apiPricing = apiPricing
    if (apiPricePerRequest !== undefined)
      updateData.apiPricePerRequest = apiPricePerRequest
    if (apiMonthlyPrice !== undefined)
      updateData.apiMonthlyPrice = apiMonthlyPrice
    if (apiRateLimit !== undefined) updateData.apiRateLimit = apiRateLimit
    if (moltApiKey !== undefined) {
      const trimmed = typeof moltApiKey === "string" ? moltApiKey.trim() : ""
      // Only update if: empty (clear) or real key (exact mask = preserve)
      if (trimmed === "") {
        updateData.moltApiKey = null
      } else if (trimmed === mask) {
        // Exact mask match - preserve existing key (don't update)
        // This prevents bypass by user input containing mask substring
      } else {
        // Real key provided - encrypt and save
        updateData.moltApiKey = await encrypt(trimmed)
      }
    }

    if (shouldUpdateImages) updateData.images = images

    // Hash API keys before saving (if provided)
    if (apiKeys !== undefined) {
      if (apiKeys && typeof apiKeys === "object") {
        const hashedApiKeys: Record<string, string> = {}
        for (const [key, value] of Object.entries(apiKeys)) {
          if (value && typeof value === "string" && value.trim()) {
            // Encrypt the API key using AES-256-GCM
            hashedApiKeys[key] = await encrypt(value.trim())
          }
        }
        updateData.apiKeys = hashedApiKeys
      } else {
        // If apiKeys is explicitly null or empty, clear it
        updateData.apiKeys = null
      }
    }

    console.log("🔍 Update data before validation:", {
      shouldUpdateImages,
      imagesCount: images?.length,
      updateDataImages: updateData.images,
    })

    // Validate with Zod schema (partial validation)
    const validationResult = appSchema.partial().safeParse(updateData)

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

    const extendedApps = validationResult?.data.extends
      ? (
          await Promise.all(
            validationResult?.data.extends.map(async (extendedAppId) => {
              console.log("🔍 Looking up extended app:", extendedAppId)

              // Try to look up by ID first (handles UUIDs)
              const extendedApp = await getAppDb({
                id: extendedAppId,
                skipCache: true,
              })

              return extendedApp
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

    const storeInstalls = existingApp.storeId
      ? await getStoreInstalls({
          storeId: existingApp.storeId,
        })
      : undefined

    const existingApps = existingApp.storeId
      ? await getApps({
          storeId: existingApp.storeId,
        })
      : null

    if (
      existingApps?.some(
        (app) =>
          app?.id !== existingApp.id &&
          !extendedApps.some((e) => e?.id === app.id),
      )
    ) {
      return c.json(
        {
          error: `Store apps should extends each other`,
        },
        { status: 400 },
      )
    }

    if (storeInstalls?.length) {
      await Promise.all(
        storeInstalls.map(async (install) => {
          if (!extendedApps.some((app) => app?.id === install.appId)) {
            await deleteInstall({
              storeId: install.storeId,
              appId: install.appId,
            })
          }
        }),
      )
    }

    for (const extendedApp of extendedApps) {
      if (
        existingApp.storeId &&
        extendedApp?.id
        // &&
        // !storeInstalls?.find((install) => install.appId === extendedApp.id)
      ) {
        await createStoreInstall({
          storeId: existingApp.storeId,
          appId: extendedApp.id,
          featured: true,
          displayOrder: 1,
          customDescription: extendedApp.description,
        })
      }
    }

    console.log("✅ Validation passed")

    if (name) {
      const newSlug = slugify(name, { lower: true })

      const existingBlossomApp = await getAppDb({
        slug: newSlug,
        role: "admin",
      })

      if (
        existingBlossomApp &&
        !isOwner(existingBlossomApp, { userId: member?.id })
      ) {
        return c.json(
          {
            error: `An app with the name "${name}" already exists. Please choose a different name.`,
          },
          { status: 400 },
        )
      }

      // If name changed, update slug and check uniqueness
      if (name !== existingApp.name) {
        // Check if new slug conflicts with another app in the same store
        const conflictingApp = await getAppDb({
          slug: newSlug,
          skipCache: true,
        })

        if (
          conflictingApp &&
          conflictingApp.id !== existingApp.id &&
          conflictingApp.store?.appId === existingApp.id
        ) {
          return c.json(
            {
              error: `An app with the slug "${newSlug}" already exists in this store. Please choose a different name.`,
            },
            { status: 400 },
          )
        }

        updateData.slug = newSlug
        console.log(`📝 Updating app slug: ${existingApp.slug} → ${newSlug}`)
      }
    }

    // If image field is explicitly set to empty string or null, delete images
    if ("image" in body && (!imageUrl || imageUrl === "")) {
      console.log("🗑️ Removing app images (user cleared image)")

      // Delete old images
      if (existingApp.images && existingApp.images.length > 0) {
        for (const img of existingApp.images) {
          try {
            await deleteFile(img.url)
            console.log("🗑️ Deleted old image:", img.url)
          } catch (deleteError) {
            console.error("⚠️ Failed to delete old image:", deleteError)
          }
        }
      }

      images = []
      shouldUpdateImages = true
    }
    // If new image URL provided, process it
    else if (imageUrl?.startsWith("http")) {
      try {
        console.log("📸 Processing updated app image from URL:", imageUrl)

        // Delete old images
        if (existingApp.images && existingApp.images.length > 0) {
          for (const img of existingApp.images) {
            try {
              await deleteFile(img.url)
              console.log("🗑️ Deleted old image:", img.url)
            } catch (deleteError) {
              console.error("⚠️ Failed to delete old image:", deleteError)
            }
          }
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
          // Generate content-based hash for deduplication
          // Same image + same size = same hash = no duplicates
          // Using SHA256 for security compliance (MD5 flagged by security scanners)
          const crypto = await import("node:crypto")
          const contentHash = crypto
            .createHash("sha256")
            .update(`${imageUrl}-${size}x${size}`)
            .digest("hex")
            .substring(0, 16)

          const result = await upload({
            url: imageUrl,
            messageId: `${slugify(name)}-${contentHash}`,
            options: {
              width: size,
              height: size,
              fit: "contain", // Center image, don't crop (adds padding if needed)
              position: "center",
              title: `${name}-${size}x${size}`,
              type: "image",
            },
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

        // Delete temporary image
        try {
          await deleteFile(imageUrl)
          console.log("🗑️ Deleted temporary image:", imageUrl)
        } catch (deleteError) {
          console.error("⚠️ Failed to delete temp image:", deleteError)
          // Continue anyway - not critical
        }

        shouldUpdateImages = true
      } catch (uploadError) {
        console.error("❌ Image processing failed:", uploadError)
        // Continue with existing images
      }
    }

    // Update the app in the database
    // Remove any nested fields that shouldn't be in updateApp
    const updatedApp = await createOrUpdateApp({
      app: {
        ...existingApp,
        ...validationResult.data,
        ...(shouldUpdateImages && { images }), // Add images if updated
        tools: (validationResult.data.tools ?? existingApp.tools) as
          | ("calendar" | "location" | "weather")[]
          | null,
        defaultModel: (validationResult.data.defaultModel ??
          existingApp.defaultModel) as
          | "deepSeek"
          | "chatGPT"
          | "claude"
          | "gemini"
          | "flux"
          | "perplexity"
          | null,
      },
      // extends: extendedApps
      //   .map((app) => (app ? app.id : undefined))
      //   .filter(Boolean) as string[],
    })

    if (!updatedApp) {
      return c.json({ error: "Failed to update app" }, { status: 500 })
    }

    console.log("✅ Updated app with images:", updatedApp.images)

    return c.json(updatedApp)
  } catch (error) {
    console.error("Error updating app:", error)
    captureException(error)
    return c.json({ error: "Failed to update app" }, { status: 500 })
  }
})

app.delete("/:id", async (c) => {
  const id = c.req.param("id")

  // Body is optional for DELETE - handle case where no body is sent
  let body: { dangerousZone?: boolean } = {}
  try {
    body = await c.req.json()
  } catch {
    // No body or invalid JSON - use defaults
  }

  const skipDangerousZone =
    isDevelopment || isE2E || body.dangerousZone === true
  try {
    const member = await getMember(c, {
      skipCache: true,
    })
    const guest = await getGuest(c, {
      skipCache: true,
    })

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (member?.role === "admin" && !skipDangerousZone) {
      return c.json({ error: "Send dangerousZone to confirm" }, { status: 401 })
    }

    const app = await getAppDb({
      id,
      userId: member?.id,
      guestId: guest?.id,
      skipCache: true,
    })

    if (!app) {
      return c.json({ error: "App not found" }, { status: 404 })
    }

    if (!isOwner(app, { userId: member?.id, guestId: guest?.id })) {
      return c.json({ error: "Forbidden" }, { status: 403 })
    }

    if (app.store?.slug !== guest?.id && app.store?.slug !== member?.userName) {
      return c.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify ownership

    // Delete associated images
    if (app.images && app.images.length > 0) {
      for (const img of app.images) {
        try {
          await deleteFile(img.id)
        } catch (deleteError) {
          console.error("Failed to delete image:", deleteError)
        }
      }
    }

    // Delete the app
    const deleted = await deleteApp({ id: app.id })

    if (!deleted) {
      return c.json({ error: "Failed to delete app" }, { status: 500 })
    }

    return c.json({ success: true })
  } catch (error) {
    console.error("Error deleting app:", error)
    captureException(error)
    return c.json({ error: "Failed to delete app" }, { status: 500 })
  }
})

const mask = "*****"

// PATCH /apps/:id/moltbook - Update Moltbook integration settings
app.patch("/:id/moltbook", async (c) => {
  try {
    const member = await getMember(c, {
      skipCache: true,
    })
    const guest = await getGuest(c, {
      skipCache: true,
    })
    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, { status: 401 })
    }

    const appId = c.req.param("id")

    if (!validate(appId)) {
      return c.json({ error: "Invalid app ID" }, { status: 400 })
    }

    // Get existing app
    const existingApp = await getAppDb({
      id: appId,
      userId: member?.id,
      guestId: guest?.id,
      skipCache: true,
    })

    if (!existingApp) {
      return c.json({ error: "App not found" }, { status: 404 })
    }

    // Verify ownership
    if (!isOwner(existingApp, { userId: member?.id, guestId: guest?.id })) {
      return c.json({ error: "Forbidden" }, { status: 403 })
    }

    // Parse JSON body
    const body = await c.req.json()
    const { moltApiKey } = body

    // Build the update data object
    const updateData: any = {}

    // Handle Moltbook API key with encryption
    if (moltApiKey !== undefined) {
      const trimmed = typeof moltApiKey === "string" ? moltApiKey.trim() : ""

      // Only update if: empty (clear) or real key (exact mask = preserve)
      if (trimmed === "") {
        // Explicitly clear the key and metadata
        updateData.moltApiKey = null
        updateData.moltHandle = null
        updateData.moltAgentName = null
        updateData.moltAgentKarma = null
        updateData.moltAgentVerified = null
      } else if (trimmed === mask) {
        // Exact mask match - preserve existing key (don't update)
        // This prevents bypass by user input containing mask substring
      } else {
        // Real key provided - validate and save
        // Check if this API key is already used by another app
        const existingApps = await db.query.apps.findMany({
          where: and(
            isNotNull(apps.moltApiKey),
            ne(apps.id, appId), // Exclude current app
          ),
        })

        // Decrypt and check each existing key
        for (const existingApp of existingApps) {
          if (existingApp.moltApiKey) {
            const decryptedKey = safeDecrypt(existingApp.moltApiKey)
            if (decryptedKey === trimmed) {
              return c.json(
                { error: "This API key is already in use by another app" },
                { status: 409 },
              )
            }
          }
        }

        // Fetch agent info from Moltbook
        const { getMoltbookAgentInfo } = await import(
          "../../lib/integrations/moltbook"
        )
        const agentInfo = await getMoltbookAgentInfo(trimmed)

        updateData.moltApiKey = await encrypt(trimmed)

        // Save agent info if available
        if (agentInfo) {
          updateData.moltHandle = agentInfo.name
          updateData.moltAgentName = agentInfo.name
          updateData.moltAgentKarma = agentInfo.karma
          updateData.moltAgentVerified = agentInfo.verified
        }
      }
      // If masked, don't set updateData fields (preserve existing)
    }

    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      await db.update(apps).set(updateData).where(eq(apps.id, appId))
    }

    // Fetch updated app
    const updatedApp = await getApp({
      appId: appId,
      c,
      skipCache: true,
    })

    return c.json({ app: updatedApp })
  } catch (error) {
    console.error("Error updating Moltbook settings:", error)
    captureException(error)
    return c.json(
      { error: "Failed to update Moltbook settings" },
      { status: 500 },
    )
  }
})

// DELETE /apps/:id/moltbook - Delete Moltbook API key
app.delete("/:id/moltbook", async (c) => {
  try {
    const member = await getMember(c, {
      skipCache: true,
    })
    const guest = await getGuest(c, {
      skipCache: true,
    })
    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, { status: 401 })
    }

    const appId = c.req.param("id")

    if (!validate(appId)) {
      return c.json({ error: "Invalid app ID" }, { status: 400 })
    }

    // Get existing app
    const existingApp = await getAppDb({
      id: appId,
      userId: member?.id,
      guestId: guest?.id,
      skipCache: true,
    })

    if (!existingApp) {
      return c.json({ error: "App not found" }, { status: 404 })
    }

    // Verify ownership
    if (!isOwner(existingApp, { userId: member?.id, guestId: guest?.id })) {
      return c.json({ error: "Forbidden" }, { status: 403 })
    }

    // Delete the API key and all Molt metadata
    await db
      .update(apps)
      .set({
        moltApiKey: null,
        moltHandle: null,
        moltAgentName: null,
        moltAgentKarma: null,
        moltAgentVerified: null,
      })
      .where(eq(apps.id, appId))

    // Fetch updated app
    const updatedApp = await getAppDb({
      id: appId,
      userId: member?.id,
      guestId: guest?.id,
    })

    return c.json({ app: updatedApp })
  } catch (error) {
    console.error("Error deleting Moltbook API key:", error)
    captureException(error)
    return c.json(
      { error: "Failed to delete Moltbook API key" },
      { status: 500 },
    )
  }
})
