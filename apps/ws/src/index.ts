// apps/web/ws-server.ts

import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"
import { WebSocketServer } from "ws"
import jwt from "jsonwebtoken"
import {
  getCollaboration,
  getGuest,
  getThread,
  getUser,
  updateCollaboration,
  updateGuest,
  updateUser,
  db,
  task,
  getTask,
  updateTask,
} from "./db"
import {
  addClient,
  handleAcknowledgment,
  notify,
  removeClient,
} from "./wsClients"
import { createTimer, getTimer, getTasks, timer, updateTimer } from "./db"

export const notifyClients = notify
// import captureException from "./lib/captureException.js"

// ============================================
// BATCHED TASK UPDATES (Performance Optimization)
// ============================================

// Queue task updates to prevent DB overload
const taskUpdateQueue = new Map<string, task>()
let taskFlushTimeout: NodeJS.Timeout | null = null

// Flush queued task updates to database
async function flushTaskUpdates() {
  if (taskUpdateQueue.size === 0) return

  const tasksToUpdate = Array.from(taskUpdateQueue.values())
  taskUpdateQueue.clear()

  console.log(`[BATCH] Flushing ${tasksToUpdate.length} task updates`)

  // Non-blocking: Don't await, fire and forget
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

// Schedule task flush (debounced)
function scheduleTaskFlush() {
  if (taskFlushTimeout) clearTimeout(taskFlushTimeout)
  taskFlushTimeout = setTimeout(flushTaskUpdates, 10000) // Flush every 10 seconds
}

// Graceful shutdown: flush on exit
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

const app = express()
const PORT = Number(process.env.PORT) || 5001
const wss = new WebSocketServer({ noServer: true })

// Add middleware
app.use((req, res, next) => {
  console.log("⏱️ Request received:", req.method, req.url)
  next()
})
console.log("✅ Request logger middleware registered")
app.use(express.json({ limit: "10mb" })) // Increased from 100kb to 10mb for large message history
console.log("✅ JSON parser middleware registered")

// Enable CORS for extension and cross-origin access
app.use(
  cors({
    origin: [
      "https://vex.chrry.ai",
      "https://www.askvex.com",
      "https://chrry.dev",
      "https://www.chrry.dev",
      "https://chrry.ai",
      "https://www.chrry.ai",
      "https://chrry.store",
      "https://www.chrry.store",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3004",
      "http://localhost:3005",
      /^https?:\/\/[a-z0-9-]+\.chrry\.dev$/,
      /^https?:\/\/[a-z0-9-]+\.chrry\.ai$/,
      /^https?:\/\/[a-z0-9-]+\.chrry\.store$/,
      /^https?:\/\/localhost:\d+$/,
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
    ],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "fingerprint"],
  }),
)
console.log("✅ CORS middleware registered")

// Health check endpoint
app.get("/health", (req, res) => {
  try {
    console.log("💚 /health handler called")
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      connections: wss.clients?.size || 0,
    })
  } catch (error) {
    console.error("❌ Health check error:", error)
    res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

// Add notification endpoint
app.post("/notify", (req, res) => {
  try {
    const { recipientId, type, data } = req.body
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

    res.json({ success: true, sent })
  } catch (error) {
    console.error("Notification endpoint error:", error)
    res.status(500).json({ error: "Failed to send notification" })
  }
})

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err)
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
      console.log("getMemberWithToken: verifying JWT with configured secret")
      decoded = jwt.verify(token, secret) as { email?: string }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.warn("JWT verification failed:", message)

      if (process.env.NODE_ENV !== "production") {
        console.log("getMemberWithToken: attempting unsigned decode fallback")
        decoded = jwt.decode(token) as { email?: string } | null
        if (decoded) {
          console.warn(
            "Falling back to unsigned decode in non-production environment",
          )
        }
      }
    }
  } else {
    console.warn(
      "NEXTAUTH_SECRET is not set; falling back to unsigned decode for token",
    )
    decoded = jwt.decode(token) as { email?: string } | null
  }

  if (decoded?.email) {
    console.log("getMemberWithToken: resolving user by email", decoded.email)
    const user = await getUser({ email: decoded.email })
    if (!user) {
      console.warn("getMemberWithToken: no user found for email", decoded.email)
    }
    if (user) {
      console.log("getMemberWithToken: user resolved", user.id)
      return { ...user, token, password: null }
    }
    return null
  }

  console.warn("getMemberWithToken: unable to extract email from token")
  return null
}

async function getGuestWithToken(token: string) {
  console.log("getGuestWithToken: lookup by fingerprint", token)
  const guest = await getGuest({ fingerprint: token })
  if (guest) {
    console.log("getGuestWithToken: guest resolved", guest.id)
  } else {
    console.warn("getGuestWithToken: no guest found for fingerprint", token)
  }
  return guest
}

wss.on("connection", async (ws, req) => {
  console.log("🎯 CONNECTION EVENT FIRED - WebSocket upgrade completed")
  const url = new URL(req.url!, `http://${req.headers.host}`)
  const token = url.searchParams.get("token")
  const deviceId = url.searchParams.get("deviceId")

  console.log("🔌 New connection attempt:", {
    token: token?.substring(0, 10) + "...",
    deviceId,
    timestamp: new Date().toISOString(),
    userAgent: req.headers["user-agent"],
  })

  if (!token || !deviceId) {
    console.warn("WS connection missing token or deviceId", { token, deviceId })
    ws.close(4001, "Missing token or deviceId")
    return
  }

  const member = await getMemberWithToken(token)
  console.log("WS connection member result", member?.id)
  const guest = !member ? await getGuestWithToken(token) : undefined
  console.log("WS connection guest result", guest?.id)

  if (!member && !guest) {
    console.warn("WS connection authentication failed", {
      tokenSnippet: token.substring(0, 8),
      deviceId,
    })
    ws.close(4001, "Authentication failed")
    return
  }

  const clientId = (member?.id || guest?.id) as string

  // Store user, fingerprint, and device IDs on the connection
  ;(ws as any).userId = clientId
  ;(ws as any).deviceId = deviceId

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

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString())
      const { type } = message

      // Handle ping/pong from client
      if (type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }))
      }

      if (type === "timer") {
        const { timer: timerData, selectedTasks } = message

        const fingerprint = member?.fingerprint || guest?.fingerprint

        try {
          // ============================================
          // 1. UPDATE TIMER (Non-blocking)
          // ============================================
          if ((member || guest) && timerData && fingerprint) {
            // Fire and forget - don't block on DB write
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

          // ============================================
          // 2. QUEUE TASK UPDATES (Batched)
          // ============================================
          if (Array.isArray(selectedTasks) && selectedTasks.length > 0) {
            // Validate and sanitize tasks
            for (const item of selectedTasks) {
              const { total, id, title, order } = item

              // Sanitize total array
              const sanitizedTotal = Array.isArray(total)
                ? total.filter(
                    (t) =>
                      typeof t.date === "string" && !isNaN(Date.parse(t.date)),
                  )
                : []

              // Queue for batch update (don't await)
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

            // Schedule flush (debounced)
            scheduleTaskFlush()
          }

          // ============================================
          // 3. NOTIFY OTHER CLIENTS (Immediate)
          // ============================================
          // Don't wait for DB - notify immediately for real-time sync
          // Exclude sender's fingerprint to prevent infinite loops
          notify(member?.id || guest?.id || "", {
            type: "selected_tasks",
            selectedTasks,
            deviceId,
          })

          // Send acknowledgment to sender
          ws.send(
            JSON.stringify({
              type: "timer_ack",
              timestamp: Date.now(),
            }),
          )
        } catch (error) {
          console.error("[TIMER] Message handling failed:", error)
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Failed to process timer update",
            }),
          )
        }
      }

      // Handle typing notifications
      else if (type === "typing") {
        const { threadId, isTyping } = message
        if (threadId) {
          const thread = await getThread({ id: threadId })
          if (!thread) return

          if (member) {
            try {
              const collaboration = await getCollaboration({
                threadId,
                userId: member.id, // Remove optional chaining since member exists
              })

              if (collaboration) {
                await updateCollaboration({
                  ...collaboration,
                  isTyping,
                  lastTypedOn: isTyping
                    ? new Date(new Date().toISOString())
                    : collaboration.lastTypedOn, // Update last active time
                })
              }
            } catch (error) {
              console.error("Failed to update collaboration status", error)
            }
          }
          // Notify all collaborators
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

          // Notify thread owner if they're not the sender
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

          // Notify thread guest if they're not the sender
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
        const { threadId, isOnline } = message

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
                userId: member.id, // Remove optional chaining since member exists
              })

              if (collaboration) {
                await updateCollaboration({
                  ...collaboration,
                  isOnline,
                  activeOn: isOnline
                    ? new Date(new Date().toISOString())
                    : collaboration.activeOn, // Update last active time
                })
              }
            } catch (error) {
              console.error("Failed to update collaboration status", error)
            }
          }

          // Notify all collaborators
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

          // // Notify thread owner if they're not the sender
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
        const { messageId } = message
        if (messageId) {
          handleAcknowledgment(messageId)
        }
      }
    } catch (error) {
      console.error("Error processing client message:", error)
    }
  })

  ws.on("close", () => {
    removeClient(clientId, deviceId, ws)
    console.log(
      `🚀 Disconnected: userId=${member?.id} guestId=${guest?.id}, deviceId=${deviceId}`,
    )
    if (wss.clients.size === 0) {
      console.log("All WebSocket connections closed")
    }
    // Note: removeClient function would need to be implemented if available
  })
})

console.log("🔧 About to start server...")
console.log("🔧 Database client initialized:", !!db)

try {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `✅ WS server running on port ${PORT} and accepting connections`,
    )
    console.log(`🌐 Server address:`, server.address())
  })

  server.on("error", (err: any) => {
    console.error("❌ Server error:", err)
    if (err.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use`)
      process.exit(1)
    }
  })

  server.on("upgrade", (req, socket, head) => {
    console.log("WS upgrade received", {
      url: req.url,
      origin: req.headers.origin,
      userAgent: req.headers["user-agent"],
    })
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req)
    })
  })
} catch (err) {
  console.error("❌ Server failed to start:", err)
  process.exit(1)
}
