#!/usr/bin/env node

/**
 * Download All Test Media
 * Master script to download videos, images, and PDFs for E2E testing
 */

const { execSync } = require("child_process")
const path = require("path")

const scripts = [
  { name: "Videos", file: "download-test-videos.js", emoji: "🎬" },
  { name: "Images", file: "download-test-images.js", emoji: "🖼️" },
  { name: "Audio", file: "download-test-audio.js", emoji: "🎵" },
  { name: "PDFs", file: "download-test-pdfs.js", emoji: "📄" },
]

async function main() {
  console.log("🚀 Downloading All Test Media\n")
  console.log("=".repeat(50))

  for (const script of scripts) {
    console.log(`\n${script.emoji} Starting ${script.name}...\n`)

    try {
      execSync(`node ${path.join(__dirname, script.file)}`, {
        stdio: "inherit",
        cwd: __dirname,
      })
      console.log(`\n✅ ${script.name} complete!`)
    } catch (error) {
      console.error(`\n❌ ${script.name} failed:`, error.message)
    }

    console.log("\n" + "=".repeat(50))
  }

  console.log("\n🎉 All downloads complete!")
  console.log("\n📁 Test media locations:")
  console.log("   - Videos: packages/waffles/src/shared/video/")
  console.log("   - Images: packages/waffles/src/shared/image/")
  console.log("   - Audio: packages/waffles/src/shared/audio/")
  console.log("   - PDFs: packages/waffles/src/shared/pdf/")
}

main().catch(console.error)
