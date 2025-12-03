import fs from "node:fs/promises"
import express from "express"

// Constants
const isProduction = process.env.NODE_ENV === "production"
const port = process.env.PORT || 3002
const base = process.env.BASE || "/"

// Cached production assets
const templateHtml = isProduction
  ? await fs.readFile("./dist/client/index.html", "utf-8")
  : ""

// Create http server
const app = express()

// Add Vite or respective production middlewares
let vite
if (!isProduction) {
  const { createServer } = await import("vite")
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    base,
  })
  // Vite middleware handles HMR, module transformation, etc.
  app.use(vite.middlewares)
} else {
  const compression = (await import("compression")).default
  const sirv = (await import("sirv")).default
  app.use(compression())
  app.use(base, sirv("./dist/client", { extensions: [] }))
}

// Serve HTML - this runs AFTER Vite middleware
// So Vite handles .js, .ts, .css files, and this handles HTML pages
app.use("*", async (req, res, next) => {
  try {
    const url = req.originalUrl.replace(base, "")

    let template
    let render
    if (!isProduction) {
      // Always read fresh template in development
      template = await fs.readFile("./index.html", "utf-8")
      template = await vite.transformIndexHtml(url, template)
      render = (await vite.ssrLoadModule("/src/entry-server.tsx")).render
    } else {
      template = templateHtml
      render = (await import("./dist/server/entry-server.js")).render
    }

    const { html, state, head } = render(url)

    const finalHtml = template
      .replace("<!--ssr-head-->", head ?? "")
      .replace(
        "<!--ssr-outlet-->",
        html +
          `\n<script>window.__ROUTER_STATE__ = ${JSON.stringify(state)};</script>`,
      )

    res.status(200).set({ "Content-Type": "text/html" }).send(finalHtml)
  } catch (e) {
    vite?.ssrFixStacktrace(e)
    console.log(e.stack)
    res.status(500).end(e.stack)
  }
})

// Start http server
app.listen(port, () => {
  console.log(`🚀 Server started at http://localhost:${port}`)
})
