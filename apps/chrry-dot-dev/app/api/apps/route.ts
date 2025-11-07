import { NextRequest, NextResponse } from "next/server"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import {
  getApps,
  installApp,
  createStore,
  createStoreInstall,
  getApp,
  getStore,
  updateStore,
  createOrUpdateApp,
} from "@repo/db"
import { appSchema } from "chrry/schemas/appSchema"
import captureException from "../../../lib/captureException"
import { upload, deleteFile } from "../../../lib/uploadthing-server"
import slugify from "slug"
import { v4 as uuid } from "uuid"
import { reorderApps } from "chrry/lib"

export async function GET(request: NextRequest) {
  try {
    const member = await getMember()
    const guest = await getGuest()

    const result = await getApps({
      page: 1,
      pageSize: 100,
      userId: member?.id,
      guestId: guest?.id,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching apps:", error)
    captureException(error)
    return NextResponse.json({ error: "Failed to fetch apps" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const member = await getMember()
    const guest = await getGuest()

    if (!member && !guest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse JSON body
    const body = await request.json()
    console.log("📦 Received app data:", JSON.stringify(body, null, 2))

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

    // Validate app name: no spaces, must be unique
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "App name is required" },
        { status: 400 },
      )
    }

    if (name.includes(" ")) {
      return NextResponse.json(
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
      return NextResponse.json(
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
      return NextResponse.json(
        { error: "Chrry store not found" },
        { status: 404 },
      )
    }

    // Validate with Zod schema
    console.log("🔍 Validating app data:", appData)
    const validationResult = appSchema.safeParse(appData)

    if (!validationResult.success) {
      console.error("❌ Validation failed:", validationResult.error.format())
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.format(),
        },
        { status: 400 },
      )
    }

    if (!validationResult?.data?.extends?.length) {
      return NextResponse.json(
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
              let extendedApp = await getApp({
                id: extendedAppId,
              })

              return extendedApp
            }),
          )
        ).filter(Boolean)
      : []

    if (!extendedApps.length) {
      return NextResponse.json(
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
        return NextResponse.json(
          { error: "Failed to create user store" },
          { status: 500 },
        )
      }

      subjectStore = await getStore({
        id: created.id,
        userId: member?.id,
        guestId: guest?.id,
      })

      if (!subjectStore) {
        return NextResponse.json(
          { error: "Failed to create user store" },
          { status: 500 },
        )
      }

      console.log(`✅ Store created: ${subjectStore.store.slug}`)
    }

    if (!subjectStore) {
      return NextResponse.json(
        { error: "Failed to create user store" },
        { status: 500 },
      )
    }

    const id = uuid()
    let appSlug = slugify(name, { lower: true })

    // Check if slug is unique within the store
    const existingAppInStore = await getApp({
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
      return NextResponse.json(
        { error: "Failed to create app" },
        { status: 500 },
      )
    }

    if (!subjectStore.store.appId) {
      const updated = await updateStore({
        ...subjectStore.store,
        appId: newApp.id,
      })

      if (!updated) {
        return NextResponse.json(
          { error: "Failed to update user store" },
          { status: 500 },
        )
      }

      subjectStore = await getStore({
        id: updated.id,
        userId: member?.id,
        guestId: guest?.id,
      })

      if (!subjectStore) {
        return NextResponse.json(
          { error: "Failed to update user store" },
          { status: 500 },
        )
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
    const allAppsResult = await getApps({
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
      ...allAppsResult.items.filter((app) => app.id !== newApp.id).slice(0, 5),
    ]

    await reorderApps({
      token: member?.token || guest?.fingerprint!,
      apps: appsToReorder,
      autoInstall: false, // New app already installed above, just reorder
    })

    return NextResponse.json(await getApp({ id: newApp.id }), { status: 201 })
  } catch (error) {
    console.error("Error creating app:", error)
    captureException(error)
    return NextResponse.json({ error: "Failed to create app" }, { status: 500 })
  }
}
