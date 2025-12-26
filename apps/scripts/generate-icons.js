#!/usr/bin/env node
/**
 * Generate Tauri app icons based on MODE environment variable
 *
 * Usage: MODE=blossom node scripts/generate-icons.js
 *
 * This script copies the appropriate mode-specific icons from
 * apps/extension/public/icons to apps/browser/src-tauri/icons
 * and generates the required .icns and .ico files for macOS and Windows
 */

import { copyFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { execSync } from "child_process"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Get mode from environment or default to 'vex'
const mode = process.env.MODE || "vex"

console.log(`🎨 Generating Tauri icons for mode: ${mode}`)

// Paths
const sourceIconsDir = join(__dirname, "../extension/public/icons")
const tauriIconsDir = join(__dirname, "../browser/src-tauri/icons")

// Icon sizes needed for Tauri
const sizes = [16, 32, 48, 128]

// Copy PNG icons
for (const size of sizes) {
  const sourceIcon = join(sourceIconsDir, `${mode}-icon-${size}.png`)
  const destIcon = join(tauriIconsDir, `${size}x${size}.png`)

  if (!existsSync(sourceIcon)) {
    console.error(`❌ Icon not found: ${sourceIcon}`)
    process.exit(1)
  }

  copyFileSync(sourceIcon, destIcon)
  console.log(`✅ Copied ${size}x${size}.png`)

  // Also copy @2x version for Retina displays
  if (size === 128) {
    const dest2x = join(tauriIconsDir, "128x128@2x.png")
    copyFileSync(sourceIcon, dest2x)
    console.log(`✅ Copied 128x128@2x.png`)
  }
}

// Copy main icon.png (1024x1024 or largest available)
const mainIcon = join(sourceIconsDir, `${mode}-icon-128.png`)
const destMainIcon = join(tauriIconsDir, "icon.png")
copyFileSync(mainIcon, destMainIcon)
console.log(`✅ Copied icon.png`)

// Generate .icns for macOS (requires iconutil on macOS)
if (process.platform === "darwin") {
  try {
    console.log("🍎 Generating .icns for macOS...")

    // Create iconset directory
    const iconsetDir = join(tauriIconsDir, "icon.iconset")
    execSync(`mkdir -p ${iconsetDir}`)

    // Copy icons to iconset with proper naming
    const iconsetSizes = [
      { size: 16, name: "icon_16x16.png" },
      { size: 32, name: "icon_16x16@2x.png" },
      { size: 32, name: "icon_32x32.png" },
      { size: 128, name: "icon_128x128.png" },
      { size: 128, name: "icon_256x256.png" }, // Upscale for 256
      { size: 128, name: "icon_512x512.png" }, // Upscale for 512
    ]

    for (const { size, name } of iconsetSizes) {
      const source = join(sourceIconsDir, `${mode}-icon-${size}.png`)
      const dest = join(iconsetDir, name)
      copyFileSync(source, dest)
    }

    // Generate .icns
    execSync(
      `iconutil -c icns ${iconsetDir} -o ${join(tauriIconsDir, "icon.icns")}`,
    )

    // Clean up iconset
    execSync(`rm -rf ${iconsetDir}`)

    console.log("✅ Generated icon.icns")
  } catch (error) {
    console.warn("⚠️  Could not generate .icns:", error.message)
    console.warn("   Skipping .icns generation (requires macOS with iconutil)")
  }
}

// Generate .ico for Windows (requires ImageMagick or similar)
try {
  console.log("🪟 Generating .ico for Windows...")

  // Try using ImageMagick convert
  const icons = sizes
    .map((size) => join(tauriIconsDir, `${size}x${size}.png`))
    .join(" ")
  execSync(`convert ${icons} ${join(tauriIconsDir, "icon.ico")}`)

  console.log("✅ Generated icon.ico")
} catch (error) {
  console.warn("⚠️  Could not generate .ico:", error.message)
  console.warn("   Skipping .ico generation (requires ImageMagick)")
}

console.log(`\n✨ Icon generation complete for ${mode}!`)
console.log(`   Icons saved to: ${tauriIconsDir}`)
