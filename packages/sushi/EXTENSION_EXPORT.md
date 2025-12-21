# Extension Conditional Export

## Overview

How to conditionally export Sushi from your extension based on mode.

## Architecture

```
@chrryai/sushi
    ↓ (imports full UI)
@chrryai/chrry (complete UI package)
    ↓
Extension (conditionally exports based on mode)
```

## Implementation

### 1. Sushi Package Structure

```typescript
// packages/sushi/src/SushiIDE.tsx
import { Div, H1, Button } from "@chrryai/chrry/platform"
import { useAuth } from "@chrryai/chrry/hooks/useAuth"

export function SushiIDE({ rootPath }) {
  // Complete IDE with full UI
  return <Div>...</Div>
}
```

### 2. Extension Conditional Export

```typescript
// In your extension (e.g., apps/extension/src/App.tsx)
import { useSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import { lazy, Suspense } from "react"

export function App() {
  const { mode } = useSiteConfig()

  // Only load Sushi when mode === "sushi"
  if (mode === "sushi") {
    const SushiIDE = lazy(() =>
      import("@chrryai/sushi").then((m) => ({ default: m.SushiIDE }))
    )

    return (
      <Suspense fallback={<Loading />}>
        <SushiIDE rootPath="/path/to/project" />
      </Suspense>
    )
  }

  // Other modes don't load Sushi at all
  return <div>Other content</div>
}
```

## Key Points

### ✅ Sushi Package

- Imports **full** `@chrryai/chrry` UI
- Self-contained IDE experience
- Uses all platform primitives, hooks, components

### ✅ Extension

- Conditionally exports based on `mode`
- Only loads Sushi when `mode === "sushi"`
- Other modes never see Sushi code

### ✅ Bundle Splitting

**When mode !== "sushi":**

```
extension.js: 500KB (no Sushi, no Monaco)
```

**When mode === "sushi":**

```
extension.js: 500KB (main bundle)
sushi.chunk.js: 15MB (Sushi + Monaco, lazy loaded)
```

## Complete Example

See [`ExtensionExport.example.tsx`](file:///Users/ibrahimvelinov/Documents/vex/packages/sushi/ExtensionExport.example.tsx) for full implementation.

## Usage

```typescript
// Extension entry point
import { ExtensionApp } from "./App"

ReactDOM.render(<ExtensionApp />, document.getElementById("root"))
```

The extension will:

1. Check `mode` from `useSiteConfig()`
2. If `mode === "sushi"`, lazy load `@chrryai/sushi`
3. If other mode, Sushi never loads

This keeps your extension lean and fast! 🚀
