import { useCallback, useEffect, useRef } from "react"
import type * as Monaco from "monaco-editor"
import { useAuth } from "../../../ui/hooks/useAuth"

const API_URL = process.env.VITE_API_URL || "https://chrry.dev/api"

interface AICompletionOptions {
  editor: Monaco.editor.IStandaloneCodeEditor | null
  enabled: boolean
}

/**
 * Hook for AI-powered code completion using existing /api/ai endpoint
 * Registers Monaco completion provider for inline suggestions
 */
export function useAICompletion({ editor, enabled }: AICompletionOptions) {
  const { user } = useAuth()
  const disposableRef = useRef<Monaco.IDisposable | null>(null)

  const getCompletion = useCallback(
    async (context: string, position: Monaco.Position): Promise<string> => {
      if (!user) return ""

      try {
        const response = await fetch(`${API_URL}/ai`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `Complete this code at cursor position. Return ONLY the completion text, no explanations:\n\`\`\`\n${context}\n\`\`\``,
              },
            ],
            stream: false,
            maxTokens: 150,
          }),
        })

        if (!response.ok) return ""

        const data = await response.json()
        return data.content || data.message?.content || ""
      } catch (error) {
        console.error("AI completion error:", error)
        return ""
      }
    },
    [user],
  )

  useEffect(() => {
    if (!editor || !enabled || !user) return

    import("monaco-editor").then((monaco) => {
      const disposable = monaco.languages.registerCompletionItemProvider(
        ["typescript", "javascript", "json", "markdown", "css", "html"],
        {
          triggerCharacters: [".", " ", "(", "{", "["],
          provideCompletionItems: async (model, position) => {
            const linesBefore = Math.max(1, position.lineNumber - 5)
            const linesAfter = Math.min(
              model.getLineCount(),
              position.lineNumber + 5,
            )

            const context = model.getValueInRange({
              startLineNumber: linesBefore,
              startColumn: 1,
              endLineNumber: linesAfter,
              endColumn: model.getLineMaxColumn(linesAfter),
            })

            const completion = await getCompletion(context, position)
            if (!completion) return { suggestions: [] }

            return {
              suggestions: [
                {
                  label: "✨ AI Suggestion",
                  kind: monaco.languages.CompletionItemKind.Snippet,
                  insertText: completion,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                  documentation: "AI-powered completion",
                  sortText: "0",
                },
              ],
            }
          },
        },
      )

      disposableRef.current = disposable
    })

    return () => {
      disposableRef.current?.dispose()
    }
  }, [editor, enabled, user, getCompletion])
}
