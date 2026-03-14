/**
 * Upload DMG files to MinIO via SSH (bypasses Cloudflare)
 * Run from apps/api: node upload-dmgs.ts
 *
 * Strategy: SCP files to server → SSH run mc upload from localhost:9000
 */

import "dotenv/config"
import { execFileSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SSH_HOST = process.env.SSH_HOST
const BUCKET = process.env.S3_BUCKET_NAME_INSTALLS
const MINIO_ALIAS = "chrry"
const MINIO_INTERNAL = process.env.S3_INTERNAL_ENDPOINT
const MINIO_USER = process.env.S3_ACCESS_KEY_ID
const MINIO_PASS = process.env.S3_SECRET_ACCESS_KEY
const PUBLIC_URL = process.env.S3_PUBLIC_URL

const INSTALLS_PATH = "../../public/installs"
const installsDir = join(__dirname, INSTALLS_PATH)

const SAFE_DMG_FILE = /^[A-Za-z0-9._-]+\.dmg$/
function assertSafeDmgFile(file: string) {
  if (!SAFE_DMG_FILE.test(file)) {
    throw new Error(`Unsafe DMG filename: ${file}`)
  }
}

function ssh(cmd: string): string {
  console.log(`  $ ${cmd}`)
  return execFileSync("ssh", [SSH_HOST!, "--", cmd], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim()
}

function scp(localPath: string, remotePath: string) {
  execFileSync("scp", [localPath, `${SSH_HOST!}:${remotePath}`], {
    stdio: "inherit",
  })
}

async function uploadDMGs() {
  console.log("🚀 Uploading DMGs to MinIO via SSH (bypasses Cloudflare)...")
  console.log(`🖥️  Server: ${SSH_HOST}`)
  console.log(`📦 Bucket: ${BUCKET}`)
  console.log(`🔗 MinIO: ${MINIO_INTERNAL} (internal, no Cloudflare)`)
  console.log("")

  // Get DMG files (exclude emoji versions)
  const files = readdirSync(installsDir).filter(
    (f) => f.endsWith(".dmg") && !f.includes("🍒"),
  )

  if (files.length === 0) {
    console.log("❌ No DMG files found in public/installs/")
    process.exit(1)
  }

  console.log(`Found ${files.length} DMG file(s):`)
  files.forEach((f) => console.log(`  - ${f}`))
  console.log("")

  // Step 1: Setup mc alias on server (connect to localhost, no Cloudflare)
  console.log("🔧 Setting up MinIO client on server...")
  try {
    ssh(
      `mc alias set ${MINIO_ALIAS} ${MINIO_INTERNAL} ${MINIO_USER} ${MINIO_PASS} --api S3v4`,
    )
    console.log("✅ mc alias set\n")
  } catch (e: any) {
    // mc might not be installed, try installing
    console.log("📥 Installing mc (MinIO client)...")
    ssh(
      "curl -sO https://dl.min.io/client/mc/release/linux-amd64/mc && chmod +x mc && mv mc /usr/local/bin/mc",
    )
    ssh(
      `mc alias set ${MINIO_ALIAS} ${MINIO_INTERNAL} ${MINIO_USER} ${MINIO_PASS} --api S3v4`,
    )
    console.log("✅ mc installed and alias set\n")
  }

  // Step 2: Ensure bucket exists
  console.log(`📦 Ensuring bucket '${BUCKET}' exists...`)
  try {
    ssh(`mc ls ${MINIO_ALIAS}/${BUCKET}`)
    console.log("✅ Bucket exists\n")
  } catch {
    ssh(`mc mb ${MINIO_ALIAS}/${BUCKET}`)
    ssh(`mc anonymous set download ${MINIO_ALIAS}/${BUCKET}`)
    console.log("✅ Bucket created with public read\n")
  }

  // Step 3: SCP + upload each file
  for (const file of files) {
    assertSafeDmgFile(file)
    const localPath = join(installsDir, file)
    const remoteTmp = `/tmp/${file}`
    const key = `installs/${file}`

    console.log(`📤 ${file}`)
    console.log(`  1/2 SCP to server...`)
    scp(localPath, remoteTmp)

    console.log(`  2/2 Uploading to MinIO...`)
    ssh(`mc cp "${remoteTmp}" ${MINIO_ALIAS}/${BUCKET}/${key}`)
    ssh(`rm -f "${remoteTmp}"`)

    const url = `${PUBLIC_URL}/${BUCKET}/${key}`
    console.log(`  ✅ ${url}\n`)
  }

  console.log("🎉 All installers ready for download!\n")
  console.log("📍 Available at:")
  files.forEach((f) => {
    console.log(`   ${PUBLIC_URL}/${BUCKET}/installs/${f}`)
  })
}

uploadDMGs().catch((e) => {
  console.error("❌ Upload failed:", e.message)
  process.exit(1)
})
