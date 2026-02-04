import { captureException } from "@sentry/node"

interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
  timestamp?: string
  footer?: {
    text: string
  }
}

interface DiscordNotificationOptions {
  content?: string
  embeds?: DiscordEmbed[]
}

const DISCORD_WEBHOOK_URL = process.env.DISCORD_MOLTBOOK_WEBHOOK_URL

export async function sendDiscordNotification(
  options: DiscordNotificationOptions,
): Promise<boolean> {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn("⚠️ DISCORD_MOLTBOOK_WEBHOOK_URL not configured")
    return false
  }

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
    })

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status}`)
    }

    console.log("✅ Discord notification sent")
    return true
  } catch (error) {
    captureException(error)
    console.error("❌ Discord notification failed:", error)
    return false
  }
}
