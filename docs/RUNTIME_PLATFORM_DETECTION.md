# 🚀 Runtime Platform Detection

## Overview

**ONE codebase, ALL platforms!** No more `.native.tsx` or `.web.tsx` files. The app decides at runtime which platform it's on and adapts automatically.

## Architecture

```
┌─────────────────────────────────────────┐
│         Your Component Code             │
│    (Weather.tsx, Thread.tsx, etc.)      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      Platform Abstraction Layer         │
│  - PlatformProvider (Context)           │
│  - usePlatform() Hook                   │
│  - Platform-aware Components            │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
   ┌────────┐    ┌────────┐
   │   Web  │    │ Native │
   │  <div> │    │ <View> │
   │ <span> │    │ <Text> │
   └────────┘    └────────┘
```

## Setup

### 1. Wrap your app with PlatformProvider

```tsx
// apps/web/app/layout.tsx (Web)
import { PlatformProvider } from "chrry/platform"

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PlatformProvider>{children}</PlatformProvider>
      </body>
    </html>
  )
}
```

```tsx
// apps/native/App.tsx (Native)
import { PlatformProvider } from "chrry/platform"

export default function App() {
  return (
    <PlatformProvider>
      <Navigation />
    </PlatformProvider>
  )
}
```

### 2. Use platform-aware components

```tsx
// packages/ui/Weather.tsx
import { Box, Text, usePlatform } from "chrry/platform"

export function Weather() {
  const { isWeb, isNative, select } = usePlatform()

  return (
    <Box>
      <Text>Running on: {isWeb ? "Web" : "Native"}</Text>
    </Box>
  )
}
```

## API Reference

### usePlatform() Hook

```tsx
const {
  // Platform detection
  platform, // 'web' | 'ios' | 'android' | 'native'
  isWeb, // boolean
  isNative, // boolean
  isIOS, // boolean
  isAndroid, // boolean

  // Feature flags
  supportsHover, // boolean
  supportsTouch, // boolean
  supportsKeyboard, // boolean
  supportsGestures, // boolean
  supportsCamera, // boolean
  supportsNotifications, // boolean

  // Device type
  isMobile, // boolean
  isTablet, // boolean
  isDesktop, // boolean

  // Value selector
  select, // function
} = usePlatform()
```

### Platform-Aware Components

| Component      | Web Renders        | Native Renders |
| -------------- | ------------------ | -------------- |
| `<Box>`        | `<div>`            | `<View>`       |
| `<Text>`       | `<span>`           | `<Text>`       |
| `<Button>`     | `<button>`         | `<Pressable>`  |
| `<Link>`       | `<a>`              | `<Pressable>`  |
| `<Input>`      | `<input>`          | `<TextInput>`  |
| `<ScrollView>` | `<div>` (overflow) | `<ScrollView>` |
| `<Image>`      | `<img>`            | `<Image>`      |

### Semantic Aliases

```tsx
<Div>      // <Box as="div">
<Section>  // <Box as="section">
<Header>   // <Box as="header">
<Footer>   // <Box as="footer">
<Nav>      // <Box as="nav">
<Main>     // <Box as="main">
<Aside>    // <Box as="aside">

<Span>     // <Text as="span">
<P>        // <Text as="p">
<H1>       // <Text as="h1">
<H2>       // <Text as="h2">
<H3>       // <Text as="h3">
<Strong>   // <Text as="strong">
<Em>       // <Text as="em">
<Small>    // <Text as="small">
<Code>     // <Text as="code">
<Label>    // <Text as="label">
```

## Usage Examples

### Basic Platform Detection

```tsx
import { usePlatform, Box, Text } from "chrry/platform"

function MyComponent() {
  const { isWeb, isNative } = usePlatform()

  return (
    <Box>
      <Text>Platform: {isWeb ? "Web" : "Native"}</Text>
    </Box>
  )
}
```

### Platform-Specific Values

```tsx
import { usePlatform } from "chrry/platform"

function MyComponent() {
  const { select } = usePlatform()

  const fontSize = select({
    ios: 16,
    android: 14,
    web: 15,
    default: 14,
  })

  const padding = select({
    native: 12,
    web: 16,
    default: 12,
  })

  return <Text style={{ fontSize, padding }}>Hello</Text>
}
```

### Adaptive Styles

```tsx
import { useAdaptiveStyles } from "chrry/platform"
import { WeatherStyles } from "./Weather.styles"

function Weather() {
  const styles = useAdaptiveStyles(WeatherStyles, {
    container: {
      web: {
        cursor: "pointer",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      },
      native: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    },
  })

  return <Box style={styles.container}>...</Box>
}
```

### Conditional Rendering

```tsx
import { PlatformSwitch, WebOnly, NativeOnly } from "chrry/platform"

function MyComponent() {
  return (
    <Box>
      {/* Method 1: PlatformSwitch */}
      <PlatformSwitch
        web={<div>Web-specific content</div>}
        native={<Text>Native-specific content</Text>}
        ios={<Text>ios-specific content</Text>}
        android={<Text>Android-specific content</Text>}
      />

      {/* Method 2: Conditional components */}
      <WebOnly>
        <div>Only visible on web</div>
      </WebOnly>

      <NativeOnly>
        <Text>Only visible on native</Text>
      </NativeOnly>
    </Box>
  )
}
```

### Responsive Styles

```tsx
import { useResponsiveStyles } from "chrry/platform"

function MyComponent() {
  const styles = useResponsiveStyles({
    container: {
      base: { padding: 8 },
      sm: { padding: 12 },
      md: { padding: 16 },
      lg: { padding: 24 },
    },
  })

  return <Box style={styles.container}>...</Box>
}
```

### Complete Example: Weather Component

```tsx
import { Box, Text, usePlatform, useAdaptiveStyles } from "chrry/platform"
import { WeatherStyles } from "./Weather.styles"

interface WeatherProps {
  location: string
  temperature: number
  condition: string
  onClick?: () => void
}

export function Weather({
  location,
  temperature,
  condition,
  onClick,
}: WeatherProps) {
  const { isWeb, select } = usePlatform()

  // Adapt SCSS styles for current platform
  const styles = useAdaptiveStyles(WeatherStyles, {
    weather: {
      native: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      },
    },
    location: {
      web: {
        cursor: "pointer",
        userSelect: "none",
      },
    },
  })

  // Platform-specific values
  const fontSize = select({
    ios: 14,
    android: 13,
    web: 14,
    default: 13,
  })

  return (
    <Box style={styles.weather}>
      <Box
        style={styles.location}
        onClick={onClick}
        onHover={() => isWeb && console.log("Hover!")}
      >
        <Text style={{ fontSize, color: "#3b82f6" }}>{location}</Text>
      </Box>

      <Box style={styles.info}>
        <Text>
          {temperature}°F • {condition}
        </Text>
      </Box>
    </Box>
  )
}
```

## Migration Strategy

### Step 1: Wrap app with PlatformProvider

```tsx
// Both web and native apps
<PlatformProvider>
  <App />
</PlatformProvider>
```

### Step 2: Convert components to use platform primitives

```tsx
// Before
<div className={styles.container}>
  <span>Hello</span>
</div>

// After
<Box style={styles.container}>
  <Text>Hello</Text>
</Box>
```

### Step 3: Add platform-specific logic

```tsx
const { isWeb, select } = usePlatform()

const fontSize = select({
  web: 16,
  native: 14,
  default: 14,
})
```

### Step 4: Use adaptive styles

```tsx
const styles = useAdaptiveStyles(MyStyles, {
  container: {
    web: { cursor: "pointer" },
    native: { elevation: 2 },
  },
})
```

## Benefits

### ✅ Single Codebase

- No more `.native.tsx` and `.web.tsx` files
- One component works everywhere
- Easier to maintain

### ✅ Runtime Detection

- App decides platform at runtime
- No compile-time branching
- Dynamic adaptation

### ✅ Type Safety

- Full TypeScript support
- Platform-aware types
- Autocomplete works

### ✅ Performance

- No unnecessary code bundled
- Tree-shaking works
- Optimized for each platform

### ✅ Developer Experience

- Write once, run everywhere
- Easy to test
- Clear API

## Best Practices

### ✅ Do:

```tsx
// Use platform primitives
;<Box>
  <Text>Hello</Text>
</Box>

// Use usePlatform hook
const { isWeb } = usePlatform()

// Use select for platform-specific values
const value = select({ web: 10, native: 8, default: 8 })

// Use adaptive styles
const styles = useAdaptiveStyles(MyStyles, overrides)
```

### ❌ Don't:

```tsx
// Don't mix HTML and primitives
;<div>
  <Text>Hello</Text>
</div> // ❌

// Don't use Platform.OS directly
if (Platform.OS === "web") {
} // ❌
// Use usePlatform() instead

// Don't hardcode platform checks
if (typeof window !== "undefined") {
} // ❌
// Use isWeb instead

// Don't create separate files
MyComponent.native.tsx // ❌
MyComponent.web.tsx // ❌
// Use ONE file with runtime detection
```

## Troubleshooting

### Issue: "usePlatform must be used within PlatformProvider"

**Solution:** Wrap your app with `<PlatformProvider>`:

```tsx
<PlatformProvider>
  <App />
</PlatformProvider>
```

### Issue: Styles not applying correctly

**Solution:** Use `useAdaptiveStyles` to filter web-only properties:

```tsx
const styles = useAdaptiveStyles(MyStyles)
```

### Issue: TypeScript errors with props

**Solution:** The platform primitives handle type differences automatically. If you see errors, you may need to cast or use platform-specific props.

## Next Steps

1. ✅ Set up PlatformProvider
2. ✅ Convert components to use platform primitives
3. ✅ Add platform-specific logic with usePlatform
4. ✅ Test on all platforms
5. 🚀 Ship to production!

---

**ONE codebase, ALL platforms! 🎉**
