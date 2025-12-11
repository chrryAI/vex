import { Hono } from "hono"
import { cors } from "hono/cors"
import { headersMiddleware } from "./middleware/headers"
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
import { invite } from "./routes/invite"
import { manifest } from "./routes/manifest"
import { memories } from "./routes/memories"
import { messages } from "./routes/messages"
import { mood } from "./routes/mood"
import { pushSubscription } from "./routes/pushSubscription"
import { sitemap } from "./routes/sitemap"
import { stores } from "./routes/stores"
import { stripeWebhook } from "./routes/stripeWebhook"
import { health } from "./routes/health"
import authRoutes from "./routes/auth"

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

// Static allowed origins (matching Next.js middleware)
const STATIC_ALLOWED_ORIGINS = [
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  /^https?:\/\/(.*\.)?localhost(:\d+)?$/, // Allow localhost with optional port and subdomain
  /^https?:\/\/(.*\.)?askvex\.com$/,
  /^https?:\/\/(.*\.)?chrry\.dev$/,
  /^https?:\/\/(.*\.)?chrry\.ai$/,
  /^https?:\/\/(.*\.)?chrry\.store$/,
]

// CORS configuration matching Next.js middleware
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return origin

      // Check if origin matches any allowed pattern
      if (STATIC_ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))) {
        return origin
      }

      // In development, allow all origins
      if (isDevelopment) {
        return origin
      }

      // Production: fallback to chrry.ai for unmatched origins
      return "https://chrry.ai"
    },
    credentials: true,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-screen-width",
      "x-screen-height",
      "x-timezone",
      "x-device-id",
      "x-fp",
      "x-app-slug",
      "x-store-slug",
      "x-route-type",
      "x-source",
      "x-pathname",
      "x-locale",
      "x-app-id",
      "x-chrry-url",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    maxAge: isDevelopment ? 0 : 86400, // Disable in dev, 24h in prod
    exposeHeaders: ["x-pathname", "x-app-slug", "x-store-slug", "x-route-type"],
  }),
)

// Custom headers middleware for app/store detection and fingerprinting
app.use("*", headersMiddleware)

app.route("/session", session)
app.route("/threads", threads)
app.route("/translations", translations)
app.route("/apps", apps)
app.route("/affiliates", affiliates)
app.route("/ai", ai)
app.route("/aiAgents", aiAgents)
app.route("/calendar", calendar)
app.route("/cities", cities)
app.route("/clear", clear)
app.route("/collaborations", collaborations)
app.route("/createCreditPurchase", createCreditPurchase)
app.route("/createSubscription", createSubscription)
app.route("/cron", cron)
app.route("/guest", guest)
app.route("/image", image)
app.route("/invite", invite)
app.route("/manifest", manifest)
app.route("/memories", memories)
app.route("/messages", messages)
app.route("/mood", mood)
app.route("/pushSubscription", pushSubscription)
app.route("/sitemap.xml", sitemap)
app.route("/stores", stores)
app.route("/stripeWebhook", stripeWebhook)
app.route("/health", health)
app.route("/api/auth", authRoutes)

export default app
