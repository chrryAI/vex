#!/usr/bin/env node

/**
 * SCSS Watcher - Auto-converts SCSS modules to TypeScript styles
 * Watches for changes in .module.scss files and regenerates .styles.ts
 */

const fs = require("fs")
const path = require("node:path")
const { execSync } = require("child_process")

const WATCH_DIR = path.join(__dirname, "../packages/ui")
const CONVERTER_SCRIPT = path.join(__dirname, "scss-to-universal.js")

console.log("👀 SCSS Watcher Started")
console.log(`📁 Watching: ${WATCH_DIR}`)
console.log(`🔄 Converter: ${CONVERTER_SCRIPT}\n`)

// Track file modification times to debounce
const fileTimestamps = new Map()
const DEBOUNCE_MS = 100

const convertFile = (filePath) => {
  const now = Date.now()
  const lastModified = fileTimestamps.get(filePath) || 0

  // Debounce: skip if file was just processed
  if (now - lastModified < DEBOUNCE_MS) {
    return
  }

  fileTimestamps.set(filePath, now)

  const relativePath = path.relative(process.cwd(), filePath)
  console.log(`\n🔄 Change detected: ${relativePath}`)

  try {
    execSync(`node "${CONVERTER_SCRIPT}" "${filePath}"`, {
      stdio: "inherit",
    })

    // Touch the generated .styles.ts file to trigger hot reload
    const stylesFile = filePath.replace(".module.scss", ".styles.ts")
    if (fs.existsSync(stylesFile)) {
      const time = new Date()
      fs.utimesSync(stylesFile, time, time)
      console.log(`🔥 Hot reload triggered!`)
    }

    console.log(`✅ Converted successfully!`)
  } catch (error) {
    console.error(`❌ Conversion failed:`, error.message)
  }
}

// Initial conversion of all existing files
console.log("🚀 Converting existing SCSS files...\n")
try {
  execSync(`node "${CONVERTER_SCRIPT}" --all`, { stdio: "inherit" })
  console.log("\n✅ Initial conversion complete!\n")
} catch (error) {
  console.error("❌ Initial conversion failed:", error.message)
}

// Watch for changes
console.log("👁️  Watching for changes... (Press Ctrl+C to stop)\n")

fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
  if (!filename || !filename.endsWith(".module.scss")) {
    return
  }

  const filePath = path.join(WATCH_DIR, filename)

  // Check if file exists (it might have been deleted)
  if (!fs.existsSync(filePath)) {
    console.log(`🗑️  File deleted: ${filename}`)
    return
  }

  convertFile(filePath)
})

// Keep the process running
process.on("SIGINT", () => {
  console.log("\n\n👋 SCSS Watcher stopped")
  process.exit(0)
})
