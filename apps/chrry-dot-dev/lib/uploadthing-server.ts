import { UTApi } from "uploadthing/server"
import sharp from "sharp"
import captureException from "./captureException"
import dns from "dns"
import net from "net"
import { parse as parseDomain } from "tldts"
import { isDevelopment } from "chrry/utils"
// Two separate UploadThing accounts
const chatUtapi = new UTApi({
  token: process.env.UPLOADTHING_TOKEN, // For chat messages/files
})

const appsUtapi = new UTApi({
  token: process.env.UPLOADTHING_APPS_TOKEN, // For app profiles/images
})

// Get UTApi instance based on context
function getUtapi(context: "chat" | "apps" = "chat"): UTApi {
  return context === "apps" ? appsUtapi : chatUtapi
}

const SUPPORTED_TYPES = {
  image: ["image/png", "image/jpeg", "image/webp"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  pdf: ["application/pdf"],
  text: [
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/xml",
    "text/html",
    "text/css",
    "text/javascript",
    "text/typescript",
    "text/jsx",
    "text/tsx",
    "text/py",
    "text/java",
    "text/c",
    "text/cpp",
    "text/h",
    "text/hpp",
    "text/cs",
    "text/php",
    "text/rb",
    "text/go",
    "text/rs",
    "text/swift",
    "text/kt",
    "text/scala",
    "text/sh",
    "text/yaml",
    "text/yml",
    "text/toml",
    "text/ini",
    "text/conf",
    "text/log",
  ],
}

function validateFileType(
  type: string,
):
  | "image"
  | "audio"
  | "video"
  | "pdf"
  | "text"
  | "md"
  | "json"
  | "csv"
  | "xml"
  | "html"
  | "css"
  | "js"
  | "ts"
  | "tsx"
  | "jsx"
  | "py"
  | "java"
  | "c"
  | "cpp"
  | "h"
  | "hpp"
  | "cs"
  | "php"
  | "rb"
  | "go"
  | "rs"
  | "swift"
  | "kt"
  | "scala"
  | "sh"
  | "yaml"
  | "yml"
  | "toml"
  | "ini"
  | "conf"
  | "log"
  | undefined {
  if (SUPPORTED_TYPES.image.includes(type)) return "image"
  if (SUPPORTED_TYPES.audio.includes(type)) return "audio"
  if (SUPPORTED_TYPES.video.includes(type)) return "video"
  if (SUPPORTED_TYPES.pdf.includes(type)) return "pdf"
  if (SUPPORTED_TYPES.text.includes(type)) return "text"
}

/**
 * Upload a file from Replicate to UploadThing for permanent storage
 * @param url - The temporary Replicate file URL
 * @param messageId - The message ID for unique filename
 * @param options - Optional upload options
 * @returns Permanent UploadThing URL and file metadata
 */
export async function upload({
  url,
  messageId,
  options = {},
  context = "chat",
}: {
  url: string
  messageId: string
  options?: {
    maxWidth?: number
    maxHeight?: number
    width?: number
    height?: number
    fit?: "cover" | "contain" | "fill" | "inside" | "outside"
    position?: "top" | "bottom" | "left" | "right" | "center"
    title?: string
    type?: "image" | "audio" | "video" | "pdf" | "text"
  }
  context?: "chat" | "apps" // Use "apps" for app profile images
}): Promise<{ url: string; width?: number; height?: number; title?: string }> {
  // Only allow images from trusted hosts (add your domains as needed)
  const ALLOWED_HOSTNAMES = [
    "replicate.delivery", // Replicate temporary files
    "replicate.com",
    "utfs.io", // UploadThing
    "uploadthing.com",
    // Add more trusted domains here as needed
  ]
  try {
    // Validate URL to prevent SSRF attacks
    const parsedUrl = new URL(url)

    // Only allow HTTPS or Data URLs
    if (
      // !isDevelopment &&
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "data:"
    ) {
      throw new Error("Only HTTPS or Data URLs are allowed")
    }

    // Skip domain/IP checks for Data URLs
    if (parsedUrl.protocol !== "data:") {
      // Domain root allowlist via tldts
      const parsedDomain = parseDomain(parsedUrl.hostname)
      // parsedDomain.domain already includes the publicSuffix
      // e.g., for "abc.replicate.delivery" → domain is "replicate.delivery"
      const rootDomain = parsedDomain.domain || parsedUrl.hostname
      const isAllowed = ALLOWED_HOSTNAMES.includes(rootDomain)
      if (!isAllowed) {
        throw new Error(`Image host not allowed: ${rootDomain}`)
      }

      // Check if hostname matches allowed domains (including subdomains)
      const isAllowedDomain = ALLOWED_HOSTNAMES.some(
        (domain) =>
          parsedUrl.hostname === domain ||
          parsedUrl.hostname.endsWith(`.${domain}`),
      )

      if (!isAllowedDomain) {
        throw new Error(
          `URL domain not allowed. Only ${ALLOWED_HOSTNAMES.join(", ")} are permitted`,
        )
      }

      // Prevent access to private IP ranges
      const hostname = parsedUrl.hostname
      const privateIpPatterns = [
        /^127\./, // localhost
        /^10\./, // private class A
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // private class B
        /^192\.168\./, // private class C
        /^169\.254\./, // link-local
        /^::1$/, // IPv6 localhost
        /^fc00:/, // IPv6 private
        /^fe80:/, // IPv6 link-local
      ]

      if (privateIpPatterns.some((pattern) => pattern.test(hostname))) {
        throw new Error("Access to private IP addresses is not allowed")
      }

      // Resolve DNS for hostname to check resolved IPs against private ranges
      let addresses
      try {
        addresses = await dns.promises.lookup(parsedUrl.hostname, { all: true })
      } catch (e) {
        throw new Error("Failed to resolve image hosting domain")
      }
      // Checks for private/reserved/public addresses by inspecting resolved IPs
      const isIpPrivate = (ip: string) => {
        if (net.isIPv4(ip)) {
          // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16
          return (
            ip.startsWith("10.") ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
            ip.startsWith("192.168.") ||
            ip.startsWith("127.") ||
            ip.startsWith("169.254.")
          )
        } else if (net.isIPv6(ip)) {
          // IPv6: localhost (::1), link-local (fe80::/10), private (fc00::/7)
          return (
            ip === "::1" ||
            ip.startsWith("fc00:") ||
            ip.startsWith("fd00:") || // part of IPv6 private range
            ip.startsWith("fe80:")
          )
        }
        return false
      }
      // If ANY resolved IP is private, abort!
      if (addresses.some((addr) => isIpPrivate(addr.address))) {
        throw new Error("Resolved address is private or local; access denied")
      }
    }

    // Download the file
    const response = await fetch(parsedUrl)
    if (!response.ok)
      throw new Error(`Failed to download file: ${response.status}`)

    const blob = await response.blob()
    let processedBuffer = await blob.arrayBuffer()

    const fileType = validateFileType(blob.type)

    if (!fileType) {
      return {
        url: "",
        width: undefined,
        height: undefined,
        title: undefined,
      }
    }

    const fileName = `${messageId}-${Date.now()}.${blob.type}`

    let width, height

    if (fileType === "image") {
      // Get original image metadata
      const sharpImage = sharp(processedBuffer)
      const metadata = await sharpImage.metadata()

      // Process the image if resize options are provided
      let processedImage = sharpImage

      if (
        options.width ||
        options.height ||
        options.maxWidth ||
        options.maxHeight
      ) {
        const resizeOptions: any = {}

        // Handle exact dimensions
        if (options.width) resizeOptions.width = options.width
        if (options.height) resizeOptions.height = options.height

        // Handle max dimensions (fallback)
        if (!options.width && options.maxWidth)
          resizeOptions.width = Math.min(metadata.width || 0, options.maxWidth)
        if (!options.height && options.maxHeight)
          resizeOptions.height = Math.min(
            metadata.height || 0,
            options.maxHeight,
          )

        // Set fit and position
        if (options.fit) {
          resizeOptions.fit = options.fit
        }
        if (options.position) {
          resizeOptions.position = options.position
        }

        processedImage = processedImage.resize(resizeOptions)

        // Get the new metadata after processing
        const newMetadata = await processedImage.metadata()
        width = newMetadata.width
        height = newMetadata.height
      } else {
        width = metadata.width
        height = metadata.height
      }

      // Convert processed image back to buffer
      const imageBuffer = await processedImage.png().toBuffer()
      // Convert Buffer to ArrayBuffer
      processedBuffer = new Uint8Array(imageBuffer).buffer
    }

    const file = new File([processedBuffer], fileName, {
      type: fileType === "image" ? "image/png" : blob.type,
    })

    console.log(
      `📦 File created: ${file.name}, size: ${file.size}, type: ${file.type}`,
    )

    console.log("☁️ Uploading to UploadThing...")

    // Upload to UploadThing (use context-specific account)
    const utapi = getUtapi(context)
    const uploadResult = await utapi.uploadFiles([file])

    console.log("📤 Upload result:", JSON.stringify(uploadResult, null, 2))

    if (!uploadResult?.[0] || uploadResult[0].error) {
      console.error(
        "❌ UploadThing error details:",
        JSON.stringify(uploadResult?.[0]?.error, null, 2),
      )

      return {
        url: "",
        width: undefined,
        height: undefined,
        title: undefined,
      }
    }

    // UploadThing returns the URL in the data object
    const permanentUrl =
      uploadResult[0].data?.ufsUrl || (uploadResult[0] as any).url
    console.log("✅ File uploaded successfully:", permanentUrl)

    return {
      url: permanentUrl,
      width,
      height,
      title: options.title || fileName,
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Failed to upload file:", error)
    return {
      url: "",
      width: undefined,
      height: undefined,
      title: undefined,
    }
  }
}

/**
 * Delete an image from UploadThing (optional cleanup)
 * @param url - The file key from UploadThing URL
 */
export async function deleteFile(
  url: string,
  context: "chat" | "apps" = "chat",
): Promise<void> {
  try {
    const pathSegments = url.split("/").filter(Boolean)

    if (pathSegments?.length >= 1 && url.includes("/f/")) {
      const fileKey = pathSegments[pathSegments.length - 1]

      if (fileKey) {
        const utapi = getUtapi(context)
        await utapi.deleteFiles([fileKey])
        console.log("🗑️ Deleted image from UploadThing:", fileKey)
      }
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Failed to delete image:", error)
    // Don't throw - deletion failures shouldn't break the app
  }
}
