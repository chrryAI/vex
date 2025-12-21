# 🍣 Sushi

Browser-First IDE components for Chrome extensions.

## Installation

```bash
pnpm add @chrryai/sushi
```

## Usage

**⚠️ Chrome Extension Only** - Do not import in React Native or Firefox builds.

```typescript
// In your Chrome extension
import { CodeEditor, FileExplorer } from "@chrryai/sushi"

function IDE() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <FileExplorer
        rootPath="/path/to/project"
        onFileSelect={setSelectedFile}
        selectedFile={selectedFile}
      />
      <CodeEditor filePath={selectedFile} aiEnabled={true} />
    </div>
  )
}
```

## Components

### CodeEditor

Monaco Editor with AI autocomplete and file operations via Sushi Bridge.

**Props:**

- `filePath: string | null` - Path to file to edit
- `aiEnabled?: boolean` - Enable AI autocomplete (default: true)
- `onContentChange?: (content: string) => void` - Callback when content changes

### FileExplorer

File tree navigator with Sushi Bridge integration.

**Props:**

- `rootPath: string` - Root directory path
- `onFileSelect: (path: string) => void` - Callback when file is selected
- `selectedFile: string | null` - Currently selected file path

### useBridgeFile

Hook for file operations via Sushi Bridge.

**Returns:**

- `content: string | null` - File content
- `isLoading: boolean` - Loading state
- `error: string | null` - Error message
- `loadFile: (path: string) => Promise<void>` - Load file
- `saveFile: (path: string, content: string) => Promise<void>` - Save file
- `isDirty: boolean` - Has unsaved changes

### useAICompletion

Hook for AI-powered code completion.

**Params:**

- `editor: Monaco.editor.IStandaloneCodeEditor | null` - Monaco editor instance
- `enabled: boolean` - Enable AI completion

## Dependencies

- `@chrryai/chrry` - Shared UI components and platform primitives
- `@monaco-editor/react` - Monaco Editor React wrapper
- `monaco-editor` - VS Code editor core

## Requirements

- Sushi Bridge installed and running
- Chrome extension with `nativeMessaging` permission
- `/api/ai` endpoint for AI completions

## License

AGPL-3.0
