// lib/wsClients.ts
import { WebSocket } from "ws"

// Store connections as: clientId -> fingerprint -> WebSocket
const clients: Map<string, Map<string, WebSocket>> = new Map()

export function addClient({
  client,
  clientId,
  fingerprint,
}: {
  client: WebSocket
  clientId: string
  fingerprint: string
}) {
  if (!clients.has(clientId)) {
    clients.set(clientId, new Map())
  }

  const fingerprints = clients.get(clientId)!

  // If a connection exists for this fingerprint, close it
  if (fingerprints.has(fingerprint)) {
    const oldClient = fingerprints.get(fingerprint)!
    fingerprints.delete(fingerprint)

    // Close old connection after a brief delay to prevent race conditions
    setTimeout(() => {
      if (oldClient.readyState === WebSocket.OPEN) {
        oldClient.close(1000, "Replaced by new connection")
      }
    }, 100)
  }

  fingerprints.set(fingerprint, client)

  // Clean up on close/error
  const remove = () => removeClient(clientId, fingerprint)
  client.on("close", remove)
  client.on("error", remove)

  console.log(
    `Added client ${clientId} (${fingerprint}), total connections: ${getTotalConnections()}`,
  )
}

export function removeClient(clientId: string, fingerprint: string) {
  const fingerprints = clients.get(clientId)
  if (fingerprints) {
    fingerprints.delete(fingerprint)
    if (fingerprints.size === 0) {
      clients.delete(clientId)
    }
  }
  console.log(
    `Removed client ${clientId} (${fingerprint}), remaining connections: ${getTotalConnections()}`,
  )
}

export function notify(userOrGuestId: string, data: any) {
  const fingerprints = clients.get(userOrGuestId)
  if (!fingerprints) return

  const message = JSON.stringify(data)
  let sent = 0

  for (const client of fingerprints.values()) {
    if (client.readyState === client.OPEN) {
      client.send(message)
      sent++
    }
  }

  // Sanitize userOrGuestId for logging (prevent format string injection)
  const safeId = String(userOrGuestId).replace(/[^\w-]/g, "_")
  console.log(`Notified ${sent}/${fingerprints.size} connections for ${safeId}`)
}

export function notifyUsers(data: any) {
  const message = JSON.stringify(data)
  let sent = 0
  let total = 0

  for (const [_, fingerprints] of clients) {
    for (const [fingerprint, client] of fingerprints) {
      if (fingerprint === "member" && client.readyState === client.OPEN) {
        client.send(message)
        sent++
      }
      total++
    }
  }

  console.log(
    `Notified ${sent} member connections (out of ${total} total connections)`,
  )
}

export function notifyGuests(data: any) {
  const message = JSON.stringify(data)
  let sent = 0
  let total = 0

  for (const [_, fingerprints] of clients) {
    for (const [fingerprint, client] of fingerprints) {
      if (fingerprint === "guest" && client.readyState === client.OPEN) {
        client.send(message)
        sent++
      }
      total++
    }
  }

  console.log(
    `Notified ${sent} guest connections (out of ${total} total connections)`,
  )
}

export function broadcast(data: any) {
  const message = JSON.stringify(data)
  let sent = 0
  let total = 0

  for (const [_, fingerprints] of clients) {
    for (const client of fingerprints.values()) {
      if (client.readyState === client.OPEN) {
        client.send(message)
        sent++
      }
      total++
    }
  }

  console.log(`Broadcasted to ${sent}/${total} connections`)
}

export function getClients() {
  return clients
}

function getTotalConnections(): number {
  let count = 0
  for (const fingerprints of clients.values()) {
    count += fingerprints.size
  }
  return count
}
