import { NextRequest, NextResponse } from "next/server"
import getMember from "../../../actions/getMember"
import getGuest from "../../../actions/getGuest"
import { getApp, getPureApp, getAppExtends, createOrUpdateApp } from "@repo/db"
import { appSchema } from "chrry/schemas/appSchema"
import captureException from "../../../../lib/captureException"
import { deleteFile, upload } from "../../../../lib/uploadthing-server"
import { v4 as uuid, validate } from "uuid"
import slugify from "slug"
import { isOwner } from "chrry/utils"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const member = await getMember()
    const guest = await getGuest()

    if (!member && !guest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { slug: appSlug } = await params

    // Get existing app
    const existingApp = validate(appSlug)
      ? await getPureApp({
          id: appSlug,
          userId: member?.id,
          guestId: guest?.id,
        })
      : await getApp({
          slug: appSlug,
          userId: member?.id,
          guestId: guest?.id,
        })

    if (!existingApp) {
      return NextResponse.json({ error: "App not found" }, { status: 404 })
    }

    // Verify ownership
    if (
      (member && existingApp.userId !== member.id) ||
      (guest && existingApp.guestId !== guest.id)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Parse JSON body
    const body = await request.json()

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
      tips,
      tags,
      extends: extendsData,
      tools,
      image: imageUrl,
    } = body

    // Handle image - accept URL from /api/image endpoint
    let images = existingApp.images || []
    let shouldUpdateImages = false

    // Build the update data object (only include provided fields)
    const updateData: any = {}

    if (name !== null) updateData.name = name
    if (title !== null) updateData.title = title
    if (description !== null) updateData.description = description
    if (icon !== null) updateData.icon = icon
    if (systemPrompt !== null) updateData.systemPrompt = systemPrompt
    if (tone !== null) updateData.tone = tone
    if (language !== null) updateData.language = language
    if (defaultModel !== null) updateData.defaultModel = defaultModel
    if (temperature !== undefined) updateData.temperature = temperature
    if (capabilities !== undefined) updateData.capabilities = capabilities
    if (highlights !== undefined) updateData.highlights = highlights
    if (tips !== undefined) updateData.tips = tips
    if (tags !== undefined) updateData.tags = tags
    if (tools !== undefined) updateData.tools = tools
    if (extendsData !== undefined) updateData.extends = extendsData
    if (visibility !== null) updateData.visibility = visibility
    if (themeColor !== null) updateData.themeColor = themeColor
    if (backgroundColor !== null) updateData.backgroundColor = backgroundColor
    if (displayMode !== null) updateData.displayMode = displayMode
    if (pricing !== null) updateData.pricing = pricing
    if (price !== undefined) updateData.price = price
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
    if (shouldUpdateImages) updateData.images = images

    console.log("🔍 Update data before validation:", {
      shouldUpdateImages,
      imagesCount: images?.length,
      updateDataImages: updateData.images,
    })

    // Validate with Zod schema (partial validation)
    const validationResult = appSchema.partial().safeParse(updateData)

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

    const appExtends = await getAppExtends({
      appId: existingApp.id,
    })

    console.log("✅ Validation passed")

    // If name changed, update slug and check uniqueness
    if (name && name !== existingApp.name) {
      const newSlug = slugify(name, { lower: true })

      // Check if new slug conflicts with another app in the same store
      const conflictingApp = await getApp({ slug: newSlug })

      if (
        conflictingApp &&
        conflictingApp.id !== existingApp.id &&
        conflictingApp.store?.appId === existingApp.id
      ) {
        return NextResponse.json(
          {
            error: `An app with the slug "${newSlug}" already exists in this store. Please choose a different name.`,
          },
          { status: 400 },
        )
      }

      updateData.slug = newSlug
      console.log(`📝 Updating app slug: ${existingApp.slug} → ${newSlug}`)
    }

    // If image field is explicitly set to empty string or null, delete images
    if ("image" in body && (!imageUrl || imageUrl === "")) {
      console.log("🗑️ Removing app images (user cleared image)")

      // Delete old images
      if (existingApp.images && existingApp.images.length > 0) {
        for (const img of existingApp.images) {
          try {
            await deleteFile(img.url, "apps")
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
    else if (imageUrl && imageUrl.startsWith("http")) {
      try {
        console.log("📸 Processing updated app image from URL:", imageUrl)

        // Delete old images
        if (existingApp.images && existingApp.images.length > 0) {
          for (const img of existingApp.images) {
            try {
              await deleteFile(img.url, "apps")
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

        shouldUpdateImages = true
      } catch (uploadError) {
        console.error("❌ Image processing failed:", uploadError)
        // Continue with existing images
      }
    }

    // Update the app in the database
    // Note: images field is not in appSchema, so we add it separately
    // Remove any nested fields that shouldn't be in updateApp
    const { store: _store, apps: _apps, ...pureAppData } = existingApp as any
    const updatedApp = await createOrUpdateApp({
      app: {
        ...pureAppData,
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
      extends: extendedApps
        .map((app) => (app ? app.id : undefined))
        .filter(Boolean) as string[],
    })

    if (!updatedApp) {
      return NextResponse.json(
        { error: "Failed to update app" },
        { status: 500 },
      )
    }

    console.log("✅ Updated app with images:", updatedApp.images)

    // Install extended apps to user's store

    return NextResponse.json(updatedApp)
  } catch (error) {
    console.error("Error updating app:", error)
    captureException(error)
    return NextResponse.json({ error: "Failed to update app" }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug: appSlug } = await params

    const app = await getApp({ slug: appSlug })

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 })
    }

    // Only return public apps or apps owned by the requester
    const member = await getMember()
    const guest = await getGuest()

    const isOwner =
      (member && app.userId === member.id) ||
      (guest && app.guestId === guest.id)

    if (app.visibility !== "public" && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(app)
  } catch (error) {
    console.error("Error fetching app:", error)
    captureException(error)
    return NextResponse.json({ error: "Failed to fetch app" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const member = await getMember()
    const guest = await getGuest()

    if (!member && !guest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { slug: appSlug } = await params

    // Get existing app
    const existingApp = validate(appSlug)
      ? await getApp({ id: appSlug, userId: member?.id, guestId: guest?.id })
      : await getApp({
          slug: appSlug,
          userId: member?.id,
          guestId: guest?.id,
        })

    if (!existingApp) {
      return NextResponse.json({ error: "App not found" }, { status: 404 })
    }

    // Verify ownership
    if (!isOwner(existingApp, { userId: member?.id, guestId: guest?.id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Delete associated images
    if (existingApp.images && existingApp.images.length > 0) {
      for (const img of existingApp.images) {
        try {
          await deleteFile(img.id)
        } catch (deleteError) {
          console.error("Failed to delete image:", deleteError)
        }
      }
    }

    // Delete the app
    const { deleteApp } = await import("@repo/db")
    const deleted = await deleteApp({ id: existingApp.id })

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete app" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting app:", error)
    captureException(error)
    return NextResponse.json({ error: "Failed to delete app" }, { status: 500 })
  }
}
