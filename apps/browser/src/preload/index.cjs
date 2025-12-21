const { contextBridge, ipcRenderer } = require("electron")

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  ping: () => ipcRenderer.invoke("ping"),

  // Window controls
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),

  // File system operations (to be implemented)
  readFile: (path) => ipcRenderer.invoke("fs:read", path),
  writeFile: (path, content) => ipcRenderer.invoke("fs:write", path, content),

  // Terminal operations (to be implemented)
  createTerminal: () => ipcRenderer.invoke("terminal:create"),
  sendToTerminal: (id, data) => ipcRenderer.invoke("terminal:send", id, data),

  // Git operations (to be implemented)
  gitStatus: (repoPath) => ipcRenderer.invoke("git:status", repoPath),
  gitCommit: (repoPath, message) =>
    ipcRenderer.invoke("git:commit", repoPath, message),
})
