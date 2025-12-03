import React from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"

/**
 * Client-side rendering
 * Since we're not doing SSR (to avoid @lobehub errors),
 * we use createRoot instead of hydrateRoot
 */

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Root element not found")
}

// Render the app on the client
const root = createRoot(rootElement)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

console.log("✅ Client rendered successfully")
