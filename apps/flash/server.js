// Initialize New Relic APM (must be first!)
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEW_RELIC_LICENSE_KEY
) {
  await import("newrelic")
  console.log("✅ New Relic APM initialized for Flash SSR")
}

import "dotenv/config"
import fs from "node:fs/promises"
import express from "express"
import cookieParser from "cookie-parser"
import { Transform } from "node:stream"
import rateLimit from "express-rate-limit"

const isE2E =
  process.env.NEXT_PUBLIC_TESTING_ENV === "e2e" ||
  process.env.TESTING_ENV === "e2e"

const VERSION = "1.6.88"
// Constants
const isProduction = process.env.NODE_ENV === "production"
const port = process.env.PORT || 5173
const base = process.env.BASE || "/"
const ABORT_DELAY = 10000

const isDev = process.env.NODE_ENV === "development"

// Cached production assets
const templateHtml = isProduction
  ? await fs.readFile("./dist/client/index.html", "utf-8")
  : ""

// Create http server
const app = express()

// Trust proxy - needed for X-Forwarded-For header from reverse proxy
// Set to 1 for single proxy (Nginx) - more secure than 'true'
app.set("trust proxy", 1)

app.use(cookieParser())

// Rate limiting to prevent DoS attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again later.",
})

if (!isDev && !isE2E) app.use(limiter)

// Add Vite or respective production middlewares
/** @type {import('vite').ViteDevServer | undefined} */
let vite
if (!isProduction) {
  const { createServer } = await import("vite")
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    base,
  })
  app.use(vite.middlewares)
} else {
  const compression = (await import("compression")).default
  const sirv = (await import("sirv")).default
  app.use(compression())
  app.use(base, sirv("./dist/client", { extensions: [] }))
}

// Build ID is set at build time (GIT_SHA) or runtime fallback
const buildId = process.env.GIT_SHA || Date.now().toString()

// Helper function to escape HTML
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }
  return String(text).replace(/[&<>"']/g, (m) => map[m] || m)
}

// Convert metadata object to HTML meta tags
function metadataToHtml(metadata) {
  const tags = []

  if (metadata.title) {
    tags.push(`<title>${escapeHtml(metadata.title)}</title>`)
  }

  if (metadata.description) {
    tags.push(
      `<meta name="description" content="${escapeHtml(metadata.description)}" />`,
    )
  }

  if (metadata.keywords && metadata.keywords.length > 0) {
    tags.push(
      `<meta name="keywords" content="${escapeHtml(metadata.keywords.join(", "))}" />`,
    )
  }

  if (metadata.openGraph) {
    const og = metadata.openGraph
    if (og.title) {
      tags.push(
        `<meta property="og:title" content="${escapeHtml(og.title)}" />`,
      )
    }
    if (og.description) {
      tags.push(
        `<meta property="og:description" content="${escapeHtml(og.description)}" />`,
      )
    }
    if (og.url) {
      tags.push(`<meta property="og:url" content="${escapeHtml(og.url)}" />`)
    }
    if (og.siteName) {
      tags.push(
        `<meta property="og:site_name" content="${escapeHtml(og.siteName)}" />`,
      )
    }
    if (og.type) {
      tags.push(`<meta property="og:type" content="${escapeHtml(og.type)}" />`)
    }
    if (og.locale) {
      tags.push(
        `<meta property="og:locale" content="${escapeHtml(og.locale)}" />`,
      )
    }
    if (og.images && og.images.length > 0) {
      og.images.forEach((image) => {
        tags.push(
          `<meta property="og:image" content="${escapeHtml(image.url)}" />`,
        )
        if (image.width) {
          tags.push(
            `<meta property="og:image:width" content="${image.width}" />`,
          )
        }
        if (image.height) {
          tags.push(
            `<meta property="og:image:height" content="${image.height}" />`,
          )
        }
      })
    }
  }

  if (metadata.twitter) {
    const twitter = metadata.twitter
    if (twitter.card) {
      tags.push(
        `<meta name="twitter:card" content="${escapeHtml(twitter.card)}" />`,
      )
    }
    if (twitter.title) {
      tags.push(
        `<meta name="twitter:title" content="${escapeHtml(twitter.title)}" />`,
      )
    }
    if (twitter.description) {
      tags.push(
        `<meta name="twitter:description" content="${escapeHtml(twitter.description)}" />`,
      )
    }
    if (twitter.site) {
      tags.push(
        `<meta name="twitter:site" content="${escapeHtml(twitter.site)}" />`,
      )
    }
    if (twitter.creator) {
      tags.push(
        `<meta name="twitter:creator" content="${escapeHtml(twitter.creator)}" />`,
      )
    }
    if (twitter.images && twitter.images.length > 0) {
      twitter.images.forEach((image) => {
        const imageUrl = typeof image === "string" ? image : image.url
        tags.push(
          `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
        )
      })
    }
  }

  if (metadata.robots) {
    const robotsContent = `${metadata.robots.index ? "index" : "noindex"}, ${metadata.robots.follow ? "follow" : "nofollow"}`
    tags.push(`<meta name="robots" content="${robotsContent}" />`)
  }

  if (metadata.alternates?.canonical) {
    tags.push(
      `<link rel="canonical" href="${escapeHtml(metadata.alternates.canonical)}" />`,
    )
  }

  if (metadata.alternates?.languages) {
    Object.entries(metadata.alternates.languages).forEach(([lang, url]) => {
      tags.push(
        `<link rel="alternate" hreflang="${escapeHtml(lang)}" href="${escapeHtml(url)}" />`,
      )
    })
  }

  return tags.join("\n  ")
}

// Health check endpoint for CI/CD
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    buildId,
    version: VERSION,
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

// Sitemap.xml route - proxy to API
app.get("/sitemap.xml", async (req, res) => {
  try {
    // Use internal API URL to avoid Cloudflare round-trip
    const apiUrl =
      process.env.INTERNAL_API_URL ||
      process.env.API_URL ||
      "http://localhost:3001/api"

    const response = await fetch(`${apiUrl}/sitemap.xml`, {
      headers: {
        "X-Forwarded-Host": req.hostname,
        "X-Forwarded-Proto": req.protocol,
      },
    })

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }

    const xml = await response.text()
    res.header("Content-Type", "application/xml")
    res.send(xml)
  } catch (error) {
    console.error("❌ Sitemap error:", error)
    res.status(500).send("Error generating sitemap")
  }
})

// Serve HTML
app.use("*all", async (req, res) => {
  try {
    const url = req.originalUrl.replace(base, "")

    // Skip SSR for static assets (CSS, JS, images, fonts, etc.)
    // Vite middleware already handles these in dev, sirv handles in production
    const assetExtensions = [
      ".js",
      ".css",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".ico",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
      ".webp",
      ".mp4",
      ".webm",
      ".json",
      ".map",
      ".txt",
      ".xml",
    ]
    const isAsset =
      assetExtensions.some((ext) => url.endsWith(ext)) ||
      url.includes("/@fs/") ||
      url.includes("/.well-known/") ||
      url.startsWith("/@vite/") ||
      url.startsWith("/node_modules/")

    if (isAsset) {
      // Asset requests shouldn't reach here (Vite/sirv should handle them)
      // If they do, return 404 to avoid SSR
      return res.status(404).end()
    }

    /** @type {string} */
    let template
    /** @type {import('./src/entry-server.ts').render} */
    let render
    /** @type {import('./src/entry-server.ts').loadData} */
    let loadData
    if (!isProduction) {
      // Always read fresh template in development
      template = await fs.readFile("./index.html", "utf-8")
      template = await vite.transformIndexHtml(url, template)
      const entryServer = await vite.ssrLoadModule("/src/entry-server.tsx")
      render = entryServer.render
      loadData = entryServer.loadData
    } else {
      template = templateHtml
      const entryServer = await import("./dist/server/entry-server.js")
      render = entryServer.render
      loadData = entryServer.loadData
    }

    // Load server data first (optional - can be undefined for client-only rendering)
    let serverData
    if (loadData) {
      // You can build the context from req here
      const context = {
        url,
        hostname: req.hostname || "localhost",
        pathname: url,
        headers: req.headers,
        cookies: req.cookies || {},
      }
      serverData = await loadData(context)

      // Handle OAuth redirect
      if (serverData?.redirect) {
        if (serverData.redirect.setCookie) {
          res.setHeader("Set-Cookie", serverData.redirect.setCookie)
        }
        return res.redirect(serverData.redirect.url)
      }
    }

    // Generate metadata for SSR
    let metaTags = ""
    if (serverData?.metadata) {
      try {
        metaTags = metadataToHtml(serverData.metadata)
      } catch (error) {
        console.error("Error converting metadata to HTML:", error)
        // Continue without metadata if conversion fails
      }
    }

    // Simple SSR without streaming
    const { renderToString } = await import("react-dom/server")
    const { default: React } = await import("react")

    // Get App component
    const App = !isProduction
      ? (await vite.ssrLoadModule("/src/App.tsx")).default
      : (await import("./dist/server/entry-server.js")).App

    const appHtml = renderToString(React.createElement(App, { serverData }))

    // Collect CSS from Vite's module graph (dev only)
    let cssLinks = ""
    if (!isProduction && vite) {
      const modules = Array.from(vite.moduleGraph.urlToModuleMap.values())
      const cssModules = modules.filter(
        (m) => m.url?.endsWith(".css") || m.url?.endsWith(".scss"),
      )
      cssLinks = cssModules
        .map((m) => `<link rel="stylesheet" href="${m.url}">`)
        .join("\n")
    }

    // Serialize serverData for client-side hydration
    const serverDataScript = serverData
      ? `<script>window.__SERVER_DATA__ = ${JSON.stringify(serverData).replace(/</g, "\\u003c")}</script>`
      : ""

    // Replace placeholders - inject metadata, CSS, and server data
    const html = template
      .replace(
        `<!--app-head-->`,
        `${metaTags}\n  ${cssLinks}\n  ${serverDataScript}`,
      )
      .replace(`<!--app-html-->`, appHtml)

    res.status(200).set({ "Content-Type": "text/html" }).end(html)
  } catch (e) {
    vite?.ssrFixStacktrace(e)
    console.error(e.stack) // Log for debugging
    res
      .status(500)
      .set("Content-Type", "text/plain")
      .end("Internal Server Error")
  }
})

// Start http server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`)
})
