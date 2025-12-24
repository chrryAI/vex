import { Hono } from "hono"
import { headersMiddleware } from "./middleware/headers"
import { corsMiddleware } from "./middleware/cors"
import { session } from "./routes/session"
import { threads } from "./routes/threads"
import { translations } from "./routes/translations"
import { app as apps } from "./routes/apps"
import { affiliates } from "./routes/affiliates"
import { ai } from "./routes/ai"
import { aiAgents } from "./routes/aiAgents"
import { calendar } from "./routes/calendar"
import { cities } from "./routes/cities"
import { clear } from "./routes/clear"
import { collaborations } from "./routes/collaborations"
import { createCreditPurchase } from "./routes/createCreditPurchase"
import { createSubscription } from "./routes/createSubscription"
import { cron } from "./routes/cron"
import { guest } from "./routes/guest"
import { image } from "./routes/image"
import { resize } from "./routes/resize"
import { invite } from "./routes/invite"
import { manifest } from "./routes/manifest"
import { memories } from "./routes/memories"
import { messages } from "./routes/messages"
import { mood, moods } from "./routes/mood"
import { news } from "./routes/news"
import { pushSubscription, pushSubscriptions } from "./routes/pushSubscription"
import { sitemap } from "./routes/sitemap"
import { stores } from "./routes/stores"
import { stripeWebhook } from "./routes/stripeWebhook"
import { subscriptions } from "./routes/subscriptions"
import { tasks } from "./routes/tasks"
import { timers } from "./routes/timers"
import { tts } from "./routes/tts"
import { user } from "./routes/user"
import { users } from "./routes/users"
import { verifyPayment } from "./routes/verifyPayment"
import { weather } from "./routes/weather"
import { landing } from "./routes/landing"
import { health } from "./routes/health"
import { metadata } from "./routes/metadata"
import { testConfig } from "./routes/test-config"
import authRoutes from "./routes/auth"
import notify from "./routes/notify"
import favicon from "./routes/favicon"

import * as Sentry from "@sentry/node"

// Patch console.error to send errors to Sentry (server-side)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    beforeSend(event, hint) {
      // Ignore Applebot DOM errors
      if (event.request?.headers?.["User-Agent"]?.includes("Applebot")) {
        return null
      }
      return event
    },
    dsn: process.env.SENTRY_DSN,

    // Use custom tunnel to bypass ad blockers
    tunnel: "https://g.chrry.dev/api/submit/",

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  })
}

const isDevelopment = process.env.NODE_ENV !== "production"

const app = new Hono()

app.onError((err, c) => {
  Sentry.captureException(err)
  console.error("Hono error:", err)
  return c.json({ error: "Internal server error" }, 500)
})

// Apply custom CORS middleware (matching Next.js middleware)
app.use("*", corsMiddleware)

// Custom headers middleware for app/store detection and fingerprinting
app.use("*", headersMiddleware)

// Enable compression (gzip/deflate)
// DISABLED: CompressionStream not available in Node.js
// import { compress } from "hono/compress"
// app.use("*", compress())

// Create API group with /api basePath
const api = new Hono()

// Register all API routes without /api prefix (it's added by basePath)
api.route("/session", session)
api.route("/threads", threads)
api.route("/translations", translations)
api.route("/apps", apps)
api.route("/affiliates", affiliates)
api.route("/ai", ai)
api.route("/aiAgents", aiAgents)
api.route("/calendar", calendar)
api.route("/cities", cities)
api.route("/clear", clear)
api.route("/collaborations", collaborations)
api.route("/createCreditPurchase", createCreditPurchase)
api.route("/createSubscription", createSubscription)
api.route("/cron", cron)
api.route("/guest", guest)
api.route("/image", image)
api.route("/resize", resize)
api.route("/invite", invite)
api.route("/manifest", manifest)
api.route("/memories", memories)
api.route("/messages", messages)
api.route("/mood", mood)
api.route("/moods", moods)
api.route("/news", news)
api.route("/pushSubscription", pushSubscription)
api.route("/pushSubscriptions", pushSubscriptions)
api.route("/sitemap.xml", sitemap)
api.route("/stores", stores)
api.route("/stripeWebhook", stripeWebhook)
api.route("/subscriptions", subscriptions)
api.route("/tasks", tasks)
api.route("/timers", timers)
api.route("/tts", tts)
api.route("/user", user)
api.route("/users", users)
api.route("/verifyPayment", verifyPayment)
api.route("/weather", weather)
api.route("/health", health)
api.route("/metadata", metadata)
api.route("/test-config", testConfig)
api.route("/auth", authRoutes)
api.route("/notify", notify)

// Mount API routes under /api
app.route("/api", api)

// Root-level routes
app.route("/", landing) // Landing page at root
app.route("/", favicon) // Favicon for white-label apps

export default app
