/**
 * Sushi - Complete Browser-First IDE
 *
 * This is a standalone app that imports the FULL @chrryai/chrry UI
 * and adds IDE features on top. It's completely self-contained.
 */

import React from "react"
import { SushiIDE } from "./SushiIDE"

// Import ALL of Chrry UI - Sushi has access to everything
import Chrry from "../../ui/Chrry"
import {
  AppProvider,
  AuthProvider,
  DataProvider,
  ChatProvider,
  NavigationProvider,
} from "../../ui/context/providers"

export interface SushiAppProps {
  rootPath?: string
}

/**
 * Main Sushi App - Complete IDE experience
 * Wraps the full Chrry app with IDE features and all providers
 */
export function SushiApp({ rootPath = "." }: SushiAppProps) {
  return <Chrry>ssssss</Chrry>
}

// Export everything from Sushi
export { SushiIDE } from "./SushiIDE"
export {
  CodeEditor,
  FileExplorer,
  useBridgeFile,
  useAICompletion,
} from "./editor"

// Re-export Chrry for convenience
export { Chrry }
