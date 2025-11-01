// scripts/update-sw-version.js
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const swPath = path.join(__dirname, "../public/sw.js")
const buildId = process.env.GIT_SHA || Date.now().toString()

if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, "utf8")
  swContent = swContent.replace("{{CACHE_VERSION}}", buildId)
  fs.writeFileSync(swPath, swContent)
  console.log(`Updated service worker cache version to: ${buildId}`)
} else {
  console.log("Service worker file not found at:", swPath)
}
