#!/usr/bin/env node

import { spawn } from "child_process"
import { watch } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let buildProcess = null
let isBuilding = false

function runBuild() {
  if (isBuilding) {
    console.log("⏳ Build already in progress...")
    return
  }

  isBuilding = true
  console.log("\n🔨 Building extension...")

  buildProcess = spawn("pnpm", ["build:dev"], {
    stdio: "inherit",
    cwd: __dirname,
    shell: true,
  })

  buildProcess.on("close", (code) => {
    isBuilding = false
    if (code === 0) {
      console.log("✅ Extension built successfully!")
      console.log("🔄 Refresh the extension in Chrome to see changes")
      console.log("   1. Go to chrome://extensions/")
      console.log("   2. Click the refresh icon on your extension")
      console.log("   3. Or use Ctrl+R on the extension popup/sidebar")
    } else {
      console.log("❌ Build failed with code:", code)
    }
    buildProcess = null
  })
}

// Watch for changes in src directory only
// UI package changes will require manual rebuild
const watchPaths = [
  path.join(__dirname, "src"),
  path.join(__dirname, "../../packages/ui"),
  path.join(__dirname, "package.json"),
  path.join(__dirname, "vite.config.ts"),
]

console.log("👀 Watching for changes in:")
watchPaths.forEach((p) => console.log(`   - ${p}`))

watchPaths.forEach((watchPath) => {
  watch(watchPath, { recursive: true }, (eventType, filename) => {
    if (
      filename &&
      (filename.endsWith(".ts") ||
        filename.endsWith(".tsx") ||
        filename.endsWith(".js") ||
        filename.endsWith(".jsx") ||
        filename.endsWith(".json") ||
        filename.endsWith(".scss") ||
        filename.endsWith(".css"))
    ) {
      console.log(`\n📝 Changed: ${filename}`)
      runBuild()
    }
  })
})

// Initial build
console.log("🚀 Starting extension development mode...")
runBuild()

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Stopping development server...")
  if (buildProcess) {
    buildProcess.kill()
  }
  process.exit(0)
})
