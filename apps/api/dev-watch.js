#!/usr/bin/env node

const { spawn } = require("node:child_process")
const path = require("node:path")

let child = null
let restartCount = 0

function startServer() {
  console.log("\n🚀 Starting Next.js dev server...\n")

  child = spawn("node", ["dev.js", "dev", "-p", "3001", "--turbo"], {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  })

  child.on("exit", (code, signal) => {
    // Auto-restart on any non-zero exit (except Ctrl+C)
    if (signal === "SIGINT") {
      // User pressed Ctrl+C, exit cleanly
      process.exit(0)
    } else if (code !== 0 && code !== null) {
      // Any crash - auto-restart
      restartCount++
      console.log(
        `\n⚠️  Server crashed (code ${code}) - Auto-restarting (${restartCount})...\n`,
      )
      setTimeout(() => startServer(), 1500)
    } else if (signal === "SIGTERM") {
      // Terminated, restart
      restartCount++
      console.log(
        `\n⚠️  Server terminated - Auto-restarting (${restartCount})...\n`,
      )
      setTimeout(() => startServer(), 1500)
    }
  })

  child.on("error", (err) => {
    console.error(`\n❌ Failed to start server:`, err)
    restartCount++
    console.log(`\n⚠️  Retrying (${restartCount})...\n`)
    setTimeout(() => startServer(), 2000)
  })
}

// Handle Ctrl+C
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down...\n")
  if (child) {
    child.kill("SIGTERM")
  }
  process.exit(0)
})

startServer()
