import { Hono } from "hono"
import { cors } from "hono/cors"
import { session } from "./routes/session"
import { threads } from "./routes/threads"
import { translations } from "./routes/translations"
import { app as apps } from "./routes/apps"
import { affiliates } from "./routes/affiliates"
import { ai } from "./routes/ai"
import { aiAgents } from "./routes/aiAgents"
import { health } from "./routes/health"
import authRoutes from "./routes/auth"

const app = new Hono()

// CORS for Flash (5173) and web (3000)
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  }),
)

app.route("/session", session)
app.route("/threads", threads)
app.route("/translations", translations)
app.route("/apps", apps)
app.route("/affiliates", affiliates)
app.route("/ai", ai)
app.route("/aiAgents", aiAgents)
app.route("/health", health)
app.route("/api/auth", authRoutes)

export default app
