// Type definitions for Audio component
import { ComponentProps } from "react"

export interface AudioProps {
  src?: string
  onEnded?: () => void
  loop?: boolean
  autoPlay?: boolean
}

// Re-export from platform-specific implementations
export { Audio, type AudioProps } from "./Audio"
