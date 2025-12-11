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
import { health } from "./routes/health"
import authRoutes from "./routes/auth"

const isDevelopment = process.env.NODE_ENV !== "production"

const app = new Hono()

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
app.route("/health", health)
app.route("/api/auth", authRoutes)

export default app
