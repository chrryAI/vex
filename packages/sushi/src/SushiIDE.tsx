/**
 * Sushi IDE - Complete UI
 *
 * This is the main Sushi application that imports the full @chrryai/chrry UI
 * and provides a complete IDE experience.
 */

import React, { useState } from "react"
import { CodeEditor } from "./editor/CodeEditor"
import { FileExplorer } from "./editor/FileExplorer"
import { Div, H1, Button } from "../../ui/platform"
import { useAuth } from "../../ui/hooks/useAuth"

export interface SushiIDEProps {
  rootPath?: string
  initialFile?: string
}

export function SushiIDE({ rootPath = ".", initialFile }: SushiIDEProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(
    initialFile || null,
  )
  const { user } = useAuth()

  return (
    <Div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <Div
        style={{
          padding: "10px 20px",
          borderBottom: "1px solid #333",
          background: "#1e1e1e",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <H1 style={{ margin: 0, fontSize: "18px", color: "#fff" }}>
          🍣 Sushi IDE
        </H1>
        <Div style={{ fontSize: "14px", color: "#888" }}>
          {user?.email || "Guest"}
        </Div>
      </Div>

      {/* Main IDE */}
      <Div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* File Explorer Sidebar */}
        <Div
          style={{
            width: "250px",
            borderRight: "1px solid #333",
            background: "#1e1e1e",
            overflow: "auto",
          }}
        >
          <Div
            style={{
              padding: "10px",
              borderBottom: "1px solid #333",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            FILES
          </Div>
          <FileExplorer
            rootPath={rootPath}
            onFileSelect={setSelectedFile}
            selectedFile={selectedFile}
          />
        </Div>

        {/* Code Editor */}
        <Div style={{ flex: 1, background: "#1e1e1e" }}>
          <CodeEditor
            filePath={selectedFile}
            aiEnabled={true}
            onContentChange={(content) => {
              console.log("Content changed:", content.length, "chars")
            }}
          />
        </Div>
      </Div>
    </Div>
  )
}
