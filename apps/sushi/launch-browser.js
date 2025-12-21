#!/usr/bin/env node

import { spawn } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import { existsSync } from "fs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, "dist")

// Check if dist exists
if (!existsSync(distPath)) {
  console.error("❌ Error: dist directory not found!")
  console.log("💡 Run 'pnpm build' first to build the extension.")
  process.exit(1)
}

// Determine Chrome/Chromium executable path based on OS
const getChromeExecutable = () => {
  const platform = process.platform

  if (platform === "darwin") {
    // macOS - Try Chromium first, then fall back to Google Chrome
    const chromiumPath = "/Applications/Chromium.app/Contents/MacOS/Chromium"
    const chromePath =
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

    // Check if Chromium exists
    if (existsSync(chromiumPath)) {
      return chromiumPath
    }
    return chromePath
  } else if (platform === "win32") {
    // Windows
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  } else {
    // Linux
    return "chromium-browser"
  }
}

const chromeExecutable = getChromeExecutable()
const userDataDir = path.join(__dirname, ".chrome-dev-profile")

const browserName = chromeExecutable.includes("Chromium")
  ? "Chromium"
  : "Chrome"
console.log(`🚀 Launching ${browserName} with Sushi extension...`)
console.log(`📦 Extension path: ${distPath}`)
console.log(`👤 Profile: ${userDataDir}`)

// Launch Chrome with extension pre-loaded
const chromeArgs = [
  `--load-extension=${distPath}`,
  `--user-data-dir=${userDataDir}`,
  "--no-first-run",
  "--no-default-browser-check",
  // Optional: Enable remote debugging for auto-reload
  "--remote-debugging-port=9222",
]

const chrome = spawn(chromeExecutable, chromeArgs, {
  stdio: "inherit",
  detached: true,
})

chrome.on("error", (err) => {
  console.error("❌ Failed to launch Chrome:", err.message)
  console.log("💡 Make sure Chrome is installed at:", chromeExecutable)
  process.exit(1)
})

chrome.on("spawn", () => {
  console.log(`✅ ${browserName} launched with Sushi extension!`)
  console.log("🎯 Open a new tab (Cmd+T) to see Sushi instead of Google")
  console.log("")
  console.log("💡 Tips:")
  console.log("   - The extension will persist in this profile")
  console.log("   - Run 'pnpm dev:watch' to auto-rebuild on changes")
  console.log("   - Refresh the extension after rebuilds")
})

// Allow the process to exit while Chrome continues running
chrome.unref()
