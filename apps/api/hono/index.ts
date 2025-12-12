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

app.route("/api/session", session)
app.route("/api/threads", threads)
app.route("/api/translations", translations)
app.route("/api/apps", apps)
app.route("/api/affiliates", affiliates)
app.route("/api/ai", ai)
app.route("/api/aiAgents", aiAgents)
app.route("/api/calendar", calendar)
app.route("/api/cities", cities)
app.route("/api/clear", clear)
app.route("/api/collaborations", collaborations)
app.route("/api/createCreditPurchase", createCreditPurchase)
app.route("/api/createSubscription", createSubscription)
app.route("/api/cron", cron)
app.route("/api/guest", guest)
app.route("/api/image", image)
app.route("/api/invite", invite)
app.route("/api/manifest", manifest)
app.route("/api/memories", memories)
app.route("/api/messages", messages)
app.route("/api/mood", mood)
app.route("/api/moods", moods)
app.route("/api/news", news)
app.route("/api/pushSubscription", pushSubscription)
app.route("/api/pushSubscriptions", pushSubscriptions)
app.route("/api/sitemap.xml", sitemap)
app.route("/api/stores", stores)
app.route("/api/stripeWebhook", stripeWebhook)
app.route("/api/subscriptions", subscriptions)
app.route("/api/tasks", tasks)
app.route("/api/timers", timers)
app.route("/api/tts", tts)
app.route("/api/user", user)
app.route("/api/users", users)
app.route("/api/verifyPayment", verifyPayment)
app.route("/api/weather", weather)
app.route("/", landing) // Landing page at root
app.route("/health", health)
app.route("/api/auth", authRoutes)

export default app
