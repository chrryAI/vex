// lib/wsClients.ts
import type { ServerWebSocket } from "bun"

// Structure: clientId -> deviceId -> WebSocket[]
const connections = new Map<string, Map<string, ServerWebSocket[]>>()

export function addClient({
  client,
  clientId,
  deviceId,
}: {
  client: ServerWebSocket
  clientId: string
  deviceId: string
}) {
  if (!connections.has(clientId)) {
    connections.set(clientId, new Map())
  }

  const userConnections = connections.get(clientId)!

  if (!userConnections.has(deviceId)) {
    userConnections.set(deviceId, [])
  }

  userConnections.get(deviceId)!.push(client)

  console.log(
    `Added client ${clientId} deviceId:(${deviceId}), total connections: ${getTotalConnections()}`,
  )
}

export function removeClient(
  clientId: string,
  deviceId: string,
  clientToRemove: ServerWebSocket,
) {
  const userConnections = connections.get(clientId)
  if (!userConnections?.has(deviceId)) return

  const deviceConnections = userConnections.get(deviceId)!
  const index = deviceConnections.indexOf(clientToRemove)
  if (index > -1) {
    deviceConnections.splice(index, 1)
  }

  if (deviceConnections.length === 0) {
    userConnections.delete(deviceId)
  }
  if (userConnections.size === 0) {
    connections.delete(clientId)
  }
}

export function notify(userId: string, data: any) {
  const userConnections = connections.get(userId)
  if (!userConnections) {
    console.log(`❌ No connections found for userId: ${userId}`)
    console.log(`📋 Available clientIds:`, Array.from(connections.keys()))
    return 0
  }

  const message = JSON.stringify(data)
  let sent = 0

  for (const [deviceId, deviceConnections] of userConnections.entries()) {
    console.log(
      `📱 Checking device ${deviceId}: ${deviceConnections.length} connections`,
    )
    for (const client of deviceConnections) {
      try {
        client.send(message)
        sent++
        console.log(`✅ Sent to device ${deviceId}`)
      } catch (error) {
        console.error(`Send failed for ${userId} device ${deviceId}`, error)
      }
    }
  }

  console.log(`Notified ${sent} connections for ${userId}`)
  return sent
}

// Notify specific device
export function notifyDevice(userId: string, deviceId: string, data: any) {
  const userConnections = connections.get(userId)
  const deviceConnections = userConnections?.get(deviceId)

  if (!deviceConnections) return 0

  const message = JSON.stringify(data)
  let sent = 0

  for (const client of deviceConnections) {
    try {
      client.send(message)
      sent++
    } catch (error) {
      console.error(`Send failed for ${userId}:${deviceId}`, error)
    }
  }

  return sent
}

export const notifyClients = notify

export function broadcast(data: any) {
  const message = JSON.stringify(data)
  let sent = 0
  let total = 0

  for (const deviceConnections of connections.values()) {
    for (const clients of deviceConnections.values()) {
      for (const client of clients) {
        try {
          client.send(message)
          sent++
        } catch (error) {
          console.error("Broadcast send failed:", error)
        }
        total++
      }
    }
  }

  console.log(`Broadcasted to ${sent}/${total} connections`)
}

export function getClients() {
  return connections
}

export function getTotalConnections(): number {
  let count = 0
  for (const userConnections of connections.values()) {
    for (const deviceConnections of userConnections.values()) {
      count += deviceConnections.length
    }
  }
  return count
}

// Get detailed connection info
export function getUserConnectionInfo(userId: string) {
  const userConnections = connections.get(userId)
  if (!userConnections) {
    return {
      devices: [],
      totalConnections: 0,
    }
  }

  const devices = Array.from(userConnections.entries()).map(
    ([deviceId, wsArray]) => ({
      deviceId,
      connections: wsArray.length,
    }),
  )

  const totalConnections = devices.reduce(
    (sum, conn) => sum + conn.connections,
    0,
  )

  return {
    devices,
    totalConnections,
  }
}

// Clean up dead connections
export function cleanupDeadConnections() {
  for (const [clientId, deviceConnections] of connections.entries()) {
    for (const [deviceId, clients] of deviceConnections.entries()) {
      // Bun WebSockets don't have readyState, they're always "alive" until closed
      // We'll rely on the close event to clean up
      if (clients.length === 0) {
        deviceConnections.delete(deviceId)
      }
    }

    // Remove empty client entries
    if (deviceConnections.size === 0) {
      connections.delete(clientId)
    }
  }
}

// If you need acknowledgments, keep these:
const pendingAcks: Map<string, (success: boolean) => void> = new Map()

export function handleAcknowledgment(messageId: string) {
  const callback = pendingAcks.get(messageId)
  if (callback) {
    pendingAcks.delete(messageId)
    callback(true)
    console.log(`✅ Received ACK for message ${messageId}`)
  }
}
