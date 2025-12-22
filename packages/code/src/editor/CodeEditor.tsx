"use client"

import React, { useEffect, useState } from "react"
import Editor, { OnMount } from "@monaco-editor/react"
import type * as Monaco from "monaco-editor"
import { useBridgeFile } from "./useBridgeFile"
import { useAICompletion } from "./useAICompletion"
import { Div } from "@chrryai/chrry/platform/index.js"
import Loading from "@chrryai/chrry/Loading.js"

interface CodeEditorProps {
  filePath: string | null
  onContentChange?: (content: string) => void
  aiEnabled?: boolean
}

export function CodeEditor({
  filePath,
  onContentChange,
  aiEnabled = true,
}: CodeEditorProps) {
  const [editorInstance, setEditorInstance] =
    useState<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const { content, isLoading, error, loadFile, saveFile, isDirty } =
    useBridgeFile()
  const [localContent, setLocalContent] = useState<string>("")

  // Enable AI completion
  useAICompletion({ editor: editorInstance, enabled: aiEnabled })

  // Load file when path changes
  useEffect(() => {
    if (filePath) {
      loadFile(filePath)
    }
  }, [filePath, loadFile])

  // Update local content when file loads
  useEffect(() => {
    if (content !== null) {
      setLocalContent(content)
    }
  }, [content])

  // Handle editor mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    setEditorInstance(editor)

    // Configure editor
    editor.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      lineNumbers: "on",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
    })

    // Add save command (Cmd+S / Ctrl+S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (filePath && localContent) {
        saveFile(filePath, localContent)
      }
    })

    // Set dark theme
    monaco.editor.setTheme("vs-dark")
  }

  // Handle content change
  const handleChange = (value: string | undefined) => {
    const newContent = value || ""
    setLocalContent(newContent)
    onContentChange?.(newContent)
  }

  // Detect language from file extension
  const getLanguage = (path: string | null): string => {
    if (!path) return "plaintext"
    const ext = path.split(".").pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      json: "json",
      md: "markdown",
      css: "css",
      scss: "scss",
      html: "html",
      py: "python",
      go: "go",
      rs: "rust",
      sh: "shell",
    }
    return langMap[ext || ""] || "plaintext"
  }

  if (!filePath) {
    return (
      <Div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#888",
        }}
      >
        Select a file to edit
      </Div>
    )
  }

  if (isLoading) {
    return (
      <Div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <Loading />
      </Div>
    )
  }

  if (error) {
    return (
      <Div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#ff6b6b",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ marginBottom: "10px" }}>⚠️ Error loading file</div>
          <div style={{ fontSize: "14px", opacity: 0.8 }}>{error}</div>
        </div>
      </Div>
    )
  }

  return (
    <Div style={{ height: "100%", position: "relative" }}>
      {isDirty && (
        <Div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "#ff9800",
            color: "#000",
            padding: "4px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            zIndex: 10,
            fontWeight: 600,
          }}
        >
          Unsaved • Cmd+S to save
        </Div>
      )}
      <Editor
        height="100%"
        language={getLanguage(filePath)}
        value={localContent}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          readOnly: false,
          domReadOnly: false,
        }}
      />
    </Div>
  )
}
