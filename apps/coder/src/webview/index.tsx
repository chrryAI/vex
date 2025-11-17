import React from "react"
import { createRoot } from "react-dom/client"
import Chrry from "chrry/Chrry"

import "./vscode-bridge"

// VS Code API
declare const acquireVsCodeApi: () => any
const vscode = acquireVsCodeApi()

function App() {
  const [session, setSession] = React.useState(null)
  const [thread, setThread] = React.useState(null)
  const [messages, setMessages] = React.useState([])

  // React.useEffect(() => {
  //   // Listen for messages from extension host
  //   const handleMessage = (event: MessageEvent) => {
  //     const message = event.data

  //     switch (message.type) {
  //       case "response":
  //         // Add AI response to messages
  //         setMessages((prev) => [
  //           ...prev,
  //           {
  //             role: "assistant",
  //             content: message.data.content || message.data.message,
  //           },
  //         ])
  //         break

  //       case "command":
  //         // Handle command from context menu (explain, refactor, etc.)
  //         handleCommand(message.data)
  //         break

  //       case "workspaceContext":
  //         // Update workspace context
  //         console.log("Workspace context:", message.data)
  //         break

  //       case "models":
  //         // Update available models
  //         console.log("Available models:", message.data)
  //         break

  //       case "costStats":
  //         // Update cost stats
  //         console.log("Cost stats:", message.data)
  //         break
  //     }
  //   }

  //   window.addEventListener("message", handleMessage)

  //   // Request initial data
  //   vscode.postMessage({ type: "getWorkspaceContext" })
  //   vscode.postMessage({ type: "getModels" })
  //   vscode.postMessage({ type: "getCostStats" })

  //   return () => window.removeEventListener("message", handleMessage)
  // }, [])

  // const handleCommand = (data: any) => {
  //   let prompt = ""

  //   switch (data.type) {
  //     case "explain":
  //       prompt = `Explain this ${data.language} code:\n\n\`\`\`${data.language}\n${data.code}\n\`\`\``
  //       break
  //     case "refactor":
  //       prompt = `Refactor this ${data.language} code to improve quality:\n\n\`\`\`${data.language}\n${data.code}\n\`\`\``
  //       break
  //     case "generateTests":
  //       prompt = `Generate unit tests for this ${data.language} code:\n\n\`\`\`${data.language}\n${data.code}\n\`\`\``
  //       break
  //     case "fix":
  //       prompt = `Fix the errors in this code:\n\n\`\`\`${data.language}\n${data.code}\n\`\`\`\n\nErrors: ${JSON.stringify(data.errors, null, 2)}`
  //       break
  //     case "screenshotToCode":
  //       prompt = `Convert this screenshot to code: ${data.image}`
  //       break
  //   }

  //   if (prompt) {
  //     setMessages((prev) => [
  //       ...prev,
  //       {
  //         role: "user",
  //         content: prompt,
  //       },
  //     ])

  //     // Send to extension host
  //     vscode.postMessage({
  //       type: "chat",
  //       message: prompt,
  //     })
  //   }
  // }

  // Custom send message handler for VS Code
  // const handleSendMessage = async (message: string) => {
  //   // Add user message
  //   setMessages((prev) => [
  //     ...prev,
  //     {
  //       role: "user",
  //       content: message,
  //     },
  //   ])

  //   // Send to extension host
  //   vscode.postMessage({
  //     type: "chat",
  //     message,
  //   })
  // }

  // File system operations bridge
  const fileSystemBridge = {
    readFile: async (path: string) => {
      return new Promise((resolve) => {
        const handler = (event: MessageEvent) => {
          if (event.data.type === "fileContent" && event.data.path === path) {
            window.removeEventListener("message", handler)
            resolve(event.data.content)
          }
        }
        window.addEventListener("message", handler)
        vscode.postMessage({ type: "readFile", path })
      })
    },
    writeFile: async (path: string, content: string) => {
      vscode.postMessage({ type: "writeFile", path, content })
    },
  }

  return (
    <Chrry
    // Your existing Chrry props
    // The UI will be exactly the same as web/extension!
    // Custom handlers for VS Code
    // onSendMessage={handleSendMessage}

    // fileSystem={fileSystemBridge}
    />
  )
}

// Mount React app
const container = document.getElementById("root")
if (container) {
  const root = createRoot(container)
  root.render(<App />)
}
