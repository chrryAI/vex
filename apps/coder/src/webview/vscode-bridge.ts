/**
 * Bridge between VS Code extension and React UI
 * Provides VS Code-specific implementations for file system, storage, etc.
 */

declare const acquireVsCodeApi: () => any

export const vscode = acquireVsCodeApi()

// Storage API (mimics browser localStorage)
export const storage = {
  getItem: (key: string): string | null => {
    const state = vscode.getState() || {}
    return state[key] || null
  },

  setItem: (key: string, value: string): void => {
    const state = vscode.getState() || {}
    state[key] = value
    vscode.setState(state)
  },

  removeItem: (key: string): void => {
    const state = vscode.getState() || {}
    delete state[key]
    vscode.setState(state)
  },

  clear: (): void => {
    vscode.setState({})
  },
}

// File system API
export const fileSystem = {
  readFile: async (path: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === "fileContent" && event.data.path === path) {
          window.removeEventListener("message", handler)
          resolve(event.data.content)
        } else if (event.data.type === "error") {
          window.removeEventListener("message", handler)
          reject(new Error(event.data.message))
        }
      }

      window.addEventListener("message", handler)
      vscode.postMessage({ type: "readFile", path })

      // Timeout after 10s
      setTimeout(() => {
        window.removeEventListener("message", handler)
        reject(new Error("Timeout reading file"))
      }, 10000)
    })
  },

  writeFile: async (path: string, content: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === "fileWritten" && event.data.path === path) {
          window.removeEventListener("message", handler)
          resolve()
        } else if (event.data.type === "error") {
          window.removeEventListener("message", handler)
          reject(new Error(event.data.message))
        }
      }

      window.addEventListener("message", handler)
      vscode.postMessage({ type: "writeFile", path, content })

      // Timeout after 10s
      setTimeout(() => {
        window.removeEventListener("message", handler)
        reject(new Error("Timeout writing file"))
      }, 10000)
    })
  },

  listFiles: async (pattern: string): Promise<string[]> => {
    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === "fileList") {
          window.removeEventListener("message", handler)
          resolve(event.data.files)
        }
      }

      window.addEventListener("message", handler)
      vscode.postMessage({ type: "listFiles", pattern })
    })
  },
}

// Make available globally for Chrry UI
// if (typeof window !== 'undefined') {
//   (window as any).vscodeStorage = storage
//   (window as any).vscodeFileSystem = fileSystem
// }
