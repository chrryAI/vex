/**
 * Extension Entry Point with Conditional Sushi Rendering
 *
 * This shows how to conditionally render Sushi instead of Chrry
 * based on the mode. Simple and clean!
 */

import React, { lazy, Suspense } from "react"
import { useSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import Loading from "@chrryai/chrry/Loading"

// Lazy load Sushi (only loads when mode === "sushi")
const SushiApp = lazy(() =>
  import("@chrryai/sushi").then((m) => ({ default: m.SushiApp })),
)

// Lazy load normal Chrry (only loads when mode !== "sushi")
const Chrry = lazy(() =>
  import("@chrryai/chrry").then((m) => ({ default: m.default })),
)

export function App() {
  const { mode } = useSiteConfig()

  // If mode is "sushi", render Sushi IDE instead of Chrry
  if (mode === "sushi") {
    return (
      <Suspense fallback={<Loading />}>
        <SushiApp rootPath="/Users/ibrahimvelinov/Documents/vex" />
      </Suspense>
    )
  }

  // Otherwise, render normal Chrry UI
  return (
    <Suspense fallback={<Loading />}>
      <Chrry />
    </Suspense>
  )
}

/**
 * That's it! Super simple:
 *
 * - mode === "sushi" → Render SushiApp (complete IDE)
 * - mode !== "sushi" → Render Chrry (normal UI)
 *
 * Sushi has access to ALL of @chrryai/chrry, so no props needed!
 */
