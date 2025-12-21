import { contextBridge, ipcRenderer } from "electron"

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  ping: () => ipcRenderer.invoke("ping"),

  // File system operations (to be implemented)
  readFile: (path: string) => ipcRenderer.invoke("fs:read", path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke("fs:write", path, content),

  // Terminal operations (to be implemented)
  createTerminal: () => ipcRenderer.invoke("terminal:create"),
  sendToTerminal: (id: string, data: string) =>
    ipcRenderer.invoke("terminal:send", id, data),

  // Git operations (to be implemented)
  gitStatus: (repoPath: string) => ipcRenderer.invoke("git:status", repoPath),
  gitCommit: (repoPath: string, message: string) =>
    ipcRenderer.invoke("git:commit", repoPath, message),
})

// Type definitions for TypeScript
export interface ElectronAPI {
  ping: () => Promise<string>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  createTerminal: () => Promise<string>
  sendToTerminal: (id: string, data: string) => Promise<void>
  gitStatus: (repoPath: string) => Promise<any>
  gitCommit: (repoPath: string, message: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
