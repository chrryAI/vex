import { useCallback, useEffect, useState } from "react"

interface BridgeFileHook {
  content: string | null
  isLoading: boolean
  error: string | null
  loadFile: (path: string) => Promise<void>
  saveFile: (path: string, content: string) => Promise<void>
  isDirty: boolean
}

/**
 * Hook for file operations via Sushi Bridge
 * Handles reading and writing files through Chrome Native Messaging
 */
export function useBridgeFile(): BridgeFileHook {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [originalContent, setOriginalContent] = useState<string | null>(null)

  const loadFile = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)

    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendNativeMessage) {
        chrome.runtime.sendNativeMessage(
          "com.chrry.sushi.bridge",
          { type: "fs:read", path },
          (response) => {
            if (chrome.runtime.lastError) {
              setError(
                chrome.runtime.lastError.message || "Failed to read file",
              )
              setIsLoading(false)
              return
            }

            if (response?.success) {
              setContent(response.content)
              setOriginalContent(response.content)
              setIsDirty(false)
            } else {
              setError(response?.error || "Failed to read file")
            }
            setIsLoading(false)
          },
        )
      } else {
        setError(
          "Sushi Bridge not available. Please install the native bridge.",
        )
        setIsLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setIsLoading(false)
    }
  }, [])

  const saveFile = useCallback(async (path: string, newContent: string) => {
    setIsLoading(true)
    setError(null)

    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendNativeMessage) {
        chrome.runtime.sendNativeMessage(
          "com.chrry.sushi.bridge",
          { type: "fs:write", path, content: newContent },
          (response) => {
            if (chrome.runtime.lastError) {
              setError(
                chrome.runtime.lastError.message || "Failed to save file",
              )
              setIsLoading(false)
              return
            }

            if (response?.success) {
              setOriginalContent(newContent)
              setIsDirty(false)
            } else {
              setError(response?.error || "Failed to save file")
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
  }, [])

  useEffect(() => {
    setIsDirty(content !== null && content !== originalContent)
  }, [content, originalContent])

  return {
    content,
    isLoading,
    error,
    loadFile,
    saveFile,
    isDirty,
  }
}
