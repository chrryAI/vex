import * as vscode from "vscode"
import { ChatViewProvider } from "./providers/chatProvider"
import { ModifiedFilesProvider } from "./providers/modifiedFilesProvider"

export function activate(context: vscode.ExtensionContext) {
  console.log("🍇 Sushi Coder extension activated!")

  // Register chat webview provider
  const chatProvider = new ChatViewProvider(context.extensionUri, context)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("sushi.chatView", chatProvider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }),
  )

  // Register modified files tree view
  const modifiedFilesProvider = new ModifiedFilesProvider()
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "sushi.filesView",
      modifiedFilesProvider,
    ),
  )

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("sushi.openChat", () => {
      vscode.commands.executeCommand("sushi.chatView.focus")
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("sushi.explainCode", async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showWarningMessage("No active editor")
        return
      }

      const selection = editor.selection
      const text = editor.document.getText(selection)

      if (!text) {
        vscode.window.showWarningMessage("No code selected")
        return
      }

      chatProvider.sendMessage({
        type: "explain",
        code: text,
        language: editor.document.languageId,
        file: editor.document.uri.fsPath,
      })

      // Focus chat view
      vscode.commands.executeCommand("sushi.chatView.focus")
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("sushi.refactorCode", async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return

      const selection = editor.selection
      const text = editor.document.getText(selection)

      if (!text) {
        vscode.window.showWarningMessage("No code selected")
        return
      }

      chatProvider.sendMessage({
        type: "refactor",
        code: text,
        language: editor.document.languageId,
        file: editor.document.uri.fsPath,
      })

      vscode.commands.executeCommand("sushi.chatView.focus")
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("sushi.generateTests", async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return

      const selection = editor.selection
      const text = editor.document.getText(selection)

      if (!text) {
        vscode.window.showWarningMessage("No code selected")
        return
      }

      chatProvider.sendMessage({
        type: "generateTests",
        code: text,
        language: editor.document.languageId,
        file: editor.document.uri.fsPath,
      })

      vscode.commands.executeCommand("sushi.chatView.focus")
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("sushi.fixCode", async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return

      const selection = editor.selection
      const text = editor.document.getText(selection)

      if (!text) {
        vscode.window.showWarningMessage("No code selected")
        return
      }

      // Get diagnostics for selected range
      const diagnostics = vscode.languages.getDiagnostics(editor.document.uri)
      const relevantDiagnostics = diagnostics.filter((d) =>
        d.range.intersection(selection),
      )

      chatProvider.sendMessage({
        type: "fix",
        code: text,
        language: editor.document.languageId,
        file: editor.document.uri.fsPath,
        errors: relevantDiagnostics.map((d) => ({
          message: d.message,
          severity: d.severity,
          line: d.range.start.line,
        })),
      })

      vscode.commands.executeCommand("sushi.chatView.focus")
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("sushi.screenshotToCode", async () => {
      // Prompt user to select image
      const imageUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          Images: ["png", "jpg", "jpeg", "gif", "webp"],
        },
        title: "Select screenshot to convert to code",
      })

      if (!imageUri || imageUri.length === 0) return

      chatProvider.sendMessage({
        type: "screenshotToCode",
        image: imageUri[0].fsPath,
      })

      vscode.commands.executeCommand("sushi.chatView.focus")
    }),
  )

  // Watch for file changes to update modified files view
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.isDirty) {
        modifiedFilesProvider.addFile(event.document.uri.fsPath)
      }
    }),
  )

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      modifiedFilesProvider.removeFile(document.uri.fsPath)
    }),
  )
}

export function deactivate() {
  console.log("🍇 Sushi Coder extension deactivated")
}
