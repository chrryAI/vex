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
    const width = parseInt(c.req.query("w") || c.req.query("width") || "0")
    const height = parseInt(c.req.query("h") || c.req.query("height") || "0")
    const fit = (c.req.query("fit") || "cover") as
      | "cover"
      | "contain"
      | "fill"
      | "inside"
      | "outside"
    const quality = parseInt(
      c.req.query("q") || c.req.query("quality") || "100",
    )

    if (!url) {
      return c.json({ error: "Missing 'url' parameter" }, 400)
    }

    if (!width && !height) {
      return c.json(
        { error: "Must specify at least 'w' (width) or 'h' (height)" },
        400,
      )
    }

    // Handle relative paths (e.g., /images/apps/vex.png)
    let fullUrl = url
    if (url.startsWith("/")) {
      // For static files, use the frontend server URL
      // In Docker: use internal service name (http://flash:5173)
      // In local dev: use FRONTEND_URL or localhost
      const isDocker =
        process.env.DOCKER === "true" || process.env.NODE_ENV === "production"
      const frontendUrl = isDocker
        ? "http://flash:5173" // Docker service name
        : process.env.FRONTEND_URL || "http://localhost:5173"
      fullUrl = `${frontendUrl}${url}`
      console.log(
        `🔗 Converted relative path: ${url} → ${fullUrl} (Docker: ${isDocker})`,
      )
    }

    console.log(`🖼️  Resizing image: ${fullUrl} → ${width}x${height}`)

    // Fetch the original image
    const response = await fetch(fullUrl)
    if (!response.ok) {
      console.error(
        `❌ Failed to fetch image: ${response.status} ${response.statusText}`,
      )
      return c.json(
        { error: `Failed to fetch image: ${response.statusText}` },
        500,
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Get original image metadata
    const metadata = await sharp(buffer).metadata()
    console.log(
      `📐 Original image: ${metadata.width}x${metadata.height}, requested: ${width}x${height}`,
    )

    // Resize using Sharp - use 'inside' to prevent upscaling
    const resizeOptions: any = {
      fit: "inside", // Never upscale, only downscale if needed
      withoutEnlargement: true, // Prevent upscaling
      background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
    }
    if (width) resizeOptions.width = width
    if (height) resizeOptions.height = height

    const resizedBuffer = await sharp(buffer)
      .resize(resizeOptions)
      .png({ quality, compressionLevel: 9 })
      .toBuffer()

    console.log(
      `✅ Image resized: ${buffer.length} → ${resizedBuffer.length} bytes`,
    )

    // Convert to base64 for upload
    const base64 = resizedBuffer.toString("base64")

    // Generate unique ID for this resized image
    const hash = crypto
      .createHash("md5")
      .update(`${url}-${width}x${height}`)
      .digest("hex")

    // Upload to MinIO
    const uploadResult = await upload({
      url: `data:image/png;base64,${base64}`,
      messageId: `icon-${hash}`,
      options: {
        width,
        height,
        fit,
        title: `${width}x${height} icon`,
      },
      context: "apps", // Store in apps bucket
    })

    console.log(`✅ Uploaded to MinIO: ${uploadResult.url}`)

    // Redirect to the MinIO URL
    return c.redirect(uploadResult.url, 301)
  } catch (error: any) {
    console.error("❌ Image resize error:", error)
    return c.json({ error: error.message || "Failed to resize image" }, 500)
  }
})
