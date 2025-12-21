# Conditional Sushi Import

## Overview

How to conditionally import `@chrryai/sushi` in your Chrome extension based on mode.

## Method 1: React Lazy Loading (Recommended)

```typescript
import { lazy, Suspense } from "react"
import Loading from "@chrryai/chrry/Loading"

// Only loads when component is rendered
const CodeEditor = lazy(() =>
  import("@chrryai/sushi").then((mod) => ({ default: mod.CodeEditor }))
)

function App({ mode }) {
  if (mode === "sushi") {
    return (
      <Suspense fallback={<Loading />}>
        <CodeEditor filePath="src/App.tsx" />
      </Suspense>
    )
  }

  return <div>Other content</div>
}
```

**Benefits:**

- ✅ Automatic code splitting
- ✅ Only loads when needed
- ✅ Built-in loading state

---

## Method 2: Dynamic Import with Hook

```typescript
function useSushiComponents() {
  const [components, setComponents] = useState(null)

  const loadSushi = async () => {
    const sushi = await import("@chrryai/sushi")
    setComponents(sushi)
  }

  return { components, loadSushi }
}

function App({ mode }) {
  const { components, loadSushi } = useSushiComponents()

  useEffect(() => {
    if (mode === "sushi") {
      loadSushi()
    }
  }, [mode])

  if (mode === "sushi" && components) {
    return <components.CodeEditor filePath="src/App.tsx" />
  }

  return <div>Other content</div>
}
```

**Benefits:**

- ✅ More control over loading
- ✅ Can preload based on user intent
- ✅ Custom loading states

---

## Method 3: Webpack Magic Comments

```typescript
const CodeEditor = lazy(() =>
  import(
    /* webpackChunkName: "sushi" */
    /* webpackPrefetch: true */
    "@chrryai/sushi"
  ).then((mod) => ({ default: mod.CodeEditor })),
)
```

**Benefits:**

- ✅ Named chunks for debugging
- ✅ Prefetch hint for browser
- ✅ Better bundle analysis

---

## Complete Example

See [`ConditionalImport.example.tsx`](file:///Users/ibrahimvelinov/Documents/vex/packages/sushi/ConditionalImport.example.tsx) for full implementation.

---

## Bundle Impact

**Without Conditional Import:**

```
extension.js: 15MB (includes Monaco)
```

**With Conditional Import:**

```
extension.js: 500KB (main bundle)
sushi.chunk.js: 14.5MB (loaded only when mode === "sushi")
```

**Result:** 97% smaller initial bundle! 🎉

---

## Best Practices

1. **Use Suspense** for automatic loading states
2. **Lazy load** all heavy dependencies
3. **Prefetch** if user is likely to use Sushi
4. **Cache** loaded components to avoid re-loading

---

## Integration with Your Extension

```typescript
// In your extension's App.tsx
import { useSiteConfig } from "@chrryai/chrry/utils/siteConfig"

function App() {
  const { mode } = useSiteConfig()

  return <ExtensionApp mode={mode} />
}
```

This way, Sushi only loads when `mode === "sushi"`, keeping your extension fast and lean for other modes!
