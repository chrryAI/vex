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
app.use(limiter)

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

    let didError = false

    // Render with pre-loaded data
    const { pipe, abort } = render(url, serverData, {
      onShellError() {
        res.status(500)
        res.set({ "Content-Type": "text/html" })
        res.send("<h1>Something went wrong</h1>")
      },
      onShellReady() {
        res.status(didError ? 500 : 200)
        res.set({ "Content-Type": "text/html" })

        // Split template to inject CSS in head
        const htmlParts = template.split(`<!--app-head-->`)
        const headStart = htmlParts[0]
        const restOfTemplate = htmlParts[1] || ""
        const [headEnd, htmlEnd] = restOfTemplate.split(`<!--app-html-->`)

        let htmlEnded = false

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

        const htmlStart = headStart + cssLinks + headEnd

        const transformStream = new Transform({
          transform(chunk, encoding, callback) {
            // See entry-server.tsx for more details of this code
            if (!htmlEnded) {
              chunk = chunk.toString()
              if (chunk.endsWith("<vite-streaming-end></vite-streaming-end>")) {
                res.write(chunk.slice(0, -41) + htmlEnd, "utf-8")
                htmlEnded = true
              } else {
                res.write(chunk, "utf-8")
              }
            } else {
              res.write(chunk, encoding)
            }
            callback()
          },
        })

        transformStream.on("finish", () => {
          res.end()
        })

        res.write(htmlStart)

        pipe(transformStream)
      },
      onError(error) {
        didError = true
        console.error(error)
      },
    })

    setTimeout(() => {
      abort()
    }, ABORT_DELAY)
  } catch (e) {
    vite?.ssrFixStacktrace(e)
    console.log(e.stack)
    res.status(500).end(e.stack)
  }
})

// Start http server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`)
})
