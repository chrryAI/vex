import { Hono } from "hono"
import { session } from "./routes/session"
import { threads } from "./routes/threads"
import { translations } from "./routes/translations"
import { apps } from "./routes/apps"
import authRoutes from "./routes/auth"

const app = new Hono()

app.route("/session", session)
app.route("/threads", threads)
app.route("/translations", translations)
app.route("/apps", apps)
app.route("/api/auth", authRoutes)

export default app
