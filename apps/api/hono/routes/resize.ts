import { Hono } from "hono"
import sharp from "sharp"
import { upload } from "../../lib/minio"
import crypto from "crypto"

export const resize = new Hono()

// GET /resize?url=<image-url>&w=180&h=180&fit=cover&q=100
// Downloads image, resizes it, uploads to MinIO, and returns permanent URL
resize.get("/", async (c) => {
  try {
    const url = c.req.query("url")
    const width = Number.parseInt(
      c.req.query("w") || c.req.query("width") || "0",
    )
    const height = Number.parseInt(
      c.req.query("h") || c.req.query("height") || "0",
    )
    const fit = (c.req.query("fit") || "cover") as
      | "cover"
      | "contain"
      | "fill"
      | "inside"
      | "outside"
    const quality = Number.parseInt(
      c.req.query("q") || c.req.query("quality") || "100",
    )

    if (!url) {
      c.header("Cache-Control", "no-cache, no-store, must-revalidate")
      return c.json({ error: "Missing 'url' parameter" }, 400)
    }

    if (!width && !height) {
      c.header("Cache-Control", "no-cache, no-store, must-revalidate")
      return c.json(
        { error: "Must specify at least 'w' (width) or 'h' (height)" },
        400,
      )
    }

    // Handle relative paths (e.g., /images/apps/vex.png)
    let fullUrl = url
    let useFilesystem = false
    let localPath = ""

    if (url.startsWith("/")) {
      // For static files, use the frontend server URL
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173"
      fullUrl = `${frontendUrl}${url}`

      // If localhost, prepare filesystem fallback
      if (frontendUrl.includes("localhost")) {
        useFilesystem = true
        localPath = `./public${url}` // Relative to API root
      }

      console.log(`🔗 Converted relative path: ${url} → ${fullUrl}`)
    }

    // Replace search.chrry.ai with chrry.ai for image paths
    fullUrl = fullUrl.replace("search.chrry.ai", "chrry.ai")

    console.log(`🖼️  Resizing image: ${fullUrl} → ${width}x${height}`)

    let buffer: Buffer

    // Try HTTP first, fallback to filesystem for local dev
    try {
      const response = await fetch(fullUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    } catch (fetchError: any) {
      // If fetch failed and we're in local mode, try filesystem
      if (useFilesystem && localPath) {
        console.log(`⚠️  HTTP fetch failed, trying filesystem: ${localPath}`)
        try {
          const fs = await import("fs/promises")
          const path = await import("path")
          const absolutePath = path.resolve(process.cwd(), localPath)
          buffer = await fs.readFile(absolutePath)
          console.log(`✅ Loaded from filesystem: ${absolutePath}`)
        } catch (fsError: any) {
          console.error(`❌ Filesystem read failed:`, fsError.message)
          c.header("Cache-Control", "no-cache, no-store, must-revalidate")
          c.header("Pragma", "no-cache")
          c.header("Expires", "0")
          return c.json(
            { error: `Failed to load image: ${fetchError.message}` },
            500,
          )
        }
      } else {
        console.error(`❌ Failed to fetch image:`, fetchError.message)
        c.header("Cache-Control", "no-cache, no-store, must-revalidate")
        c.header("Pragma", "no-cache")
        c.header("Expires", "0")
        return c.json(
          { error: `Failed to fetch image: ${fetchError.message}` },
          500,
        )
      }
    }

    // Get original image metadata
    const metadata = await sharp(buffer).metadata()
    console.log(
      `📐 Original image: ${metadata.width}x${metadata.height}, requested: ${width}x${height}`,
    )

    // Standard high-quality resize
    // Now that we request 2x density (e.g. 96px for 48px icon),
    // standard Lanczos3 is perfect and avoids over-processing artifacts
    const processedBuffer = await sharp(buffer)
      .resize({
        width,
        height,
        fit,
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .toBuffer()

    // Determine output format (default to webp for best quality/size)
    const format = c.req.query("fmt") === "png" ? "png" : "webp"

    let resizedBuffer: Buffer
    if (format === "png") {
      resizedBuffer = await sharp(processedBuffer)
        .png({ quality, compressionLevel: 9 })
        .toBuffer()
    } else {
      resizedBuffer = await sharp(processedBuffer)
        .webp({ quality: 95, lossless: false, nearLossless: false })
        .toBuffer()
    }

    console.log(
      `✅ Image resized (${format}): ${buffer.length} → ${resizedBuffer.length} bytes`,
    )

    // Convert to base64 for upload
    const base64 = resizedBuffer.toString("base64")

    // Generate unique ID for this resized image
    // v6: Added format support
    const hash = crypto
      .createHash("md5")
      .update(`v6-${url}-${width}x${height}-${format}`)
      .digest("hex")

    // Upload to MinIO
    const uploadResult = await upload({
      url: `data:image/${format};base64,${base64}`,
      messageId: `icon-${hash}.${format}`,
      options: {
        width,
        height,
        fit,
        title: `${width}x${height} icon`,
      },
      context: "apps", // Store in apps bucket
    })

    console.log(`✅ Uploaded to MinIO: ${uploadResult.url}`)

    // Set aggressive cache headers since MinIO URLs are permanent
    // The MD5 hash ensures unique URLs for different sizes/images
    c.header("Cache-Control", "public, max-age=31536000, immutable")
    c.header("Expires", new Date(Date.now() + 31536000000).toUTCString())

    // Redirect to the MinIO URL
    return c.redirect(uploadResult.url, 301)
  } catch (error: any) {
    console.error("❌ Image resize error:", error)
    c.header("Cache-Control", "no-cache, no-store, must-revalidate")
    c.header("Pragma", "no-cache")
    c.header("Expires", "0")
    return c.json({ error: error.message || "Failed to resize image" }, 500)
  }
})
