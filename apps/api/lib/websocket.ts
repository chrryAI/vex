// lib/websocket.ts - WebSocket handler for Bun
import type { ServerWebSocket } from "bun"
import jwt from "jsonwebtoken"
import {
  getUser,
  getGuest,
  getThread,
  getCollaboration,
  updateCollaboration,
  updateGuest,
  updateUser,
  getTask,
  updateTask,
  createTimer,
  getTimer,
  updateTimer,
  type task,
} from "@repo/db"
import {
  addClient,
  removeClient,
  notify,
  notifyClients,
  handleAcknowledgment,
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
        const existing = await getTask({ id: taskData.id })
        if (existing) {
          await updateTask({
            ...existing,
            title: taskData.title,
            total: taskData.total,
            order: taskData.order,
            modifiedOn: new Date(),
          })
        }
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
  console.log(
    "getMemberWithToken: called",
    token ? `${token.substring(0, 12)}...` : "<no token>",
  )

  if (!token || token.split(".").length !== 3) {
    console.warn("getMemberWithToken: token missing or malformed")
    return null
  }

  const secret = process.env.NEXTAUTH_SECRET
  let decoded: { email?: string } | null = null

  if (secret) {
    try {
      decoded = jwt.verify(token, secret) as { email?: string }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.warn("JWT verification failed:", message)

      if (process.env.NODE_ENV !== "production") {
        decoded = jwt.decode(token) as { email?: string } | null
        if (decoded) {
          console.warn("Falling back to unsigned decode in non-production")
        }
      }
    }
  } else {
    console.warn("NEXTAUTH_SECRET is not set; falling back to unsigned decode")
    decoded = jwt.decode(token) as { email?: string } | null
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
  console.log("getGuestWithToken: lookup by fingerprint", token)
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
      const { member, guest, deviceId, clientId } = ws.data as any

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
          // Update timer (non-blocking)
          ;(async () => {
            try {
              const existingTimer =
                (await getTimer({
                  userId: member?.id,
                  guestId: guest?.id,
                })) ||
                (await createTimer({
                  fingerprint,
                  userId: member?.id,
                  guestId: guest?.id,
                }))

              if (existingTimer) {
                await updateTimer({
                  ...existingTimer,
                  count: timerData.count ?? existingTimer.count,
                  preset1: timerData.preset1 ?? existingTimer.preset1,
                  preset2: timerData.preset2 ?? existingTimer.preset2,
                  preset3: timerData.preset3 ?? existingTimer.preset3,
                  isCountingDown:
                    timerData.isCountingDown ?? existingTimer.isCountingDown,
                  updatedOn: new Date(),
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
              order: order ?? 0,
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
                  isTyping,
                  lastTypedOn: isTyping
                    ? new Date()
                    : collaboration.lastTypedOn,
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
          await updateGuest({
            ...guest,
            isOnline,
            activeOn: isOnline ? new Date() : guest.activeOn,
          })
        }

        if (member) {
          await updateUser({
            ...member,
            isOnline,
            activeOn: isOnline ? new Date() : member.activeOn,
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
                  isOnline,
                  activeOn: isOnline ? new Date() : collaboration.activeOn,
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
          notifyClients(thread.user?.id || thread?.guest?.id!, {
            type: "presence",
            data: {
              threadId,
              userId: member?.id,
              guestId: guest?.id,
              isOnline,
            },
          })
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
  const guest = !member ? await getGuestWithToken(token) : undefined

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
