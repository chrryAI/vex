import "./index.css"
// Import global styles to ensure they're loaded
import "chrry/globals.scss"
import "chrry/globals.css"
import "chrry/styles/view-transitions.css"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import App from "./App"

hydrateRoot(
  document.getElementById("root") as HTMLElement,
  <StrictMode>
    <App />
  </StrictMode>,
)
