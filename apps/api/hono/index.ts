import { Hono } from "hono"
import { session } from "./routes/session"
import { translations } from "./routes/translations"
import { threads } from "./routes/threads"

// Create Hono app
const app = new Hono()

// Mount routes
app.route("/session", session)
app.route("/translations", translations)
app.route("/threads", threads)

export default app
