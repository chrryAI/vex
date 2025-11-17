import * as vscode from "vscode"
import * as path from "path"

export class ModifiedFilesProvider
  implements vscode.TreeDataProvider<FileItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    FileItem | undefined | null | void
  > = new vscode.EventEmitter<FileItem | undefined | null | void>()
  readonly onDidChangeTreeData: vscode.Event<
    FileItem | undefined | null | void
  > = this._onDidChangeTreeData.event

  private modifiedFiles: Set<string> = new Set()

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  addFile(filePath: string): void {
    this.modifiedFiles.add(filePath)
    this.refresh()
  }

  removeFile(filePath: string): void {
    this.modifiedFiles.delete(filePath)
    this.refresh()
  }

  clearAll(): void {
    this.modifiedFiles.clear()
    this.refresh()
  }

  getTreeItem(element: FileItem): vscode.TreeItem {
    return element
  }

  getChildren(element?: FileItem): Thenable<FileItem[]> {
    if (!element) {
      // Root level - return all modified files
      const items = Array.from(this.modifiedFiles).map((filePath) => {
        const fileName = path.basename(filePath)
        const item = new FileItem(
          fileName,
          filePath,
          vscode.TreeItemCollapsibleState.None,
        )
        item.command = {
          command: "vscode.open",
          title: "Open File",
          arguments: [vscode.Uri.file(filePath)],
        }
        item.iconPath = new vscode.ThemeIcon("file-code")
        item.contextValue = "modifiedFile"
        return item
      })

      return Promise.resolve(items)
    }

    return Promise.resolve([])
  }
}

class FileItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly filePath: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState)
    this.tooltip = filePath
    this.description = path.dirname(filePath)
  }
}
