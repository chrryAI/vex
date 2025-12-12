import "./index.css"
// Import global styles to ensure they're loaded
import "@chrryai/chrry/globals.scss"
import "@chrryai/chrry/globals.css"
import "@chrryai/chrry/styles/view-transitions.css"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import App from "./App"
import { ServerData } from "./server-loader"

// Read server data from window (injected by server)
declare global {
  interface Window {
    __SERVER_DATA__?: ServerData
  }
}

const serverData = window.__SERVER_DATA__

hydrateRoot(
  document.getElementById("root") as HTMLElement,
  <StrictMode>
    <App serverData={serverData} />
  </StrictMode>,
)
