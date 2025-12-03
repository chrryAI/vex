import React from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"

/**
 * Client-side rendering
 * Since we're not doing SSR (to avoid @lobehub errors),
 * we use createRoot instead of hydrateRoot
 */

console.log("🚀 Starting client entry...")

const rootElement = document.getElementById("root")
console.log("Root element:", rootElement)

if (!rootElement) {
  console.error("❌ Root element not found!")
  throw new Error("Root element not found")
}

// Render the app on the client
console.log("Creating root...")
const root = createRoot(rootElement)

console.log("Rendering App...")
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

console.log("✅ Client render call complete")
