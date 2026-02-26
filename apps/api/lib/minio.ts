import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { isDevelopment } from "@chrryai/chrry/utils"
import { FetchHttpHandler } from "@smithy/fetch-http-handler"
import sharp from "sharp"
import { parse as parseDomain } from "tldts"
import { safeFetch } from "../utils/ssrf"
import { captureException } from "./captureException"

// Validate S3 configuration
if (
  !process.env.S3_ENDPOINT ||
  !process.env.S3_ACCESS_KEY_ID ||
  !process.env.S3_SECRET_ACCESS_KEY
) {
  console.warn("⚠️  S3 credentials not configured. Please add to .env:")
  console.warn("   S3_ENDPOINT=${MINIO_SERVER_URL}")
  console.warn("   S3_ACCESS_KEY_ID=${MINIO_ROOT_USER}")
  console.warn("   S3_SECRET_ACCESS_KEY=${MINIO_ROOT_PASSWORD}")
  console.warn("   S3_BUCKET_NAME=chrry-chat-files")
  console.warn("   S3_BUCKET_NAME_APPS=chrry-app-profiles")
  console.warn("   S3_PUBLIC_URL=${MINIO_SERVER_URL}")
}

// S3 Client Configuration with FetchHttpHandler for Bun compatibility
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true, // Required for MinIO/Coolify
  requestHandler: new FetchHttpHandler({
    requestTimeout: 30000, // 30 second timeout
  }),
})

// Bucket names for different contexts
const BUCKET_CHAT = process.env.S3_BUCKET_NAME || "chrry-chat-files"
const BUCKET_APPS = process.env.S3_BUCKET_NAME_APPS || "chrry-app-profiles"
const PUBLIC_URL = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT

// Get bucket name based on context
function getBucket(context: "chat" | "apps" = "chat"): string {
  return context === "apps" ? BUCKET_APPS : BUCKET_CHAT
}

// Track which buckets we've already verified exist
const verifiedBuckets = new Set<string>()

// Ensure bucket exists, create if not
async function ensureBucketExists(bucket: string): Promise<void> {
  if (verifiedBuckets.has(bucket)) return

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }))
    verifiedBuckets.add(bucket)
    console.log(`✅ Bucket verified: ${bucket}`)
  } catch (err: any) {
    if (
      err.name === "NotFound" ||
      err.Code === "NoSuchBucket" ||
      err.$metadata?.httpStatusCode === 404
    ) {
      console.log(`📦 Creating bucket: ${bucket}`)
      await s3Client.send(new CreateBucketCommand({ Bucket: bucket }))

      // Set public read policy for the bucket
      const publicPolicy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      }
      await s3Client.send(
        new PutBucketPolicyCommand({
          Bucket: bucket,
          Policy: JSON.stringify(publicPolicy),
        }),
      )
      console.log(`🔓 Public read policy set for: ${bucket}`)

      verifiedBuckets.add(bucket)
      console.log(`✅ Bucket created: ${bucket}`)
    } else {
      throw err
    }
  }
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
 * Upload a file to S3-compatible storage (MinIO via Coolify)
 * @param url - The temporary file URL or data URL
 * @param messageId - The message ID for unique filename
 * @param options - Optional upload options
 * @returns Permanent S3 URL and file metadata
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
  context?: "chat" | "apps"
}): Promise<{ url: string; width?: number; height?: number; title?: string }> {
  // Validate S3 is configured
  if (
    !process.env.S3_ENDPOINT ||
    !process.env.S3_ACCESS_KEY_ID ||
    !process.env.S3_SECRET_ACCESS_KEY
  ) {
    throw new Error(
      "S3 storage is not configured. Please add S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY to your .env file. See setup guide for details.",
    )
  }

  // Only allow files from trusted hosts
  const ALLOWED_HOSTNAMES = [
    "replicate.delivery", // Replicate temporary files
    "replicate.com",
    "utfs.io", // Legacy UploadThing (for migration)
    "uploadthing.com",
    "chrry.dev", // Our own MinIO server (minio.chrry.dev)
    "chrry.ai", // Our production MinIO server (minio.chrry.ai)
  ]
  try {
    // Validate URL to prevent SSRF attacks
    const parsedUrl = new URL(url)

    // Only allow HTTPS or Data URLs (HTTP allowed in development for internal Docker network)
    if (
      !isDevelopment &&
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "data:"
    ) {
      throw new Error("Only HTTPS or Data URLs are allowed")
    }

    // Skip domain/IP checks for Data URLs
    if (parsedUrl.protocol !== "data:") {
      // Domain root allowlist via tldts
      const parsedDomain = parseDomain(parsedUrl.hostname)
      const rootDomain = parsedDomain.domain || parsedUrl.hostname
      const isAllowed = ALLOWED_HOSTNAMES.includes(rootDomain)
      if (!isAllowed) {
        throw new Error(`File host not allowed: ${rootDomain}`)
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
    }

    // Download the file - data: URLs are safe (no network request), use native fetch
    // For http/https URLs, use safeFetch for SSRF protection
    const response =
      parsedUrl.protocol === "data:"
        ? await fetch(parsedUrl.toString())
        : await safeFetch(parsedUrl.toString())
    if (!response.ok)
      throw new Error(`Failed to download file: ${response.status}`)

    const blob = await response.blob()
    let processedBuffer = await blob.arrayBuffer()

    console.log(`🔍 Downloaded file type: "${blob.type}", size: ${blob.size}`)

    // Infer file type from URL extension if Content-Type is missing
    let inferredType = blob.type
    if (!inferredType || inferredType === "") {
      const urlPath = parsedUrl.pathname.toLowerCase()
      if (urlPath.endsWith(".png")) inferredType = "image/png"
      else if (urlPath.endsWith(".jpg") || urlPath.endsWith(".jpeg"))
        inferredType = "image/jpeg"
      else if (urlPath.endsWith(".webp")) inferredType = "image/webp"
      else if (urlPath.endsWith(".mp4")) inferredType = "video/mp4"
      else if (urlPath.endsWith(".webm")) inferredType = "video/webm"
      else if (urlPath.endsWith(".mp3")) inferredType = "audio/mpeg"
      else if (urlPath.endsWith(".wav")) inferredType = "audio/wav"
      else if (urlPath.endsWith(".pdf")) inferredType = "application/pdf"

      if (inferredType !== blob.type) {
        console.log(
          `🔍 Inferred file type from URL extension: "${inferredType}"`,
        )
      }
    }

    const detectedType = validateFileType(inferredType)
    const targetType = options.type

    // Enforce target type if specified
    if (targetType && detectedType && detectedType !== targetType) {
      throw new Error(
        `Invalid file type: expected ${targetType}, got ${detectedType}`,
      )
    }

    const fileType = detectedType || targetType

    if (!fileType) {
      console.error(`❌ Unsupported file type: "${inferredType}"`)
      return {
        url: "",
        width: undefined,
        height: undefined,
        title: undefined,
      }
    }

    // Generate file extension
    const ext =
      fileType === "image" ? "png" : inferredType.split("/")[1] || "bin"
    const fileName = `${messageId}-${Date.now()}.${ext}`

    let width: number = 0
    let height: number = 0

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
        width = newMetadata.width || 0
        height = newMetadata.height || 0
      } else {
        width = metadata.width || 0
        height = metadata.height || 0
      }

      // Convert processed image back to buffer
      const imageBuffer = await processedImage.png().toBuffer()
      processedBuffer = new Uint8Array(imageBuffer).buffer
    }

    console.log(
      `📦 File prepared: ${fileName}, size: ${processedBuffer.byteLength} bytes, type: ${fileType}`,
    )

    // Generate S3 key with context prefix
    const s3Key = `${context}/${fileName}`
    const bucket = getBucket(context)

    console.log(`☁️ Uploading to S3: ${bucket}/${s3Key}`)

    // Ensure bucket exists before uploading
    await ensureBucketExists(bucket)

    // Upload to S3
    const contentType = fileType === "image" ? "image/png" : blob.type

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucket,
        Key: s3Key,
        Body: Buffer.from(processedBuffer),
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
        // ACL: "public-read", // Uncomment if your bucket doesn't have public read policy
      },
    })

    await upload.done()

    // Construct public URL
    const publicUrl = `${PUBLIC_URL}/${bucket}/${s3Key}`

    console.log("✅ File uploaded successfully:", publicUrl)

    return {
      url: publicUrl,
      width,
      height,
      title: options.title || fileName,
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Failed to upload file:", error)
    throw error // Re-throw so the API route can handle it with proper JSON error
  }
}

/**
 * Delete a file from S3 storage
 * @param url - The S3 file URL
 * @param context - The storage context (chat or apps)
 */
export async function deleteFile(
  url: string,
  context: "chat" | "apps" = "chat",
): Promise<void> {
  try {
    const bucket = getBucket(context)
    const key = url.replace(`${PUBLIC_URL}/`, "")

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    )
  } catch (err) {
    captureException(err)
    console.error("❌ Failed to delete file:", err)
  }
}
