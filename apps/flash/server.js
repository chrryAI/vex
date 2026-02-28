import "dotenv/config"
import fs from "node:fs/promises"
import arcjet, { fixedWindow, shield } from "@arcjet/node"
import cookieParser from "cookie-parser"
import express from "express"

// const getEnv = () => {
//   if (typeof import.meta !== "undefined") {
//     return import.meta.env
//   }
//   if (typeof process.env !== "undefined") {
//     return process.env
//   }

//   return {}
// }

const isE2E = process.env.VITE_TESTING_ENV === "e2e"

const VERSION = "2.0.48"
// Constants
const isProduction = process.env.NODE_ENV === "production"
const port = process.env.PORT || 5173
const base = process.env.BASE || "/"
const _ABORT_DELAY = 10000

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

// CORS middleware for development (mobile app access)
app.use((req, res, next) => {
  const origin = req.headers.origin

  // Strict validation for development origins
  if (isDev && origin) {
    try {
      const url = new URL(origin)
      const hostname = url.hostname

      // Allow only specific localhost and local network patterns
      const isAllowed =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) || // Strict IP validation
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || // Private network
        /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname) // Private network

      if (isAllowed) {
        res.setHeader("Access-Control-Allow-Origin", origin)
        res.setHeader("Access-Control-Allow-Credentials", "true")
        res.setHeader(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, OPTIONS",
        )
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization",
        )
      }
    } catch (_e) {
      // Invalid origin URL, skip CORS headers
    }
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(200)
  }

  next()
})

// Initialize Arcjet for rate limiting and security
const aj = arcjet({
  key: process.env.ARCJET_KEY || "test-key",
  characteristics: ["ip"],
  rules: [
    // Shield protects against common attacks
    shield({ mode: "LIVE" }),
    // Rate limit SSR requests to prevent DoS
    fixedWindow({
      mode: "LIVE",
      window: "1m",
      max: 100, // 100 requests per minute per IP
    }),
  ],
})

// Add Vite or respective production middlewares
/** @type {import('vite').ViteDevServer | undefined} */
let vite
if (isDev) {
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

  // Enhanced compression with better settings
  app.use(
    compression({
      level: 6, // Balance between speed and compression ratio
      threshold: 1024, // Only compress responses > 1KB
      filter: (req, res) => {
        // Don't compress if client doesn't support it
        if (req.headers["x-no-compression"]) {
          return false
        }
        // Compress all text-based content
        return compression.filter(req, res)
      },
    }),
  )

  // Add cache headers for static assets
  app.use((req, res, next) => {
    // Cache static assets aggressively
    if (
      req.path.match(
        /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$/,
      )
    ) {
      // 1 year cache for hashed assets
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
      res.setHeader("Expires", new Date(Date.now() + 31536000000).toUTCString())
    } else if (req.path.startsWith("/assets/")) {
      // 1 year for anything in /assets/ (Vite adds hashes)
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
      res.setHeader("Expires", new Date(Date.now() + 31536000000).toUTCString())
    } else if (req.path === "/" || req.path.endsWith(".html")) {
      // No cache for HTML to ensure fresh content
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
      res.setHeader("Pragma", "no-cache")
      res.setHeader("Expires", "0")
    }
    next()
  })

  app.use(
    base,
    sirv("./dist/client", {
      extensions: [],
      maxAge: 31536000, // 1 year in seconds
      immutable: true,
      gzip: true, // Serve pre-compressed .gz files if available
      brotli: true, // Serve pre-compressed .br files if available
    }),
  )
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
function metadataToHtml(metadata, serverData) {
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

  // Favicon and Apple Touch Icons - use hostname for white-label detection
  // Use serverData.siteConfig which is already available from server-loader
  const iconSlug = serverData?.siteConfig?.isTribe
    ? "tribe"
    : serverData?.siteConfig?.storeSlug === "compass"
      ? "atlas"
      : serverData?.siteConfig?.slug || serverData?.app?.slug || "chrry"
  const baseIcon = `/images/apps/${iconSlug}.png`
  const apiUrl = process.env.VITE_API_URL || "https://chrry.dev/api"

  // Regular favicons at different sizes using resize endpoint
  // Request 3x density (e.g. 48px for 16px icon) for Super Retina displays
  // Force PNG format for strict browser compatibility
  const favicon16 = `${apiUrl}/resize?url=${encodeURIComponent(baseIcon)}&w=48&h=48&fit=contain&q=100&fmt=png`
  const favicon32 = `${apiUrl}/resize?url=${encodeURIComponent(baseIcon)}&w=96&h=96&fit=contain&q=100&fmt=png`
  const favicon48 = `${apiUrl}/resize?url=${encodeURIComponent(baseIcon)}&w=144&h=144&fit=contain&q=100&fmt=png`

  tags.push(
    `<link rel="icon" type="image/png" sizes="16x16" href="${favicon16}" />`,
  )
  tags.push(
    `<link rel="icon" type="image/png" sizes="32x32" href="${favicon32}" />`,
  )
  tags.push(
    `<link rel="icon" type="image/png" sizes="48x48" href="${favicon48}" />`,
  )
  tags.push(`<link rel="shortcut icon" href="${favicon32}" />`)

  // Apple Touch Icon - same image source, resized to 180x180 (already high density)
  const appleIcon180 = `${apiUrl}/resize?url=${encodeURIComponent(baseIcon)}&w=180&h=180&fit=contain&q=100&fmt=png`

  tags.push(`<link rel="apple-touch-icon" href="${appleIcon180}" />`)
  tags.push(
    `<link rel="apple-touch-icon" sizes="180x180" href="${appleIcon180}" />`,
  )

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
    const apiUrl = isDev
      ? "http://localhost:3001/api"
      : process.env.INTERNAL_API_URL ||
        process.env.API_URL ||
        "https://chrry.dev/api"

    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(`${apiUrl}/sitemap.xml`, {
      headers: {
        "X-Forwarded-Host": req.hostname,
        "X-Forwarded-Proto": req.protocol,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }

    const xml = await response.text()
    res.header("Content-Type", "application/xml")
    res.send(xml)
  } catch (error) {
    console.error("❌ Sitemap error:", error)

    // Return a minimal sitemap instead of 500 error
    const minimalSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${req.hostname}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>`

    res.header("Content-Type", "application/xml")
    res.send(minimalSitemap)
  }
})

// Favicon.ico route - redirect to app-specific icon
app.get("/favicon.ico", async (req, res) => {
  try {
    // Use getSiteConfig for white-label detection (same as metadataToHtml)
    const hostname = req.hostname || "localhost"
    const { getSiteConfig } = await import("@chrryai/chrry/utils/siteConfig")
    const siteConfig = getSiteConfig(`https://${hostname}`)

    // Match metadataToHtml logic exactly
    const iconSlug =
      siteConfig?.storeSlug === "compass"
        ? "atlas"
        : siteConfig?.slug || "chrry"

    const baseIcon = `/images/apps/${iconSlug}.png`
    const apiUrl = process.env.VITE_API_URL || "https://chrry.dev/api"

    // Redirect to 32x32 favicon (96px at 3x density for Retina)
    const faviconUrl = `${apiUrl}/resize?url=${encodeURIComponent(baseIcon)}&w=96&h=96&fit=contain&q=100&fmt=png`

    res.redirect(faviconUrl)
  } catch (error) {
    console.error("❌ Favicon error:", error)
    // Fallback to default
    const apiUrl = process.env.VITE_API_URL || "https://chrry.dev/api"
    const fallback = `${apiUrl}/resize?url=${encodeURIComponent("/images/apps/chrry.png")}&w=96&h=96&fit=contain&q=100&fmt=png`
    res.redirect(fallback)
  }
})

// Manifest.json route - proxy to API
app.get("/manifest.json", async (req, res) => {
  try {
    // Use internal API URL to avoid Cloudflare round-trip
    const apiUrl = isDev
      ? "http://localhost:3001/api"
      : process.env.INTERNAL_API_URL ||
        process.env.API_URL ||
        "https://chrry.dev/api"

    const response = await fetch(`${apiUrl}/manifest`, {
      headers: {
        "X-Forwarded-Host": req.hostname,
        "X-Forwarded-Proto": req.protocol,
      },
    })

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }

    const json = await response.json()
    res.header("Content-Type", "application/json")
    res.json(json)
  } catch (error) {
    console.error("❌ Manifest error:", error)
    res.status(500).send("Error generating manifest")
  }
})

// Serve HTML with rate limiting (catch-all route)
app.use(async (req, res) => {
  // Whitelist subdomains and localhost
  const host = req.get("host") || ""
  const hostname = host.split(":")[0] // Remove port if present

  // SECURITY: Rate limiting via Arcjet (aj.protect)
  // Whitelisted domains (.chrry.ai, localhost) are trusted and skip rate limiting
  const isWhitelisted =
    hostname.endsWith(".chrry.ai") || // All subdomains
    hostname === "chrry.ai" || // Main domain
    hostname.startsWith("localhost") || // Local development
    hostname.startsWith("127.0.0.1") || // Local IP
    isDev || // Development mode
    isE2E // E2E testing

  // Debug logging
  if (hostname.includes("e2e") || hostname.includes("staging")) {
    console.log("🔍 Host check:", {
      host,
      hostname,
      isWhitelisted,
      isDev,
      isE2E,
      endsWithChrryAi: hostname.endsWith(".chrry.ai"),
    })
  }

  // Apply Arcjet protection (skip for whitelisted hosts)
  if (!isWhitelisted) {
    const decision = await aj.protect(req)

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return res.status(429).json({ error: "Too many requests" })
      }
      return res.status(403).json({ error: "Forbidden" })
    }
  }
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
    let _render
    /** @type {import('./src/entry-server.ts').loadData} */
    let loadData
    if (!isProduction) {
      // Always read fresh template in development
      template = await fs.readFile("./index.html", "utf-8")
      template = await vite.transformIndexHtml(url, template)
      const entryServer = await vite.ssrLoadModule("/src/entry-server.tsx")
      _render = entryServer.render
      loadData = entryServer.loadData
    } else {
      template = templateHtml
      const entryServer = await import("./dist/server/entry-server.js")
      _render = entryServer.render
      loadData = entryServer.loadData
    }

    // Load server data first (optional - can be undefined for client-only rendering)
    let serverData
    if (loadData) {
      console.log("🔍 Loading server data for:", url)
      // You can build the context from req here
      const context = {
        url,
        hostname: req.hostname || "localhost",
        pathname: url,
        headers: req.headers,
        cookies: req.cookies || {},
        ip:
          req.ip ||
          req.headers["x-forwarded-for"] ||
          req.headers["x-real-ip"] ||
          "0.0.0.0", // Extract client IP
      }
      serverData = await loadData(context)
      console.log("✅ Server data loaded. Theme:", serverData?.theme)

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
        metaTags = metadataToHtml(serverData.metadata, serverData)
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

    console.log(
      "🔧 SSR: serverData.pathname before render:",
      serverData?.pathname,
    )
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

    // Inject router state for SSR hydration (pathname from server)
    const routerState = {
      pathname: serverData?.pathname || url,
      searchParams: Object.fromEntries(
        new URLSearchParams(url.split("?")[1] || ""),
      ),
      hash: url.split("#")[1] || "",
    }

    const routerStateScript = serverData
      ? `<script>window.__ROUTER_STATE__ = ${JSON.stringify(routerState).replace(/</g, "\\u003c")}</script>`
      : ""

    // Sanitize theme value to prevent HTML injection
    const ALLOWED_THEMES = ["dark", "light"]
    const rawTheme = serverData?.theme
    const sanitizedTheme = ALLOWED_THEMES.includes(rawTheme) ? rawTheme : "dark"

    // Replace placeholders - inject metadata, CSS, server data, router state, lang attribute, and theme class
    console.log("🎨 Applying theme class:", sanitizedTheme)
    const html = template
      .replace(`<html lang="en"`, `<html lang="${serverData?.locale || "en"}"`)
      .replace(`class="dark"`, `class="${sanitizedTheme}"`)
      .replace(
        `<!--app-head-->`,
        `${metaTags}\n  ${cssLinks}\n  ${serverDataScript}\n  ${routerStateScript}`,
      )
      .replace(`<!--app-html-->`, appHtml)

    console.log(`✅ HTML generated with theme: ${sanitizedTheme}`)

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
