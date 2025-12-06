#!/usr/bin/env node

// Suppress ECONNRESET errors globally before Next.js starts
if (process.env.NODE_ENV !== "production") {
  const http = require("http")
  const https = require("https")

  // Patch http.Server to add error handlers to all incoming requests
  const originalCreateServer = http.createServer
  http.createServer = function (...args) {
    const server = originalCreateServer.apply(this, args)

    server.on("request", (req, res) => {
      // Add error handler to request
      req.on("error", (err) => {
        if (err.code === "ECONNRESET") {
          // Silently ignore
          return
        }
        console.error("Request error:", err)
      })

      // Add error handler to response
      res.on("error", (err) => {
        if (err.code === "ECONNRESET") {
          // Silently ignore
          return
        }
        console.error("Response error:", err)
      })
    })

    return server
  }

  // Do the same for HTTPS
  const originalCreateServerHttps = https.createServer
  https.createServer = function (...args) {
    const server = originalCreateServerHttps.apply(this, args)

    server.on("request", (req, res) => {
      req.on("error", (err) => {
        if (err.code === "ECONNRESET") return
        console.error("Request error:", err)
      })
      res.on("error", (err) => {
        if (err.code === "ECONNRESET") return
        console.error("Response error:", err)
      })
    })

    return server
  }
}

// Now start Next.js
require("next/dist/bin/next")
