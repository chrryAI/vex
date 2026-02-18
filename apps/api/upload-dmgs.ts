/**
 * Upload DMG files to MinIO
 * Run from apps/api: npx tsx upload-dmgs.ts
 */

import "dotenv/config" // Load .env file
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// MinIO configuration from .env
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true,
})

const BUCKET = "chrry-installs" // Production bucket for app installers
const INSTALLS_PATH = "../../public/installs"
const PUBLIC_URL = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT

// Ensure bucket exists (same logic as minio.ts)
async function ensureBucketExists(bucket: string): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }))
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
      console.log(`✅ Bucket created: ${bucket}`)
    } else {
      throw err
    }
  }
}

async function uploadDMGs() {
  console.log("🚀 Uploading DMGs to MinIO...")
  console.log(`📦 Bucket: ${BUCKET} (production)`)
  console.log(`🔗 Endpoint: ${process.env.S3_ENDPOINT}`)
  console.log("")

  // Ensure bucket exists
  await ensureBucketExists(BUCKET)
  console.log("")

  // Get all DMG files (exclude emoji versions)
  const installsDir = join(__dirname, INSTALLS_PATH)
  const files = readdirSync(installsDir).filter(
    (f) => f.endsWith(".dmg") && !f.includes("🍒"),
  )

  console.log(`Found ${files.length} DMG files:`)
  files.forEach((f) => console.log(`  - ${f}`))
  console.log("")

  // Upload each file
  for (const file of files) {
    const filePath = join(installsDir, file)
    const fileBuffer = readFileSync(filePath)
    const key = `installs/${file}`

    console.log(
      `📤 Uploading ${file} (${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB)...`,
    )

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: fileBuffer,
          ContentType: "application/x-apple-diskimage",
          CacheControl: "public, max-age=31536000",
        }),
      )

      const url = `${PUBLIC_URL}/${BUCKET}/${key}`
      console.log(`✅ ${url}`)
    } catch (error: any) {
      console.error(`❌ Failed to upload ${file}:`, error.message)
    }
  }

  console.log("")
  console.log("✅ Deployment complete!")
  console.log("")
  console.log("📍 Apps available at:")
  files.forEach((file) => {
    console.log(`   ${PUBLIC_URL}/${BUCKET}/installs/${file}`)
  })
  console.log("")
  console.log("🎉 Ready to announce!")
}

uploadDMGs().catch(console.error)
