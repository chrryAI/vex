// hono/routes/notify.ts
import { Hono } from "hono"
import { notifyClients } from "../../lib/wsClients"

const app = new Hono()

// Notification endpoint for internal use
app.post("/", async (c) => {
  try {
    const { recipientId, type, data } = await c.req.json()
    console.log("📬 /notify called:", {
      recipientId,
      type,
      dataKeys: Object.keys(data || {}),
    })

    // Format data structure to match client expectations
    const formattedData = {
      type,
      data,
    }

    const sent = notifyClients(recipientId, formattedData)
    console.log(`📤 Sent to ${sent} connections for recipient ${recipientId}`)

    return c.json({ success: true, sent })
  } catch (error) {
    console.error("Notification endpoint error:", error)
    return c.json({ error: "Failed to send notification" }, 500)
  }
})

export default app
