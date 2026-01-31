import { Hono } from "hono"
import slugify from "slug"
import { createHash } from "crypto"
import { upload } from "../../lib/minio"
import { getMember, getGuest } from "../lib/auth"
import { scanFileForMalware } from "../../lib/security"

export const image = new Hono()

// POST /image - Upload an app icon/logo image
image.post("/", async (c) => {
  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const formData = await c.req.formData()

  const file = formData.get("file") as File | null
  const draftId = formData.get("draftId") as string | null

  if (!file) {
    return c.json({ error: "No file provided" }, 400)
  }

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return c.json({ error: "File must be an image" }, 400)
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return c.json({ error: "File size must be less than 5MB" }, 400)
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Scan for malware
    const scanResult = await scanFileForMalware(buffer)

    if (!scanResult.safe) {
      console.error("🚨 Malware detected in app image")
      return c.json(
        {
          error: `File failed security scan${scanResult.threat ? `: ${scanResult.threat}` : ""}`,
        },
        400,
      )
    }

    const base64 = buffer.toString("base64")

    // Generate content hash for deduplication (same image = same hash = cached)
    // Using SHA256 for security compliance (MD5 flagged by security scanners)
    const contentHash = createHash("sha256")
      .update(buffer)
      .digest("hex")
      .substring(0, 32) // Use first 32 chars for shorter filenames

    console.log("📤 Uploading app image:", {
      name: file.name,
      type: file.type,
      size: file.size,
      contentHash,
      draftId,
    })

    // Upload with 500x500 dimensions for app icons
    // Use content hash as messageId for deduplication
    const uploadResult = await upload({
      url: `data:${file.type};base64,${base64}`,
      messageId: `icon-${contentHash}`,
      options: {
        width: 500, // App icon size
        height: 500,
        fit: "cover", // Crop to fit
        position: "center",
        title: file.name,
      },
      context: "apps",
    })

    console.log("✅ App image uploaded successfully:", uploadResult.url)

    // TODO: If draftId provided, update draft in database
    // if (draftId) {
    //   await db.update(appDrafts)
    //     .set({ image: uploadResult.url })
    //     .where(eq(appDrafts.id, draftId))
    // }

    return c.json({
      success: true,
      url: uploadResult.url,
      draftId: draftId || undefined,
      metadata: {
        name: file.name,
        type: file.type,
        size: file.size,
        dimensions: "500x500",
      },
    })
  } catch (error: any) {
    console.error("❌ Error uploading app image:", error)
    return c.json({ error: error.message || "Failed to upload image" }, 500)
  }
})
