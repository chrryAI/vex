import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"

interface Message {
  type:
    | "explain"
    | "refactor"
    | "generateTests"
    | "fix"
    | "screenshotToCode"
    | "chat"
  code?: string
  language?: string
  file?: string
  image?: string
  errors?: Array<{ message: string; severity: number; line: number }>
  message?: string
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView
  private _context: vscode.ExtensionContext

  constructor(
    private readonly _extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
  ) {
    this._context = context
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "chat":
          await this.handleChat(data.message, data.model)
          break
        case "readFile":
          await this.handleReadFile(data.path)
          break
        case "writeFile":
          await this.handleWriteFile(data.path, data.content)
          break
        case "getWorkspaceContext":
          await this.handleGetWorkspaceContext()
          break
        case "applyDiff":
          await this.handleApplyDiff(data.file, data.diff)
          break
        case "getModels":
          await this.handleGetModels()
          break
        case "setModel":
          await this.handleSetModel(data.model)
          break
        case "getCostStats":
          await this.handleGetCostStats()
          break
      }
    })
  }

  public sendMessage(message: Message) {
    if (this._view) {
      this._view.webview.postMessage({
        type: "command",
        data: message,
      })
    }
  }

  private async handleChat(message: string, model?: string) {
    try {
      // Get workspace context
      const workspace = vscode.workspace.workspaceFolders?.[0]
      const activeEditor = vscode.window.activeTextEditor

      // Get recent files
      const recentFiles = await this.getRecentFiles()

      // Get API key from config
      const config = vscode.workspace.getConfiguration("sushi")
      const apiKey = config.get<string>("apiKey")

      if (!apiKey) {
        this._view?.webview.postMessage({
          type: "error",
          message:
            "API key not configured. Please set sushi.apiKey in settings.",
        })
        return
      }

      // Send to your API
      const response = await fetch("https://chrry.dev/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          message,
          model: model || config.get<string>("defaultModel"),
          context: {
            workspace: workspace?.uri.fsPath,
            activeFile: activeEditor?.document.uri.fsPath,
            recentFiles,
            language: activeEditor?.document.languageId,
          },
        }),
      })

      const data = await response.json()

      // Send response back to webview
      this._view?.webview.postMessage({
        type: "response",
        data,
      })
    } catch (error) {
      this._view?.webview.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  private async handleReadFile(filePath: string) {
    try {
      const content = await vscode.workspace.fs.readFile(
        vscode.Uri.file(filePath),
      )
      this._view?.webview.postMessage({
        type: "fileContent",
        path: filePath,
        content: Buffer.from(content).toString("utf8"),
      })
    } catch (error) {
      this._view?.webview.postMessage({
        type: "error",
        message: `Failed to read file: ${error}`,
      })
    }
  }

  private async handleWriteFile(filePath: string, content: string) {
    try {
      const config = vscode.workspace.getConfiguration("sushi")
      const showDiff = config.get<boolean>("showDiff")

      if (showDiff) {
        // Show diff before applying
        const uri = vscode.Uri.file(filePath)
        const originalContent = await vscode.workspace.fs.readFile(uri)

        // Create temp file with new content
        const tempUri = vscode.Uri.file(filePath + ".sushi-temp")
        await vscode.workspace.fs.writeFile(
          tempUri,
          Buffer.from(content, "utf8"),
        )

        // Show diff
        await vscode.commands.executeCommand(
          "vscode.diff",
          uri,
          tempUri,
          `${path.basename(filePath)} ← Sushi Changes`,
        )

        // Ask user to confirm
        const choice = await vscode.window.showInformationMessage(
          "Apply changes?",
          "Apply",
          "Cancel",
        )

        if (choice === "Apply") {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"))

          // Auto-save if configured
          const autoSave = config.get<boolean>("autoSave")
          if (autoSave) {
            const document = await vscode.workspace.openTextDocument(uri)
            await document.save()
          }
        }

        // Clean up temp file
        await vscode.workspace.fs.delete(tempUri)
      } else {
        // Apply directly
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(filePath),
          Buffer.from(content, "utf8"),
        )
      }

      this._view?.webview.postMessage({
        type: "fileWritten",
        path: filePath,
      })
    } catch (error) {
      this._view?.webview.postMessage({
        type: "error",
        message: `Failed to write file: ${error}`,
      })
    }
  }

  private async handleGetWorkspaceContext() {
    try {
      const workspace = vscode.workspace.workspaceFolders?.[0]
      if (!workspace) {
        this._view?.webview.postMessage({
          type: "workspaceContext",
          data: null,
        })
        return
      }

      // Get all code files
      const files = await vscode.workspace.findFiles(
        "**/*.{ts,tsx,js,jsx,py,go,rs,java,cpp,c,h}",
        "**/node_modules/**",
        100, // Limit to 100 files
      )

      // Get git info if available
      let gitInfo = null
      try {
        const gitExtension = vscode.extensions.getExtension("vscode.git")
        if (gitExtension) {
          const git = gitExtension.exports.getAPI(1)
          const repo = git.repositories[0]
          if (repo) {
            gitInfo = {
              branch: repo.state.HEAD?.name,
              changes: repo.state.workingTreeChanges.length,
            }
          }
        }
      } catch {}

      this._view?.webview.postMessage({
        type: "workspaceContext",
        data: {
          path: workspace.uri.fsPath,
          name: workspace.name,
          files: files.map((f) => f.fsPath),
          git: gitInfo,
        },
      })
    } catch (error) {
      this._view?.webview.postMessage({
        type: "error",
        message: `Failed to get workspace context: ${error}`,
      })
    }
  }

  private async handleApplyDiff(file: string, diff: string) {
    // Parse diff and apply changes
    // This is a simplified version - you'd want proper diff parsing
    await this.handleWriteFile(file, diff)
  }

  private async handleGetModels() {
    // Return available models
    const models = [
      {
        name: "gpt-4-turbo",
        provider: "openai",
        capabilities: ["text", "vision"],
        cost: { input: 0.01, output: 0.03 },
      },
      {
        name: "gpt-4o-mini",
        provider: "openai",
        capabilities: ["text", "vision"],
        cost: { input: 0.00015, output: 0.0006 },
      },
      {
        name: "claude-3-opus",
        provider: "anthropic",
        capabilities: ["text", "vision"],
        cost: { input: 0.015, output: 0.075 },
      },
      {
        name: "claude-3-haiku",
        provider: "anthropic",
        capabilities: ["text", "vision"],
        cost: { input: 0.00025, output: 0.00125 },
      },
      {
        name: "deepseek-coder",
        provider: "deepseek",
        capabilities: ["text"],
        cost: { input: 0.00014, output: 0.00028 },
      },
      {
        name: "qwen-vl",
        provider: "qwen",
        capabilities: ["text", "vision"],
        cost: { input: 0.0001, output: 0.0002 },
      },
      {
        name: "janus-pro",
        provider: "deepseek",
        capabilities: ["text", "vision", "generation"],
        cost: { input: 0.0002, output: 0.0004 },
      },
      {
        name: "ollama-local",
        provider: "ollama",
        capabilities: ["text"],
        cost: { input: 0, output: 0 },
      },
    ]

    this._view?.webview.postMessage({
      type: "models",
      data: models,
    })
  }

  private async handleSetModel(model: string) {
    const config = vscode.workspace.getConfiguration("sushi")
    await config.update(
      "defaultModel",
      model,
      vscode.ConfigurationTarget.Global,
    )

    this._view?.webview.postMessage({
      type: "modelSet",
      model,
    })
  }

  private async handleGetCostStats() {
    // Get cost stats from storage
    const stats = this._context.globalState.get("costStats", {
      today: 0,
      month: 0,
      saved: 0,
    })

    this._view?.webview.postMessage({
      type: "costStats",
      data: stats,
    })
  }

  private async getRecentFiles(): Promise<string[]> {
    // Get recently opened files from VS Code
    const recentFiles: string[] = []

    // Get all open editors
    vscode.window.visibleTextEditors.forEach((editor) => {
      recentFiles.push(editor.document.uri.fsPath)
    })

    return recentFiles
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get URIs for bundled React app
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview.js"),
    )

    // Use your existing Chrry UI compiled for VS Code
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">
      <title>Sushi Coder</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          font-family: var(--vscode-font-family);
        }
        #root {
          width: 100vw;
          height: 100vh;
        }
      </style>
    </head>
    <body>
      <div id="root"></div>
      <script src="${scriptUri}"></script>
    </body>
    </html>`
  }
}
