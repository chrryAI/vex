import { compress } from "@hono/bun-compress"
import { serveStatic } from "@hono/node-server/serve-static"
import * as Sentry from "@sentry/node"
import { Hono } from "hono"
import { apiAnalyticsMiddleware } from "./middleware/analytics"
import { corsMiddleware } from "./middleware/cors"
import { csrfMiddleware } from "./middleware/csrf"
import { headersMiddleware } from "./middleware/headers"
import { securityHeadersMiddleware } from "./middleware/securityHeaders"
import { adCampaignsRoute as adCampaigns } from "./routes/adCampaigns"
import { affiliates } from "./routes/affiliates"
import { ai } from "./routes/ai"
import { aiAgents } from "./routes/aiAgents"
import analytics from "./routes/analytics"
import { app as apps } from "./routes/apps"
import authRoutes from "./routes/auth"
import { calendar } from "./routes/calendar"
import { cities } from "./routes/cities"

import { collaborations } from "./routes/collaborations"
import { createCreditPurchase } from "./routes/createCreditPurchase"
import { createSubscription } from "./routes/createSubscription"
import { cron } from "./routes/cron"
import favicon from "./routes/favicon"
import { guest } from "./routes/guest"
import { health } from "./routes/health"
import { image } from "./routes/image"
import { invite } from "./routes/invite"
import { landing } from "./routes/landing"
import { manifest } from "./routes/manifest"
import { memories } from "./routes/memories"
import { messages } from "./routes/messages"
import { metadata } from "./routes/metadata"
import { mood, moods } from "./routes/mood"
import { news } from "./routes/news"
import notify from "./routes/notify"
import premium from "./routes/premium"
import { pushSubscription, pushSubscriptions } from "./routes/pushSubscription"
import { resize } from "./routes/resize"
import { scheduledJobs } from "./routes/scheduledJobs"
import { session } from "./routes/session"
import { sitemap } from "./routes/sitemap"
import { sonarWebhook } from "./routes/sonarWebhook"
import { stores } from "./routes/stores"
import { stripeWebhook } from "./routes/stripeWebhook"
import { subscriptions } from "./routes/subscriptions"
import { tasks } from "./routes/tasks"
import { testConfig } from "./routes/test-config"
import { threads } from "./routes/threads"
import { timers } from "./routes/timers"
import { translations } from "./routes/translations"
import tribe from "./routes/tribe"
import tribeTranslate from "./routes/tribe-translate"
import { tts } from "./routes/tts"
import { user } from "./routes/user"
import { users } from "./routes/users"
import { verifyPayment } from "./routes/verifyPayment"
import { weather } from "./routes/weather"

// Patch console.error to send errors to Sentry (server-side)
if (process.env.VITE_SENTRY === "true" && process.env.SENTRY_DSN) {
  Sentry.init({
    beforeSend(event, hint) {
      // Ignore Applebot DOM errors
      if (event.request?.headers?.["User-Agent"]?.includes("Applebot")) {
        return null
      }

      // Log error details for debugging (helps identify missing stack traces)
      if (hint.originalException) {
        const err = hint.originalException as Error
        console.error("📤 Sending to Sentry:", {
          type: err.constructor?.name || typeof hint.originalException,
          message: err.message || String(hint.originalException),
          hasStack: !!err.stack,
        })
      }

      return event
    },
    dsn: process.env.SENTRY_DSN,

    // Use custom tunnel to bypass ad blockers
    tunnel: "https://g.chrry.dev/api/submit/",

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    // CRITICAL: Always attach stack traces to all events (including messages)
    attachStacktrace: true,

    // Environment for filtering (e2e, development, production)
    environment:
      process.env.VITE_TESTING_ENV || process.env.NODE_ENV || "development",

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  })
}

const app = new Hono()

app.onError((err, c) => {
  Sentry.captureException(err)
  console.error("Hono error:", err)
  return c.json({ error: "Internal server error" }, 500)
})

// Apply custom CORS middleware (matching Next.js middleware)
app.use("*", corsMiddleware)

// Apply security headers middleware
app.use("*", securityHeadersMiddleware)

// Apply CSRF protection middleware (verifies Origin for state-changing requests)
app.use("*", csrfMiddleware)

// Apply global API analytics middleware
app.use("*", apiAnalyticsMiddleware)

// Custom headers middleware for app/store detection and fingerprinting
app.use("*", headersMiddleware)

// Enable compression with @hono/bun-compress (official Bun middleware)
app.use(
  "*",
  compress({
    threshold: 1024, // Only compress responses > 1KB
    encoding: "gzip", // gzip or deflate (gzip is default and prioritized)
  }),
)

// Create API group with /api basePath
const api = new Hono()

// Register all API routes without /api prefix (it's added by basePath)
api.route("/session", session)
api.route("/scheduledJobs", scheduledJobs)
api.route("/threads", threads)
api.route("/translations", translations)
api.route("/apps", apps)
api.route("/affiliates", affiliates)
api.route("/ai", ai)
api.route("/aiAgents", aiAgents)
api.route("/calendar", calendar)
api.route("/cities", cities)
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
api.route("/sonarWebhook", sonarWebhook)
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
api.route("/analytics", analytics)
api.route("/premium", premium)
api.route("/tribe", tribe)
api.route("/tribe", tribeTranslate)
api.route("/campaigns", adCampaigns)

// Mount API routes under /api
app.route("/api", api)

// Serve static files from public directory
// In dev: cwd is apps/api, so ./public works
// In prod: cwd is /app, so ./apps/api/public is needed
const publicDir = process.cwd().endsWith("apps/api")
  ? "./public"
  : "./apps/api/public"

app.use(
  "/*",
  serveStatic({
    root: publicDir,
    onNotFound: (_path, _c) => {
      // Continue to next handler if file not found
    },
  }),
)

// Root-level routes
app.route("/", landing) // Landing page at root
app.route("/", favicon) // Favicon for white-label apps

export default app
