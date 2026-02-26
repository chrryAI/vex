import { resolve4, resolve6 } from "node:dns/promises"
import { isValidUsername } from "@chrryai/chrry/utils"
import { protectedRoutes } from "@chrryai/chrry/utils/url"
import {
  deleteUser,
  getStore,
  getUser,
  updateStore,
  updateUser,
} from "@repo/db"
import { Hono } from "hono"
import slugify from "slug"
import Stripe from "stripe"
import { captureException } from "../../lib/captureException"
import { clearGraphDataForUser } from "../../lib/graph/graphService"
import { deleteFile, upload } from "../../lib/minio"
import { scanFileForMalware } from "../../lib/security"
import { isPrivateIP } from "../../utils/ssrf"
import { getMember } from "../lib/auth"

async function isValidImageUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false
    }

    // Prevent DNS rebinding attacks by resolving hostname and validating each IP
    try {
      // Resolve IPv4 addresses (returns string[] by default)
      const v4Addresses = await resolve4(parsed.hostname)
      for (const addr of v4Addresses) {
        if (isPrivateIP(addr)) {
          return false
        }
      }

      // Also try IPv6 resolution
      try {
        const v6Addresses = await resolve6(parsed.hostname)
        for (const addr of v6Addresses) {
          if (isPrivateIP(addr)) {
            return false
          }
        }
      } catch {
        // IPv6 resolution may not always succeed; that's okay
      }

      return true
    } catch (dnsError) {
      // DNS resolution failed - treat as invalid to prevent SSRF
      console.warn(`DNS resolution failed for ${parsed.hostname}:`, dnsError)
      return false
    }
  } catch {
    return false
  }
}

export const user = new Hono()

// GET /user - Get current user
user.get("/", async (c) => {
  const member = await getMember(c, { skipCache: true })

  if (!member) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  return c.json(member)
})

// PATCH /user - Update user profile
user.patch("/", async (c) => {
  const member = await getMember(c, { full: true, skipCache: true })

  const {
    language,
    name,
    image,
    userName,
    favouriteAgent,
    characterProfilesEnabled,
    memoriesEnabled,
    city,
    country,
  } = await c.req.json()

  if (!member) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  if (protectedRoutes.includes(userName)) {
    return c.json({ error: "Username is protected" }, 400)
  }

  if (!isValidUsername(userName)) {
    return c.json(
      { error: "Username must be 3-20 alphanumeric characters" },
      400,
    )
  }

  if (image && !(await isValidImageUrl(image))) {
    return c.json({ error: "Invalid image URL" }, 400)
  }

  const exists = async (username: string) => {
    // Check if username taken by another user
    const existingUser = await getUser({ userName: username, skipCache: true })
    if (existingUser && existingUser.id !== member.id) {
      return true // Username taken by someone else
    }

    // Check if slug taken by another user's store
    const existingStore = await getStore({ slug: username, skipCache: true })
    if (existingStore?.store) {
      const store = existingStore.store

      // It's taken UNLESS it's owned by current user
      const isOwnStore = store.userId === member.id

      if (!isOwnStore) {
        return true // Slug taken by someone else
      }
    }

    return false // Username/slug is available
  }

  if (userName && (await exists(userName))) {
    return c.json({ error: "Username already exists" }, 400)
  }

  const existingUser = userName
    ? await getUser({
        userName,
      })
    : undefined

  if (existingUser && existingUser.id !== member.id) {
    return c.json({ error: "Username already exists" }, 400)
  }

  const userStore = await getStore({ slug: member.userName, skipCache: true })

  if (userStore?.store && userName !== member.userName) {
    await updateStore({
      ...userStore.store,
      slug: userName,
    })
  }

  try {
    // Update user
    await updateUser({
      ...member,
      language: language ?? "en",
      name: name ?? member.name,
      image: image ?? member.image,
      userName: userName ?? member.userName,
      characterProfilesEnabled:
        characterProfilesEnabled ?? member.characterProfilesEnabled,
      memoriesEnabled: memoriesEnabled ?? member.memoriesEnabled,
      favouriteAgent: favouriteAgent ?? member.favouriteAgent,
      city: city ?? member.city,
      country: country ?? member.country,
    })

    // If username changed, update store slug if it matches old username
    if (userName && userName !== member.userName) {
      const userStore = await getStore({
        slug: member.userName,
        skipCache: true,
      })
      if (userStore && userStore.store.userId === member.id) {
        await updateStore({
          ...userStore.store,
          slug: userName,
        })
      }
    }

    return c.json({
      ...(await getUser({
        id: member.id,
        skipCache: true,
      })),
      password: undefined,
    })
  } catch (error) {
    captureException(error)
    console.error("Error updating user:", error)
    return c.json({ error: "Server error" }, 500)
  }
})

// DELETE /user - Delete user account
user.delete("/", async (c) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const member = await getMember(c, {
    skipCache: true,
  })

  if (!member) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const stripeSubscriptionId =
    member.subscription?.provider === "stripe"
      ? member.subscription.subscriptionId
      : null

  if (member.image) {
    await deleteFile(member.image)
  }

  try {
    if (stripeSubscriptionId) {
      await stripe.subscriptions.cancel(stripeSubscriptionId)
    }

    // Clear graph data before deleting user
    // This removes all FalkorDB entities and relationships
    await clearGraphDataForUser({
      userId: member.id,
    })

    await deleteUser(member.id)
    return c.json({ success: true })
  } catch (error) {
    captureException(error)
    console.error("Error deleting user:", error)
    return c.json({ error: "Server error" }, 500)
  }
})

// PATCH /user/image - Upload profile image
user.patch("/image", async (c) => {
  const member = await getMember(c, { full: true, skipCache: true })

  if (!member) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const formData = await c.req.formData()
  const image = formData.get("image") as File | null

  if (member.image) {
    await deleteFile(member.image)
  }

  if (!image) {
    await updateUser({ ...member, image: null })
    return c.json({ url: null })
  }

  // Validate file type
  if (!image.type.startsWith("image/")) {
    return c.json({ error: "File must be an image" }, 400)
  }

  try {
    const arrayBuffer = await image.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const scanResult = await scanFileForMalware(buffer, {
      filename: image.name || "profile-image",
    })

    if (!scanResult.safe) {
      console.error(`🚨 Malware detected`)
      return c.json(
        {
          error: `File failed security scan${scanResult.threat ? `: ${scanResult.threat}` : ""}`,
        },
        400,
      )
    }

    const base64 = buffer.toString("base64")

    const uploadResult = await upload({
      url: `data:${image.type};base64,${base64}`,
      messageId: slugify(image.name.substring(0, 10)),
      options: {
        width: 200,
        height: 200,
        fit: "contain", // Preserve aspect ratio without cropping
        title: image.name,
        type: "image",
      },
    })

    await updateUser({ ...member, image: uploadResult.url })

    return c.json({ url: uploadResult.url })
  } catch (_error) {
    return c.json({ error: "Failed to upload image" }, 500)
  }
})
