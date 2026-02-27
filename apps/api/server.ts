// Polyfills for Bun's missing Web Streams API
if (typeof TextDecoderStream === "undefined") {
  globalThis.TextDecoderStream = class TextDecoderStream extends (
    TransformStream
  ) {
    encoding: string
    fatal: boolean
    ignoreBOM: boolean

    constructor(label?: string, options?: TextDecoderOptions) {
      // Bun's TextDecoder doesn't handle undefined arguments well
      // Only pass arguments if they are defined
      const decoder =
        label !== undefined
          ? new TextDecoder(label, options)
          : new TextDecoder()

      super({
        transform(chunk, controller) {
          controller.enqueue(decoder.decode(chunk, { stream: true }))
        },
        flush(controller) {
          controller.enqueue(decoder.decode())
        },
      })

      // Set the required properties from the decoder
      this.encoding = decoder.encoding
      this.fatal = decoder.fatal
      this.ignoreBOM = decoder.ignoreBOM
    }
  }
}

if (typeof TextEncoderStream === "undefined") {
  globalThis.TextEncoderStream = class TextEncoderStream extends (
    TransformStream
  ) {
    encoding: string

    constructor() {
      const encoder = new TextEncoder()
      super({
        transform(chunk, controller) {
          controller.enqueue(encoder.encode(chunk))
        },
      })

      // Set the required property from the encoder
      this.encoding = encoder.encoding
    }
  }
}

// Global unhandled rejection handler for debugging
process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 Unhandled Promise Rejection:", {
    reason,
    promise,
    stack: reason instanceof Error ? reason.stack : undefined,
  })
})

import app from "./hono/index"
import { upgradeWebSocket, websocketHandler } from "./lib/websocket"

const port = Number(process.env.PORT) || 3001

const _server = Bun.serve({
  port,
  fetch: async (req, server) => {
    // Handle WebSocket upgrade requests
    if (req.headers.get("upgrade") === "websocket") {
      return upgradeWebSocket(req, server)
    }

    // Handle regular HTTP requests with Hono
    return app.fetch(req, server)
  },
  idleTimeout: 100,
  websocket: websocketHandler,
})

console.log(`🚀 Hono API running on http://localhost:${port}`)
console.log(`🔌 WebSocket server running on ws://localhost:${port}`)
