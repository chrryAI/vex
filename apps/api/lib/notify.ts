import { FRONTEND_URL } from "@chrryai/chrry/utils"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import {
  type aiAgent,
  type collaboration,
  deletePushSubscription,
  getPushSubscription,
  type guest,
  type message,
  type thread,
  type user,
} from "@repo/db"
import type { Context } from "hono"
import webpush from "web-push"
import { captureException } from "./captureException"
import { sendWebPush } from "./sendWebPush"

const _siteConfig = getSiteConfig()

interface CustomWebSocket {
  new (url: string): WebSocket
  OPEN: number
}

const _WebSocket: CustomWebSocket = (global as any).WebSocket || require("ws")
const _socket: WebSocket | null = null

const _connectionPromise: Promise<void> | null = null

import { broadcast, notifyClients } from "./wsClients"

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
      | "timer"
      | "timer-ai"
      | "tasks"
      | "mood"
      | "new_post_end"
      | "new_post_start"
      | "new_comment_start"
      | "new_comment_end"

    data:
      | any
      | {
          message: any
          chunk?: string
          isFinal: boolean
          clientId?: string
          timer?: any
        }
  },
  callback?: (success: boolean, error?: Error) => void,
) {
  try {
    const notificationPayload = {
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
    }

    // console.log(
    //   "📦 Sending notification type:",
    //   notificationPayload.type,
    //   "to:",
    //   recipientId,
    // )

    // Use internal WebSocket notification instead of HTTP
    notifyClients(recipientId, notificationPayload)

    callback?.(true)
  } catch (error) {
    captureException(error)
    console.error("Notification error:", error)
    callback?.(false, error as Error)
    throw error
  }
}

export type notifyOwnerAndCollaborationsPayload = {
  c: Context
  notifySender?: boolean
  member?: user | null
  guest?: guest | null
  thread?: thread & {
    user?: user | null
    guest?: guest | null
    collaborations?: {
      collaboration: collaboration
      user: user
    }[]
  }
  pushNotification?: boolean
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
      | "mood"
      | "timer-ai"
      | "timer"
      | "new_post_end"
      | "new_post_start"
      | "new_comment_start"
      | "new_comment_end"

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
}

export { broadcast }

export const notifyOwnerAndCollaborations = async ({
  c,
  notifySender,
  member,
  guest,
  thread,
  pushNotification,
  payload,
}: notifyOwnerAndCollaborationsPayload) => {
  if (notifySender) {
    const recipientId = member?.id || guest?.id || ""
    // console.log(
    //   `📨 notifyOwnerAndCollaborations: Sending ${payload.type} to ${recipientId}`,
    // )
    try {
      await notify(recipientId, payload)
    } catch (error) {
      console.error(`❌ Failed to notify ${recipientId}:`, error)
    }
  }

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

          sendWebPush({
            c,
            userId: collaboration.user.id,
            payload: {
              title: "Collaboration Request",
              body: "You have a new collaboration request",
              icon: "/icon-128.png",
              data: {
                url: `${FRONTEND_URL}/threads/${thread.id}`,
              },
            },
          })
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
