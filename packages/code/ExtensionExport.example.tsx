/**
 * Extension Conditional Export
 *
 * This file shows how to conditionally export Sushi from your extension
 * based on the mode. Only exports Sushi when mode === "sushi".
 *
 * Place this in your extension's entry point (e.g., apps/extension/src/index.ts)
 */

import { useSiteConfig } from "@chrryai/chrry/utils/siteConfig"

/**
 * Conditionally export Sushi based on mode
 */
export function getExtensionComponents() {
  const { mode } = useSiteConfig()

  // Only export Sushi when mode is "sushi"
  if (mode === "sushi") {
    return {
      SushiIDE: () => import("@chrryai/sushi").then((m) => m.SushiIDE),
    }
  }

  // For other modes, return null or other components
  if (mode === "focus") {
    return {
      FocusApp: () => import("@chrryai/focus").then((m) => m.FocusApp),
    }
  }

  if (mode === "calendar") {
    return {
      CalendarApp: () => import("@chrryai/calendar").then((m) => m.CalendarApp),
    }
  }

  return null
}

/**
 * Usage in your extension:
 *
 * import { lazy, Suspense } from "react"
 * import { getExtensionComponents } from "./index"
 *
 * function App() {
 *   const components = getExtensionComponents()
 *
 *   if (!components) {
 *     return <div>Default extension view</div>
 *   }
 *
 *   if (components.SushiIDE) {
 *     const SushiIDE = lazy(components.SushiIDE)
 *     return (
 *       <Suspense fallback={<Loading />}>
 *         <SushiIDE rootPath="/path/to/project" />
 *       </Suspense>
 *     )
 *   }
 *
 *   // ... handle other modes
 * }
 */

/**
 * Alternative: Direct conditional export
 */
export const ExtensionApp = () => {
  const { mode } = useSiteConfig()

  // Lazy load based on mode
  if (mode === "sushi") {
    const { lazy, Suspense } = require("react")
    const SushiIDE = lazy(() =>
      import("@chrryai/sushi").then((m) => ({ default: m.SushiIDE })),
    )
    const Loading = require("@chrryai/chrry/Loading").default

    return (
      <Suspense fallback={<Loading />}>
        <SushiIDE rootPath="." />
      </Suspense>
    )
  }

  if (mode === "focus") {
    return <div>Focus mode - Coming soon</div>
  }

  if (mode === "calendar") {
    return <div>Calendar mode - Coming soon</div>
  }

  return <div>Default extension</div>
}
