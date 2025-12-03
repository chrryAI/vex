"use client"

import { Suspense } from "react"
import { HistoryRouterProvider } from "ui/context/providers/HistoryRouterProvider"
import Chrry from "ui/Chrry"

/**
 * Main App component
 * Wraps everything with HistoryRouterProvider and renders Chrry app
 */
export function App() {
  return (
    <HistoryRouterProvider>
      <Suspense fallback={<div>Loading...</div>}>
        <Chrry locale="en" apiKey="demo-key">
          {/* Chrry will render the app content */}
        </Chrry>
      </Suspense>
    </HistoryRouterProvider>
  )
}
