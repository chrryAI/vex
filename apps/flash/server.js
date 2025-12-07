import "dotenv/config"
import fs from "node:fs/promises"
import express from "express"
import cookieParser from "cookie-parser"
import { Transform } from "node:stream"
import rateLimit from "express-rate-limit"
// Constants
const isProduction = process.env.NODE_ENV === "production"
const port = process.env.PORT || 5173
const base = process.env.BASE || "/"
const ABORT_DELAY = 10000

// Cached production assets
const templateHtml = isProduction
  ? await fs.readFile("./dist/client/index.html", "utf-8")
  : ""

// Create http server
const app = express()

// Add cookie parser middleware
app.use(cookieParser())

// Set up rate limiter: maximum 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})
isProduction && app.use(limiter)

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

// Serve HTML
app.use("*all", async (req, res) => {
  try {
    const url = req.originalUrl.replace(base, "")

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
    }

    // Simple SSR without streaming
    const { renderToString } = await import("react-dom/server")
    const { default: React } = await import("react")

    // Get App component
    const App = !isProduction
      ? (await vite.ssrLoadModule("/src/App.tsx")).default
      : (await import("./dist/server/App.js")).default

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

    // Replace placeholders
    const html = template
      .replace(`<!--app-head-->`, cssLinks)
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
