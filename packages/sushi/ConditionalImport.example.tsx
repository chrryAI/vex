/**
 * Conditional Sushi Import Example
 *
 * This shows how to conditionally import @chrryai/sushi in your Chrome extension
 * based on the mode (e.g., when mode === "sushi")
 */

import React, { lazy, Suspense, useState } from "react"
import { Div } from "@chrryai/chrry/platform"
import Loading from "@chrryai/chrry/Loading"

// Lazy load Sushi components - only loads when actually used
const CodeEditor = lazy(() =>
  import("@chrryai/sushi").then((mod) => ({ default: mod.CodeEditor })),
)

const FileExplorer = lazy(() =>
  import("@chrryai/sushi").then((mod) => ({ default: mod.FileExplorer })),
)

interface ExtensionAppProps {
  mode: "sushi" | "focus" | "calendar" | "default"
}

export function ExtensionApp({ mode }: ExtensionAppProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  // Conditionally render Sushi IDE when mode is "sushi"
  if (mode === "sushi") {
    return (
      <Suspense fallback={<Loading />}>
        <Div style={{ display: "flex", height: "100vh" }}>
          <Div style={{ width: "250px", borderRight: "1px solid #333" }}>
            <FileExplorer
              rootPath="."
              onFileSelect={setSelectedFile}
              selectedFile={selectedFile}
            />
          </Div>
          <Div style={{ flex: 1 }}>
            <CodeEditor filePath={selectedFile} aiEnabled={true} />
          </Div>
        </Div>
      </Suspense>
    )
  }

  // Other modes
  if (mode === "focus") {
    return <Div>Focus mode - Coming soon</Div>
  }

  if (mode === "calendar") {
    return <Div>Calendar mode - Coming soon</Div>
  }

  // Default mode
  return <Div>Default extension view</Div>
}

/**
 * Alternative: Dynamic import with async/await
 */
export function useSushiComponents() {
  const [components, setComponents] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const loadSushi = async () => {
    setLoading(true)
    try {
      const sushi = await import("@chrryai/sushi")
      setComponents(sushi)
    } catch (error) {
      console.error("Failed to load Sushi:", error)
    } finally {
      setLoading(false)
    }
  }

  return { components, loading, loadSushi }
}

/**
 * Usage with hook:
 *
 * function App() {
 *   const { components, loading, loadSushi } = useSushiComponents()
 *   const [mode, setMode] = useState("default")
 *
 *   useEffect(() => {
 *     if (mode === "sushi" && !components) {
 *       loadSushi()
 *     }
 *   }, [mode])
 *
 *   if (mode === "sushi") {
 *     if (loading) return <Loading />
 *     if (components) {
 *       const { CodeEditor } = components
 *       return <CodeEditor filePath="src/App.tsx" />
 *     }
 *   }
 *
 *   return <div>Other content</div>
 * }
 */
