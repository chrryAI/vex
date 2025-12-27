#!/usr/bin/env node

// Generate Tauri config with mode-specific names
import { readFileSync, writeFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Get MODE from environment
const mode = process.env.MODE || "vex"

// Dynamically import site config
const { getSiteConfig } = await import("../../packages/ui/utils/siteConfig.ts")
const siteConfig = getSiteConfig(mode)

// Read base config
const configPath = join(__dirname, "../browser/src-tauri/tauri.conf.json")
const baseConfig = JSON.parse(readFileSync(configPath, "utf-8"))

// Update with mode-specific values
baseConfig.productName = `${siteConfig.name} 🍒`
baseConfig.app.windows[0].title = `${siteConfig.name} 🍒`
baseConfig.bundle.shortDescription = siteConfig.description.substring(0, 80)
baseConfig.bundle.longDescription = siteConfig.description

console.log(`🔧 Generated Tauri config for ${siteConfig.name} 🍒`)

// Write updated config
writeFileSync(configPath, JSON.stringify(baseConfig, null, 2), "utf-8")
