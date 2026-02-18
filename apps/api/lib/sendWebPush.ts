import { FRONTEND_URL } from "@chrryai/chrry/utils"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import { deletePushSubscription, getPushSubscription } from "@repo/db"
import type { Context } from "hono"
import webpush from "web-push"
import { getChrryUrl } from "../hono/lib/getApp"

export const sendWebPush = async ({
  c,
  userId,
  payload,
}: {
  c: Context
  userId: string
  payload: {
    title: string
    body: string
    icon: string
    data: {
      url: string
    }
  }
}) => {
  const chrryUrl = getChrryUrl(c.req.raw) || FRONTEND_URL
  const siteConfig = getSiteConfig(chrryUrl)

  const subscription = await getPushSubscription({
    userId,
  })

  webpush.setVapidDetails(
    `mailto:${siteConfig.email}`,
    process.env.VITE_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  if (subscription) {
    try {
      // Add timeout to prevent hanging on invalid subscriptions
      const notificationPromise = webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        JSON.stringify(payload),
      )

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Push notification timeout")), 5000),
      )

      const result = await Promise.race([notificationPromise, timeoutPromise])

      if ((result as any).statusCode !== 201) {
        console.warn("Push notification failed, removing subscription")
        await deletePushSubscription({ id: subscription.id })
      }
    } catch (error) {
      console.error("WebPush error:", error)
      // Remove invalid subscription
      await deletePushSubscription({ id: subscription.id })
    }
  }
}
