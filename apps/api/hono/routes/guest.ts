import { encrypt, getGuest, updateGuest } from "@repo/db"
import { Hono } from "hono"
import { captureException } from "../../lib/captureException"
import {
  type ProviderName,
  validateApiKey,
} from "../../lib/utils/validateApiKey"
import { getGuest as getGuestAction } from "../lib/auth"

export const guest = new Hono()

// PATCH /guest - Update guest profile
guest.patch("/", async (c) => {
  const guestData = await getGuestAction(c, {
    skipCache: true,
    skipMasking: true, // Get unmasked keys for merging
  })

  const {
    favouriteAgent,
    characterProfilesEnabled,
    city,
    country,
    memoriesEnabled,
    apiKeys,
    openRouterApiKey,
    replicateApiKey,
    s3ApiKey,
    falApiKey,
    deletedApiKeys,
  } = await c.req.json()

  if (!guestData) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  // Safely merge API keys if any are provided
  const keys = guestData.apiKeys ? { ...guestData.apiKeys } : {}
  let hasKeyUpdates = false

  const updateKey = async (
    provider: ProviderName,
    value: string | undefined | null,
  ) => {
    if (value === undefined) return
    if (value === null || value.trim() === "") {
      delete (keys as any)[provider]
      hasKeyUpdates = true
      return
    }

    const trimmed = value.trim()
    if (!validateApiKey(provider, trimmed)) {
      throw new Error(`Invalid ${provider} API key format`)
    }

    ;(keys as any)[provider] = await encrypt(trimmed)
    hasKeyUpdates = true
  }

  try {
    if (apiKeys && typeof apiKeys === "object") {
      for (const [provider, value] of Object.entries(apiKeys || {})) {
        await updateKey(provider as ProviderName, value as string)
      }
    }

    if (openRouterApiKey !== undefined)
      await updateKey("openrouter", openRouterApiKey)
    if (replicateApiKey !== undefined)
      await updateKey("replicate", replicateApiKey)
    if (falApiKey !== undefined) await updateKey("fal", falApiKey)
    if (s3ApiKey !== undefined) await updateKey("s3", s3ApiKey)

    // Handle explicit deletion of API keys
    if (Array.isArray(deletedApiKeys)) {
      for (const provider of deletedApiKeys) {
        delete (keys as any)[provider]
        hasKeyUpdates = true
      }
    }
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }

  // If apiKeys was provided as a full object, or if we have updates, use the merged 'keys'
  // Otherwise, fallback to what was there (guestData.apiKeys)
  const finalKeys =
    apiKeys === null ? null : hasKeyUpdates ? keys : guestData.apiKeys

  try {
    await updateGuest({
      ...guestData,
      favouriteAgent: favouriteAgent ?? guestData.favouriteAgent,
      characterProfilesEnabled:
        characterProfilesEnabled ?? guestData.characterProfilesEnabled,
      memoriesEnabled: memoriesEnabled ?? guestData.memoriesEnabled,
      city: city ?? guestData.city,
      country: country ?? guestData.country,
      apiKeys: finalKeys,
    })

    const updatedGuest = await getGuest({
      id: guestData.id,
      skipCache: true,
    })

    return c.json(updatedGuest)
  } catch (error) {
    captureException(error)
    console.error("Error updating guest:", error)
    return c.json({ error: "Server error" }, 500)
  }
})

// GET /guest - Get guest profile
guest.get("/", async (c) => {
  const guestData = await getGuestAction(c, {
    skipCache: true,
  })

  if (!guestData) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  return c.json(guestData)
})
