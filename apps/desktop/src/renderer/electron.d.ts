// Type declarations for Electron API exposed via preload script

interface ElectronAPI {
  ping: () => Promise<string>
  minimize: () => Promise<void>
  maximize: () => Promise<void>
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

export {}
