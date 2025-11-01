import {
  aiAgent,
  collaboration,
  deletePushSubscription,
  getPushSubscription,
  message,
  user,
  guest,
  thread,
} from "@repo/db"
import { FRONTEND_URL, isDevelopment } from "chrry/utils"
import webpush from "web-push"
import captureException from "./captureException"
import { getSiteConfig } from "chrry/utils/siteConfig"

const siteConfig = getSiteConfig()

interface CustomWebSocket {
  new (url: string): WebSocket
  OPEN: number
}

const WS_URL = process.env.WS_SERVER_URL || "ws://localhost:5001"
const WebSocket: CustomWebSocket = (global as any).WebSocket || require("ws")
let socket: WebSocket | null = null

let connectionPromise: Promise<void> | null = null

async function ensureConnected(): Promise<WebSocket> {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return socket
  }

  if (!connectionPromise) {
    connectionPromise = new Promise<void>((resolve, reject) => {
      socket = new WebSocket(WS_URL)

      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"))
        connectionPromise = null
      }, 5000)

      socket.onopen = () => {
        clearTimeout(timeout)
        resolve()
        connectionPromise = null
      }

      socket.onerror = (err) => {
        clearTimeout(timeout)
        reject(err)
        connectionPromise = null
      }
    })
  }

  await connectionPromise
  return socket!
}

export async function notify(
  recipientId: string,
  payload: {
    type:
      | "stream_chunk"
      | "stream_complete"
      | "message"
      | "search_start"
      | "search_complete"
      | "delete_message"
      | "message_update"
      | "character_tag_created"
      | "character_tag_creating"
      | "suggestions_generated"
      | "calendar_event"
      | "notification"
    data:
      | any
      | {
          message: any
          chunk?: string
          isFinal: boolean
          clientId?: string
        }
  },
  callback?: (success: boolean, error?: Error) => void,
) {
  try {
    // Send notification via HTTP to WebSocket server
    const response = await fetch(
      `${isDevelopment ? "http://localhost:5001" : "https://ws.chrry.dev"}/notify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientId,
          type:
            payload.type === "message"
              ? "message"
              : payload.type === "stream_chunk"
                ? "stream_update"
                : payload.type === "stream_complete"
                  ? "stream_complete"
                  : payload.type === "delete_message"
                    ? "delete_message"
                    : payload.type,
          data: payload.data,
        }),
      },
    )

    if (!response.ok) {
      const error = new Error(`Notification failed: ${response.status}`)
      callback?.(false, error)
      throw error
    }

    const result = await response.json()

    // If expecting acknowledgment, the callback will be called by WebSocket server
    // Otherwise, call success callback immediately
  } catch (error) {
    captureException(error)
    console.error("Notification error:", error)
    callback?.(false, error as Error)
    throw error
  }
}

export const notifyOwnerAndCollaborations = async ({
  notifySender,
  member,
  guest,
  thread,
  pushNotification,
  payload,
}: {
  pushNotification?: boolean
  notifySender?: boolean
  member?: user
  guest?: guest
  thread: thread & {
    user: user | null
    guest: guest | null
    collaborations?: {
      collaboration: collaboration
      user: user
    }[]
  }
  payload: {
    type:
      | "stream_chunk"
      | "stream_complete"
      | "message"
      | "search_start"
      | "search_complete"
      | "delete_message"
      | "message_update"
      | "character_tag_created"
      | "character_tag_creating"
      | "calendar_event"
      | "suggestions_generated"
    data:
      | any
      | {
          message: {
            message: message
            user?: user
            guest?: guest
            aiAgent?: aiAgent
          }
          chunk?: string
          isFinal: boolean
          clientId?: string
        }
  }
}) => {
  if (notifySender) {
    const recipientId = member?.id || guest?.id || ""
    console.log(
      `📨 notifyOwnerAndCollaborations: Sending ${payload.type} to ${recipientId}`,
    )
    try {
      await notify(recipientId, payload)
    } catch (error) {
      console.error(`❌ Failed to notify ${recipientId}:`, error)
    }
  }
  webpush.setVapidDetails(
    `mailto:${siteConfig.email}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  thread?.collaborations?.map(async (collaboration) => {
    if (collaboration.user.id !== member?.id) {
      ;(async () => {
        const subscription = pushNotification
          ? await getPushSubscription({
              userId: collaboration.user.id,
            })
          : undefined

        if (subscription && collaboration.collaboration.status === "active") {
          // Always send push notifications, let client handle deduplication
          const result = await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys,
            },
            JSON.stringify({
              icon: `${FRONTEND_URL}/icon-128.png`,
              badge: `${FRONTEND_URL}/icon-128.png`,
              title: `${
                payload.data.message?.message.content.slice(0, 100) ||
                "New message"
              } - Vex`,
              body: "You have a new message",
              tag: `thread-${payload.data.message?.message.threadId}-message-${payload.data.message?.message.id}`,
              data: {
                url: `${FRONTEND_URL}/threads/${payload.data.message?.message.threadId}`, // URL to open when notification is clicked
              },
            }),
          )
          if (result.statusCode !== 201) {
            await deletePushSubscription({ id: subscription.id })
          }

          notify(collaboration.user.id, {
            type: "notification",
            data: {
              message: {
                message: payload.data.message?.message,
              },
            },
          })
        }
      })()

      notify(collaboration.user.id, {
        ...payload,
        data: { ...payload.data, collaboration: collaboration.collaboration },
      })
    }
  })

  if (thread?.userId && thread.userId !== member?.id) {
    const subscription = pushNotification
      ? await getPushSubscription({
          userId: thread.userId,
        })
      : undefined

    if (subscription) {
      // Always send push notifications, let client handle deduplication
      const result = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        JSON.stringify({
          icon: `${FRONTEND_URL}/icon-128.png`,
          badge: `${FRONTEND_URL}/icon-128.png`,
          title: `${
            payload.data.message?.message.content.slice(0, 100) || "New message"
          } - Vex`,
          body: "You have a new message",
          tag: `thread-${payload.data.message?.message.threadId}-message-${payload.data.message?.message.id}`,
          data: {
            url: `${FRONTEND_URL}/threads/${payload.data.message?.message.threadId}`, // URL to open when notification is clicked
          },
        }),
      )

      if (result.statusCode !== 201) {
        await deletePushSubscription({ id: subscription.id })
      }

      notify(thread.userId, {
        type: "notification",
        data: {
          message: {
            message: payload.data.message?.message,
          },
        },
      })
    }
    notify(thread.userId, payload)
  }

  // Notify thread guest if they are not the sender
  if (thread?.guestId && thread.guestId !== guest?.id) {
    const subscription = pushNotification
      ? await getPushSubscription({
          guestId: thread.guestId,
        })
      : undefined

    if (subscription) {
      // Always send push notifications, let client handle deduplication
      const result = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        JSON.stringify({
          icon: `${FRONTEND_URL}/icon-128.png`,
          badge: `${FRONTEND_URL}/icon-128.png`,
          title: `${
            payload.data.message?.message.content.slice(0, 100) || "New message"
          } - Vex`,
          body: "You have a new message",
          tag: `thread-${payload.data.message?.message.threadId}-message-${payload.data.message?.message.id}`,
          data: {
            url: `${FRONTEND_URL}/threads/${payload.data.message?.message.threadId}`, // URL to open when notification is clicked
          },
        }),
      )
      if (result.statusCode !== 201) {
        await deletePushSubscription({ id: subscription.id })
      }

      notify(thread.guestId, {
        type: "notification",
        data: {
          message: {
            message: payload.data.message?.message,
          },
        },
      })
    }
    notify(thread.guestId, payload)
  }
}
