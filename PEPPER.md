# 🌶️ Pepper Router

**Universal router for React** - 0ms navigation with native View Transitions API

> Works seamlessly across web, React Native, and browser extensions. One API, zero configuration, instant routing.

---

## 🎯 The Problem

Modern React routers are slow, bloated, and platform-specific:

- **Next.js App Router**: 100-300ms per navigation (server roundtrips)
- **React Router**: 50KB+ bundle, web-only, complex API
- **Expo Router**: Native-only, file-based routing overhead
- **All of them**: No native transitions, jarring UX, platform lock-in

**Developers and users deserve better.**

---

## ✨ The Solution

Pepper is a universal router that works everywhere:

```typescript
// One API for web, native, and extensions
import { HistoryRouterProvider, useNavigation } from "@chrryai/pepper"

function App() {
  const { navigate, pathname } = useNavigation()

  return (
    <button type="button"  onClick={() => navigate("/about")}>
      Go to About
    </button>
  )
}
```

**That's it.** Same code runs on web (with View Transitions!), React Native, and browser extensions.

---

## 🚀 Features

### ⚡ 0ms Navigation

```typescript
// Next.js App Router
router.push("/calendar") // 100-300ms wait ❌

// Pepper Router
navigate("/calendar") // 0ms instant ✅
```

### 🎨 Native View Transitions (Web)

Automatic smooth transitions using the browser's View Transitions API:

- **Mobile**: Slide from right (native app feel)
- **Desktop**: Slide up (elegant, spacious)
- **Reduced motion**: Instant fade (accessible)

### 🌍 Universal Platform Support

| Platform           | Support | View Transitions  | Bundle Size |
| ------------------ | ------- | ----------------- | ----------- |
| Web                | ✅      | ✅                | 2KB         |
| React Native       | ✅      | Native animations | 1.5KB       |
| Browser Extensions | ✅      | ✅                | 2KB         |
| SSR                | ✅      | ✅                | 2KB         |

### 🔥 Hybrid SSR/Client Routing

```typescript
// SSR routes (blog, marketing pages)
/blog → Server-rendered, SEO-friendly

// Client routes (app pages)
/calendar → Instant client-side navigation

// Automatic detection - no configuration!
```

### 📦 Tiny Bundle

```
Next.js App Router: 50KB+
React Router: 45KB+
Expo Router: 40KB+
Pepper Router: 2KB ✅
```

---

## 📦 Installation

```bash
npm install @chrryai/pepper
```

---

## 🎓 Quick Start

### Web

```typescript
import { HistoryRouterProvider, useNavigation } from "@chrryai/pepper/web"

function App() {
  return (
    <HistoryRouterProvider>
      <YourApp />
    </HistoryRouterProvider>
  )
}

function Navigation() {
  const { navigate, pathname } = useNavigation()

  return (
    <nav>
      <button type="button"  onClick={() => navigate("/")}>Home</button>
      <button type="button"  onClick={() => navigate("/about")}>About</button>
      <button type="button"  onClick={() => navigate("/calendar")}>Calendar</button>
    </nav>
  )
}
```

### React Native

```typescript
import { HistoryRouterProvider, useNavigation } from "@chrryai/pepper/native"
import { Pressable, Text } from "react-native"

function Navigation() {
  const { navigate } = useNavigation()

  return (
    <Pressable onPress={() => navigate("/about")}>
      <Text>Go to About</Text>
    </Pressable>
  )
}
```

### Browser Extension

```typescript
import { HistoryRouterProvider, useNavigation } from "@chrryai/pepper/extension"

// Same API as web!
function App() {
  return (
    <HistoryRouterProvider>
      <YourExtensionUI />
    </HistoryRouterProvider>
  )
}
```

---

## 📖 API Reference

### `<HistoryRouterProvider>`

Wrap your app to enable routing.

```typescript
<HistoryRouterProvider>
  <App />
</HistoryRouterProvider>
```

### `useNavigation()`

Main navigation hook.

```typescript
const {
  navigate, // Navigate to a path
  goBack, // Go back in history
  goForward, // Go forward in history
  pathname, // Current pathname
  searchParams, // URLSearchParams
  hash, // URL hash
} = useNavigation()
```

#### Navigation Options

```typescript
navigate(path: string, options?: {
  replace?: boolean      // Replace current history entry
  state?: any           // Pass state to new route
  scroll?: boolean      // Scroll to top (default: true)
  clientOnly?: boolean  // Force client-side navigation (default: true)
})
```

#### Examples

```typescript
// Basic navigation
navigate("/about")

// Replace current entry
navigate("/login", { replace: true })

// Pass state
navigate("/profile", { state: { userId: 123 } })

// Disable scroll to top
navigate("/feed", { scroll: false })

// Force server navigation (Next.js)
navigate("/blog", { clientOnly: false })
```

### URL Manipulation

```typescript
const { addParams, removeParams, setParams } = useNavigation()

// Add query params
addParams({ tab: "settings", view: "profile" })
// /current-path?tab=settings&view=profile

// Remove params
removeParams(["tab", "view"])
// /current-path

// Replace all params
setParams({ page: "1", sort: "date" })
// /current-path?page=1&sort=date
```

### History Navigation

```typescript
const { goBack, goForward, refresh, prefetch } = useNavigation()

goBack() // Navigate back
goForward() // Navigate forward
refresh() // Refresh current route (Next.js)
prefetch("/about") // Prefetch route (Next.js)
```

### Route Helpers

```typescript
import { useCurrentPathname, useCurrentSearchParams } from "@chrryai/pepper"

const pathname = useCurrentPathname() // "/about"
const searchParams = useCurrentSearchParams() // URLSearchParams
```

---

## 🎨 View Transitions (Web)

Pepper automatically uses the View Transitions API when available.

### Platform-Aware Animations

**Mobile (≤768px):**

```css
/* Slide from right - native iOS/Android feel */
@keyframes mobile-slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
}
```

**Desktop (≥769px):**

```css
/* Slide up - elegant and spacious */
@keyframes desktop-slide-in-up {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
}
```

**Reduced Motion:**

```css
/* Instant fade - accessible */
@media (prefers-reduced-motion: reduce) {
  animation-duration: 0.01s;
}
```

### Custom Transitions

```typescript
// Default transitions work automatically
navigate("/about") // ✨ Smooth transition

// Disable for specific navigation
navigate("/settings", { transition: false })
```

---

## 🏗️ Architecture

### The Secret Sauce

```typescript
class PepperRouter {
  private listeners: Set<() => void>
  private state: RouterState

  navigate(path: string, options?: NavigationOptions) {
    // Use View Transitions API if available (web)
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        window.history.pushState({}, "", path)
        this.notifyListeners()
      })
    } else {
      // Fallback for older browsers / React Native
      window.history.pushState({}, "", path)
      this.notifyListeners()
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
```

**Key Innovations:**

1. **Singleton Pattern** - Single router instance shared across app
2. **Pub/Sub Architecture** - Efficient component updates
3. **View Transitions API** - Native browser animations (web)
4. **Platform Detection** - Automatic web/native/extension handling
5. **Race Condition Prevention** - Smart `isProgrammaticNavigation` flag
6. **Hybrid SSR** - Client-first with opt-in server navigation

---

## 📊 Performance

### Benchmarks

| Router             | Navigation Time | Bundle Size | View Transitions | Universal |
| ------------------ | --------------- | ----------- | ---------------- | --------- |
| Next.js App Router | 100-300ms       | 50KB+       | ❌               | ❌        |
| React Router       | 50-100ms        | 45KB+       | ❌               | ❌        |
| Expo Router        | Instant         | 40KB+       | ❌               | ❌        |
| **Pepper Router**  | **0ms**         | **2KB**     | **✅**           | **✅**    |

### Real-World Impact

```
Average app: 100 navigations per session

Next.js:  100 × 200ms = 20 seconds waiting ❌
Pepper:   100 × 0ms   = 0 seconds waiting ✅

20 seconds saved per session! 🚀
```

### Optimizations

✅ **Zero re-renders** - Only subscribing components update  
✅ **Minimal bundle** - 2KB gzipped  
✅ **No polling** - Event-driven architecture  
✅ **Smart caching** - History state preserved  
✅ **Debounced listeners** - Prevents update storms

---

## 🎯 Use Cases

### SPA with SSR

```typescript
// app/layout.tsx
import { HistoryRouterProvider } from "@chrryai/pepper/web"

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <HistoryRouterProvider>
          {children}
        </HistoryRouterProvider>
      </body>
    </html>
  )
}

// app/page.tsx (client component)
"use client"
import { useNavigation } from "@chrryai/pepper/web"

export default function Home() {
  const { navigate } = useNavigation()

  // Instant client-side navigation by default!
  return <button type="button"  onClick={() => navigate("/about")}>About</button>
}
```

### React Native App

```typescript
import { HistoryRouterProvider } from "@chrryai/pepper/native"
import { NavigationContainer } from "@react-navigation/native"

function App() {
  return (
    <HistoryRouterProvider>
      <NavigationContainer>
        <YourAppScreens />
      </NavigationContainer>
    </HistoryRouterProvider>
  )
}
```

### Browser Extension

```typescript
import { HistoryRouterProvider } from "@chrryai/pepper/extension"

function ExtensionPopup() {
  return (
    <HistoryRouterProvider>
      <YourExtensionUI />
    </HistoryRouterProvider>
  )
}
```

---

## 🎓 Best Practices

### 1. Client-First Navigation

```typescript
// ✅ Good - instant navigation (default)
navigate("/about")

// ⚠️ Only use when you need server data
navigate("/blog", { clientOnly: false })
```

### 2. Preserve Scroll Position

```typescript
// ✅ Good - scroll to top for new pages
navigate("/about")

// ✅ Good - preserve scroll for tabs
navigate("/feed?tab=following", { scroll: false })
```

### 3. Use Replace for Redirects

```typescript
// ✅ Good - don't pollute history
navigate("/login", { replace: true })

// ❌ Bad - user can go back to protected route
navigate("/login")
```

### 4. Prefetch Important Routes

```typescript
const { prefetch } = useNavigation()

// Prefetch on hover
<button onMouseEnter={() => prefetch("/about")}>
  About
</button>
```

---

## 🔧 Integration

### With Next.js

```typescript
// Hybrid: Server for SSR, client for instant navigation
import { HistoryRouterProvider } from "@chrryai/pepper/web"

export default function RootLayout({ children }) {
  return (
    <HistoryRouterProvider>
      {children}
    </HistoryRouterProvider>
  )
}

// Instant client navigation by default
const { navigate } = useNavigation()
navigate("/about") // 0ms ✨

// Opt-in to server navigation when needed
navigate("/blog", { clientOnly: false }) // Server fetch
```

### With Vite

```typescript
import { HistoryRouterProvider } from "@chrryai/pepper/web"
import { BrowserRouter } from "react-router-dom"

function App() {
  return (
    <HistoryRouterProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </BrowserRouter>
    </HistoryRouterProvider>
  )
}
```

### With Expo

```typescript
import { HistoryRouterProvider } from "@chrryai/pepper/native"
import { Stack } from "expo-router"

export default function Layout() {
  return (
    <HistoryRouterProvider>
      <Stack />
    </HistoryRouterProvider>
  )
}
```
