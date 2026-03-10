// Polyfill crypto if needed (happy-dom usually provides it, but just in case)
if (!globalThis.crypto) {
  // Try to use node crypto webcrypto if available
  try {
    const { webcrypto } = require("node:crypto")
    globalThis.crypto = webcrypto as any
  } catch (_e) {
    // console.warn('Failed to polyfill crypto', e)
  }
}

// Suppress AbortError noise from happy-dom during teardown
const originalConsoleError = console.error
console.error = (...args) => {
  if (
    args[0] instanceof Error &&
    (args[0].name === "AbortError" ||
      args[0].message?.includes("The operation was aborted"))
  ) {
    return
  }
  if (
    typeof args[0] === "string" &&
    (args[0].includes("AbortError") ||
      args[0].includes("The operation was aborted"))
  ) {
    return
  }
  originalConsoleError(...args)
}
