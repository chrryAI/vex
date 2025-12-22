#!/usr/bin/env node

import { spawn, exec } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import { existsSync } from "fs"
import { promisify } from "util"

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, "dist")

// Check if dist exists
if (!existsSync(distPath)) {
  console.error("❌ Error: dist directory not found!")
  console.log("💡 Run 'pnpm build:dev' first to build the extension.")
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

console.log(`🔄 Restarting ${browserName} with Sushi extension...`)
console.log("")

// Step 1: Kill all Chrome/Chromium processes
console.log(`1️⃣  Closing all ${browserName} instances...`)
try {
  if (process.platform === "darwin") {
    // Kill both Chrome and Chromium to be safe
    await execAsync("pkill -9 'Google Chrome' || true")
    await execAsync("pkill -9 'Chromium' || true")
  } else if (process.platform === "win32") {
    await execAsync("taskkill /F /IM chrome.exe /T || exit 0")
    await execAsync("taskkill /F /IM chromium.exe /T || exit 0")
  } else {
    await execAsync("pkill -9 chrome || true")
    await execAsync("pkill -9 chromium || true")
  }
  console.log(`   ✅ ${browserName} processes closed`)
  // Wait a moment for processes to fully terminate
  await new Promise((resolve) => setTimeout(resolve, 1000))
} catch (err) {
  console.log("   ℹ️  No Chrome processes to close")
}

console.log("")
console.log(`2️⃣  Launching ${browserName} with Sushi extension...`)
console.log(`   📦 Extension: ${distPath}`)
console.log(`   👤 Profile: ${userDataDir}`)
console.log("")

// Step 2: Launch Chrome with extension
const chromeArgs = [
  `--load-extension=${distPath}`,
  `--user-data-dir=${userDataDir}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-port=9222",
]

const chrome = spawn(chromeExecutable, chromeArgs, {
  stdio: "inherit",
  detached: true,
})

chrome.on("error", (err) => {
  console.error(`❌ Failed to launch ${browserName}:`, err.message)
  console.log(`💡 Make sure ${browserName} is installed at:`, chromeExecutable)
  process.exit(1)
})

chrome.on("spawn", () => {
  console.log(`✅ ${browserName} launched successfully!`)
  console.log("")
  console.log("🎯 IMPORTANT: Open a NEW TAB (Cmd+T) to see Sushi")
  console.log("")
  console.log("📋 Verification Steps:")
  console.log("   1. Open a new tab (Cmd+T or Ctrl+T)")
  console.log("   2. You should see Sushi IDE with black background")
  console.log("   3. If you see Google, go to chrome://extensions")
  console.log("   4. Make sure 'Sushi 🍒' is ENABLED")
  console.log("   5. Close Chrome completely and run this script again")
  console.log("")
  console.log("💡 Development Tips:")
  console.log("   - Run 'pnpm dev:watch' to auto-rebuild on changes")
  console.log("   - Reload extension in chrome://extensions after rebuilds")
  console.log("   - Check console for errors: Right-click new tab → Inspect")
  console.log("")
})

// Allow the process to exit while Chrome continues running
chrome.unref()
