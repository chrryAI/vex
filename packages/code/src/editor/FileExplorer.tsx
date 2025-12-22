"use client"

import React, { useEffect, useState } from "react"
import { Div } from "@chrryai/chrry/platform/index.js"
import Loading from "@chrryai/chrry/Loading.js"

interface FileItem {
  name: string
  type: "file" | "dir"
  path: string
}

interface FileExplorerProps {
  rootPath?: string
  onFileSelect: (path: string) => void
  selectedFile: string | null
}

export function FileExplorer({
  rootPath = ".",
  onFileSelect,
  selectedFile,
}: FileExplorerProps) {
  const [items, setItems] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    new Set([rootPath]),
  )

  const loadDirectory = async (path: string) => {
    setIsLoading(true)
    setError(null)

    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendNativeMessage) {
        chrome.runtime.sendNativeMessage(
          "com.chrry.sushi.bridge",
          { type: "fs:ls", path },
          (response) => {
            if (chrome.runtime.lastError) {
              setError(
                chrome.runtime.lastError.message || "Failed to list directory",
              )
              setIsLoading(false)
              return
            }

            if (response?.success && response.items) {
              const itemsWithPath = response.items.map((item: any) => ({
                ...item,
                path: `${path}/${item.name}`,
              }))
              setItems(itemsWithPath)
            } else {
              setError(response?.error || "Failed to list directory")
            }
            setIsLoading(false)
          },
        )
      } else {
        setError("Sushi Bridge not available")
        setIsLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDirectory(rootPath)
  }, [rootPath])

  const toggleDirectory = (path: string) => {
    const newExpanded = new Set(expandedDirs)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedDirs(newExpanded)
  }

  const getFileIcon = (name: string, type: string) => {
    if (type === "dir") return "📁"
    const ext = name.split(".").pop()?.toLowerCase()
    const iconMap: Record<string, string> = {
      ts: "🔷",
      tsx: "⚛️",
      js: "📜",
      jsx: "⚛️",
      json: "📋",
      md: "📝",
      css: "🎨",
      scss: "🎨",
      html: "🌐",
      py: "🐍",
      go: "🔵",
      rs: "🦀",
    }
    return iconMap[ext || ""] || "📄"
  }

  if (isLoading && items.length === 0) {
    return (
      <Div style={{ padding: "20px", textAlign: "center" }}>
        <Loading />
      </Div>
    )
  }

  if (error) {
    return (
      <Div style={{ padding: "20px", color: "#ff6b6b", fontSize: "14px" }}>
        ⚠️ {error}
      </Div>
    )
  }

  return (
    <Div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "10px",
        fontSize: "14px",
      }}
    >
      {items.map((item) => (
        <Div
          key={item.path}
          onClick={() => {
            if (item.type === "file") {
              onFileSelect(item.path)
            } else {
              toggleDirectory(item.path)
            }
          }}
          style={{
            padding: "6px 10px",
            cursor: "pointer",
            borderRadius: "4px",
            background:
              selectedFile === item.path
                ? "rgba(255, 255, 255, 0.1)"
                : "transparent",
            marginBottom: "2px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "background 0.2s",
          }}
        >
          <span>{getFileIcon(item.name, item.type)}</span>
          <span style={{ flex: 1 }}>{item.name}</span>
          {item.type === "dir" && (
            <span style={{ fontSize: "12px", opacity: 0.6 }}>
              {expandedDirs.has(item.path) ? "▼" : "▶"}
            </span>
          )}
        </Div>
      ))}
    </Div>
  )
}
