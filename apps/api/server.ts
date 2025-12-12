// Polyfills for Bun's missing Web Streams API
if (typeof TextDecoderStream === "undefined") {
  globalThis.TextDecoderStream = class TextDecoderStream extends (
    TransformStream
  ) {
    constructor() {
      const decoder = new TextDecoder()
      super({
        transform(chunk, controller) {
          controller.enqueue(decoder.decode(chunk, { stream: true }))
        },
        flush(controller) {
          controller.enqueue(decoder.decode())
        },
      })
    }
  }
}

if (typeof TextEncoderStream === "undefined") {
  globalThis.TextEncoderStream = class TextEncoderStream extends (
    TransformStream
  ) {
    constructor() {
      const encoder = new TextEncoder()
      super({
        transform(chunk, controller) {
          controller.enqueue(encoder.encode(chunk))
        },
      })
    }
  }
}

import app from "./hono/index"

const port = process.env.PORT || 3001

Bun.serve({
  port,
  fetch: app.fetch,
})

console.log(`🚀 Hono API running on http://localhost:${port}`)
