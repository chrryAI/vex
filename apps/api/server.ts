// Initialize New Relic APM (must be first!)
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEW_RELIC_LICENSE_KEY
) {
  await import("newrelic")
  console.log("✅ New Relic APM initialized for Hono API")
}

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

const port = Number(process.env.PORT) || 3001

Bun.serve({
  port,
  fetch: app.fetch,
})

console.log(`🚀 Hono API running on http://localhost:${port}`)
