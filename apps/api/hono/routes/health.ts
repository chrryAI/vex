import { VERSION } from "chrry/utils/index"
import { Hono } from "hono"

const app = new Hono()

const buildId = process.env.GIT_SHA || Date.now().toString()

app.get("/", (c) => {
  return c.json({
    status: "ok",
    buildId,
    version: VERSION,
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

export { app as health }
