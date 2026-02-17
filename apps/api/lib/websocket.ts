// lib/websocket.ts - WebSocket handler for Bun

import {
  createTimer,
  getCollaboration,
  getGuest,
  getThread,
  getUser,
  type task,
  updateCollaboration,
  updateGuest,
  updateTask,
  updateTimer,
  updateUser,
} from "@repo/db"
import type { ServerWebSocket } from "bun"
import jwt from "jsonwebtoken"
import { validate } from "uuid"
import {
  addClient,
  handleAcknowledgment,
  notify,
  notifyClients,
  removeClient,
} from "./wsClients"

// Batched task updates
const taskUpdateQueue = new Map<string, task>()
let taskFlushTimeout: NodeJS.Timeout | null = null

async function flushTaskUpdates() {
  if (taskUpdateQueue.size === 0) return

  const tasksToUpdate = Array.from(taskUpdateQueue.values())
  taskUpdateQueue.clear()

  console.log(`[BATCH] Flushing ${tasksToUpdate.length} task updates`)

  Promise.all(
    tasksToUpdate.map(async (taskData) => {
      try {
        // Only update the fields we know are fresh from WebSocket
        // updateTask now accepts partial updates, so no need to fetch existing
        await updateTask({
          id: taskData.id,
          title: taskData.title,
          total: taskData.total,
          modifiedOn: new Date(),
        })
      } catch (error) {
        console.error(`[BATCH] Failed to update task ${taskData.id}:`, error)
      }
    }),
  ).catch((error) => {
    console.error("[BATCH] Task update batch failed:", error)
  })
}

function scheduleTaskFlush() {
  if (taskFlushTimeout) clearTimeout(taskFlushTimeout)
  taskFlushTimeout = setTimeout(flushTaskUpdates, 5000)
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[SHUTDOWN] Flushing task updates...")
  await flushTaskUpdates()
  process.exit(0)
})

process.on("SIGINT", async () => {
  console.log("[SHUTDOWN] Flushing task updates...")
  await flushTaskUpdates()
  process.exit(0)
})

async function getMemberWithToken(token: string) {
  if (!token) {
    return null
  }

  if (validate(token)) {
    console.log("Guest token")
    return null
  }

  if (token.split(".").length !== 3) {
    console.warn("getMemberWithToken: token missing or malformed")
    return null
  }

  // Use default secret if not set (matches auth.ts behavior)
  const secret = process.env.NEXTAUTH_SECRET || "development-secret"
  let decoded: { email?: string } | null = null

  try {
    decoded = jwt.verify(token, secret) as { email?: string }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.warn("JWT verification failed:", message)
  }

  if (decoded?.email) {
    const user = await getUser({ email: decoded.email })
    if (user) {
      console.log("getMemberWithToken: user resolved", user.id)
      return { ...user, token, password: null }
    }
  }

  return null
}

async function getGuestWithToken(token: string) {
  if (!validate(token)) {
    console.log("Member token")
    return null
  }

  const guest = await getGuest({ fingerprint: token, skipCache: true })
  if (guest) {
    console.log("getGuestWithToken: guest resolved", guest.id)
  }
  return guest
}

export const websocketHandler = {
  async open(ws: ServerWebSocket) {
    const { token, deviceId, member, guest, clientId } = ws.data as any

    addClient({
      client: ws,
      clientId,
      deviceId,
    })

    // Send connection confirmation
    ws.send(
      JSON.stringify({
        type: "connection_confirmed",
        userId: clientId,
        deviceId,
        timestamp: Date.now(),
      }),
    )
  },

  async message(ws: ServerWebSocket, message: string | Buffer) {
    try {
      const data = JSON.parse(message.toString())
      const { type } = data
      const {
        // member: memberData,
        // guest: guestData,
        deviceId,
        clientId,
        token,
      } = ws.data as any

      const member = await getMemberWithToken(token)
      const guest = await getGuestWithToken(token)

      // Handle ping/pong
      if (type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }))
        return
      }

      // Handle timer updates
      if (type === "timer") {
        const { timer: timerData, selectedTasks } = data
        const fingerprint = member?.fingerprint || guest?.fingerprint

        if ((member || guest) && timerData && fingerprint) {
          // Update timer (non-blocking) using upsert pattern
          ;(async () => {
            try {
              // Build update object with only defined fields
              const timerUpdate: any = {
                userId: member?.id,
                guestId: guest?.id,
                updatedOn: new Date(),
              }

              // Only include fields that are actually provided
              if (timerData.count) timerUpdate.count = timerData.count
              if (timerData.preset1 !== undefined)
                timerUpdate.preset1 = timerData.preset1
              if (timerData.preset2 !== undefined)
                timerUpdate.preset2 = timerData.preset2
              if (timerData.preset3 !== undefined)
                timerUpdate.preset3 = timerData.preset3
              if (timerData.isCountingDown === false)
                timerUpdate.isCountingDown = timerData.isCountingDown

              // Try to update first (most common case)
              const updated = await updateTimer(timerUpdate)

              // If no timer exists, create one
              if (!updated) {
                await createTimer({
                  fingerprint,
                  userId: member?.id,
                  guestId: guest?.id,
                })
              }
            } catch (error) {
              console.error("[TIMER] Update failed:", error)
            }
          })()
        }

        // Queue task updates
        if (Array.isArray(selectedTasks) && selectedTasks.length > 0) {
          for (const item of selectedTasks) {
            const { total, id, title, order } = item

            const sanitizedTotal = Array.isArray(total)
              ? total.filter(
                  (t) =>
                    typeof t.date === "string" && !isNaN(Date.parse(t.date)),
                )
              : []

            taskUpdateQueue.set(id, {
              ...item,
              id,
              title,
              total: sanitizedTotal,
              // order: order ?? 0,
              userId: member?.id || null,
              guestId: guest?.id || null,
            })
          }

          scheduleTaskFlush()
        }

        // Notify other clients
        notify(clientId, {
          type: "selected_tasks",
          selectedTasks,
          deviceId,
        })

        ws.send(
          JSON.stringify({
            type: "timer_ack",
            timestamp: Date.now(),
          }),
        )
      }

      // Handle typing notifications
      else if (type === "typing") {
        const { threadId, isTyping } = data
        if (threadId) {
          const thread = await getThread({ id: threadId })
          if (!thread) return

          if (member) {
            try {
              const collaboration = await getCollaboration({
                threadId,
                userId: member.id,
              })

              if (collaboration) {
                await updateCollaboration({
                  ...collaboration,
                  // Convert cached timestamps to Date objects
                  createdOn: collaboration.createdOn
                    ? new Date(collaboration.createdOn)
                    : new Date(),
                  activeOn: collaboration.activeOn
                    ? new Date(collaboration.activeOn)
                    : null,
                  // lastTypedOn: collaboration.lastTypedOn
                  //   ? new Date(collaboration.lastTypedOn)
                  //   : null,
                  // Update with new values
                  isTyping,
                  lastTypedOn: isTyping
                    ? new Date()
                    : collaboration.lastTypedOn
                      ? new Date(collaboration.lastTypedOn)
                      : null,
                })
              }
            } catch (error) {
              console.error("Failed to update collaboration status", error)
            }
          }

          // Notify collaborators
          for (const collaboration of thread.collaborations) {
            if (
              collaboration.user?.id &&
              collaboration.user?.id !== member?.id
            ) {
              notifyClients(collaboration.user.id, {
                type: "typing",
                data: {
                  threadId,
                  userId: member?.id,
                  guestId: guest?.id,
                  isTyping,
                  collaboration: collaboration.collaboration,
                },
              })
            }
          }

          // Notify thread owner
          if (thread.user?.id && thread.user.id !== member?.id) {
            notifyClients(thread.user.id, {
              type: "typing",
              data: {
                threadId,
                userId: member?.id,
                guestId: guest?.id,
                isTyping,
              },
            })
          }

          // Notify thread guest
          if (thread.guest?.id && thread.guest.id !== guest?.id) {
            notifyClients(thread.guest.id, {
              type: "typing",
              data: {
                threadId,
                userId: member?.id,
                guestId: guest?.id,
                isTyping,
              },
            })
          }
        }
      }

      // Handle presence notifications
      else if (type === "presence") {
        const { threadId, isOnline } = data

        if (guest) {
          // Only update the fields we're changing (isOnline, activeOn)
          // Don't spread ...guest to avoid stale cache
          await updateGuest({
            id: guest.id,
            isOnline,
            activeOn: new Date(), // Always update activeOn, never null (DB constraint)
          })
        }

        if (member) {
          // Only update the fields we're changing (isOnline, activeOn)
          // Don't spread ...member to avoid stale cache
          await updateUser({
            id: member.id,
            isOnline,
            activeOn: new Date(), // Always update activeOn, never null (DB constraint)
          })
        }

        if (threadId) {
          const thread = await getThread({ id: threadId })
          if (!thread) return

          if (member) {
            try {
              const collaboration = await getCollaboration({
                threadId,
                userId: member.id,
              })

              if (collaboration) {
                await updateCollaboration({
                  ...collaboration,
                  // Convert cached timestamps to Date objects
                  createdOn: collaboration.createdOn
                    ? new Date(collaboration.createdOn)
                    : new Date(),
                  lastTypedOn: collaboration.lastTypedOn
                    ? new Date(collaboration.lastTypedOn)
                    : null,
                  // Update with new values
                  isOnline,
                  activeOn: new Date(), // Always update activeOn, never null (DB constraint)
                })
              }
            } catch (error) {
              console.error("Failed to update collaboration status", error)
            }
          }

          // Notify collaborators
          for (const collaboration of thread.collaborations) {
            if (collaboration.user?.id) {
              notifyClients(collaboration.user.id, {
                type: "presence",
                data: {
                  threadId,
                  userId: member?.id,
                  guestId: guest?.id,
                  isOnline,
                },
              })
            }
          }

          // Notify thread owner
          const ownerId = thread.user?.id || thread.guest?.id
          if (ownerId) {
            notifyClients(ownerId, {
              type: "presence",
              data: {
                threadId,
                userId: member?.id,
                guestId: guest?.id,
                isOnline,
              },
            })
          }
        }
      } else if (type === "ack") {
        const { messageId } = data
        if (messageId) {
          handleAcknowledgment(messageId)
        }
      }
    } catch (error) {
      console.error("Error processing client message:", error)
    }
  },

  close(ws: ServerWebSocket) {
    const { member, guest, deviceId, clientId } = ws.data as any
    removeClient(clientId, deviceId, ws)
    console.log(
      `🚀 Disconnected: userId=${member?.id} guestId=${guest?.id}, deviceId=${deviceId}`,
    )
  },

  error(ws: ServerWebSocket, error: Error) {
    console.error("WebSocket error:", error)
  },
}

export async function upgradeWebSocket(
  req: Request,
  server: any,
): Promise<Response> {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  const deviceId = url.searchParams.get("deviceId")

  console.log("🔌 WebSocket upgrade attempt:", {
    token: token?.substring(0, 10) + "...",
    deviceId,
    timestamp: new Date().toISOString(),
  })

  if (!token || !deviceId) {
    return new Response("Missing token or deviceId", { status: 400 })
  }

  const member = await getMemberWithToken(token)
  const guest = await getGuestWithToken(token)

  if (!member && !guest) {
    return new Response("Authentication failed", { status: 401 })
  }

  const clientId = (member?.id || guest?.id) as string

  // Upgrade to WebSocket
  const success = server.upgrade(req, {
    data: {
      token,
      deviceId,
      member,
      guest,
      clientId,
    },
  })

  if (!success) {
    return new Response("WebSocket upgrade failed", { status: 500 })
  }

  return new Response(null)
}
