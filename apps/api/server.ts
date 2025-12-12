import app from "./hono/index"

const port = process.env.PORT || 3001

Bun.serve({
  port,
  fetch: app.fetch,
})

console.log(`🚀 Hono API running on http://localhost:${port}`)
