import crypto from "node:crypto"
import { Hono } from "hono"
import sharp from "sharp"
import { upload } from "../../lib/minio"
import { getSafeUrl } from "../../utils/ssrf"

export const resize = new Hono()

// GET /resize?url=<image-url>&w=180&h=180&fit=cover&q=100
// Downloads image, resizes it, uploads to MinIO, and returns permanent URL
resize.get("/", async (c) => {
  try {
    const url = c.req.query("url")
    const width = Number.parseInt(
      c.req.query("w") || c.req.query("width") || "0",
      10,
    )
    const height = Number.parseInt(
      c.req.query("h") || c.req.query("height") || "0",
      10,
    )
    const fit = (c.req.query("fit") || "cover") as
      | "cover"
      | "contain"
      | "fill"
      | "inside"
      | "outside"
    const quality = Number.parseInt(
      c.req.query("q") || c.req.query("quality") || "100",
      10,
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

    // Security check: Prevent SSRF and DNS Rebinding
    // We resolve the URL to an IP and use that IP for the request (for HTTP)
    let safeUrl: string
    let originalHost: string
    try {
      const result = await getSafeUrl(fullUrl)
      safeUrl = result.safeUrl
      originalHost = result.originalHost
    } catch (error: any) {
      // Sanitize error to prevent internal IP leakage
      console.error("❌ SSRF validation failed:", error.message)
      c.header("Cache-Control", "no-cache, no-store, must-revalidate")
      return c.json({ error: "Requested URL is not allowed" }, 400)
    }

    console.log(`🖼️  Resizing image: ${fullUrl} → ${width}x${height}`)

    let buffer: Buffer

    // Try HTTP first, fallback to filesystem for local dev
    try {
      let currentUrl = fullUrl
      let redirects = 0
      const maxRedirects = 5
      let response: Response

      // Security: Manual redirect handling loop
      // Standard fetch follows redirects blindly, bypassing our initial IP check
      while (true) {
        // If this is a redirect, we need to validate the new URL
        if (redirects > 0) {
          try {
            const result = await getSafeUrl(currentUrl)
            safeUrl = result.safeUrl
            originalHost = result.originalHost
          } catch (error: any) {
            console.error(
              "❌ SSRF validation failed on redirect:",
              error.message,
            )
            throw new Error("Requested URL is not allowed")
          }
        }

        // Fetch using the validated IP address (safeUrl) and original Host header.
        response = await fetch(safeUrl, {
          headers: {
            Host: originalHost,
            "User-Agent": "Chrry/1.0",
          },
          redirect: "manual", // Critical: Stop automatic redirects
        })

        if (response.status >= 300 && response.status < 400) {
          if (redirects >= maxRedirects) {
            throw new Error("Too many redirects")
          }

          const location = response.headers.get("Location")
          if (!location) {
            throw new Error("Redirect without Location header")
          }

          // Resolve relative URLs against the CURRENT original URL
          try {
            currentUrl = new URL(location, currentUrl).toString()
          } catch (_e) {
            throw new Error("Invalid redirect URL")
          }

          console.log(`🔀 Redirecting to: ${currentUrl}`)
          redirects++
          continue
        }

        break
      }

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
          const fs = await import("node:fs/promises")
          const path = await import("node:path")
          const absolutePath = path.resolve(process.cwd(), localPath)

          // Security: Prevent path traversal
          const publicDir = path.resolve(process.cwd(), "public")
          if (!absolutePath.startsWith(publicDir)) {
            throw new Error("Access denied: Path traversal detected")
          }

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
      .createHash("sha256")
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
    // The SHA-256 cache key ensures unique URLs for different sizes/images
    c.header("Cache-Control", "public, max-age=31536000, immutable")
    c.header("Expires", new Date(Date.now() + 31536000000).toUTCString())

    // Redirect to the MinIO URL
    return c.redirect(uploadResult.url, 301)
  } catch (error: any) {
    console.error("❌ Image resize error:", error)
    c.header("Cache-Control", "no-cache, no-store, must-revalidate")
    c.header("Pragma", "no-cache")
    c.header("Expires", "0")
    // Sanitize error message to prevent information leakage
    const safeMessage = error.message?.includes("Access to private IP")
      ? "Requested URL is not allowed"
      : "Failed to resize image"
    return c.json({ error: safeMessage }, 500)
  }
})
