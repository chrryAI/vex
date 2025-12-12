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

// Apply custom CORS middleware (matching Next.js middleware)
app.use("*", corsMiddleware)

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
