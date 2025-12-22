# Spatial Navigation Architecture

## Overview

Focus introduces a revolutionary **N-dimensional spatial navigation system** that combines zoom-based navigation (like Apple Watch OS) with cross-store teleportation and infinite nesting capabilities. This architecture enables users to navigate seamlessly between stores, apps, and contexts while maintaining perfect spatial memory.

## Core Concepts

### 1. Store-Based Apps (Base Apps)

**Store-based apps** are the foundation of spatial navigation. They serve as:

- **Navigation anchors** - Entry points to each store's universe
- **Context carriers** - Maintain the parent store reference
- **Breadcrumb generators** - Create the "back" navigation path

```typescript
interface App {
  id: string
  name: string
  store: Store
  slug: string
}

interface Store {
  app: App
  slug: string
}
```

**Key Properties:**

- Each store MUST have at least one base app
- Base apps appear in the navigation bar
- Base apps enable cross-store navigation
- Base apps preserve spatial memory

### 2. Navigation States

The system operates in three distinct navigation states:

#### State A: Store Home (Base App Active)

```
Current Location: Vex Store (base app)
Visible Buttons: [Blossom] [Perplexity] [Sushi] [Claude]
Hidden: Vex (you're already here)
```

#### State B: In-Store App Navigation

```
Current Location: Blossom Store → Chrry App
Visible Buttons: [Vex] [Blossom] [Sushi] [Claude]
Note: Blossom button appears (back to store home)
      Chrry button replaces Blossom in nav
```

#### State C: Cross-Store Navigation

```
Current Location: Perplexity Store (from Blossom)
Visible Buttons: [Vex] [Blossom] [Chrry] [Claude]
Hidden: Perplexity (current location)
New: Blossom (back path)
```

## Navigation Rules

### Rule 1: Same-Store App Switching

```typescript
if (clickedApp.store === currentStore) {
  // SWITCH app within current store
  replaceCurrentAppButton(with: storeBaseApp)
  switchToApp(clickedApp)
  preserveStoreContext()
}
```

**Behavior:**

- Button morphs to show store base app
- App switches without navigation
- Store context preserved
- Spatial memory maintained

**Example:**

```
Location: Blossom Store
Click: Chrry (same store)
Result: Switch to Chrry app
        Blossom button appears (back to store home)
```

### Rule 2: Cross-Store Navigation

```typescript
if (clickedApp.store !== currentStore) {
  // NAVIGATE to different store
  navigateToStore(clickedApp.store)
  replaceClickedButton(with: currentStoreBaseApp)
  updateSpatialMemory()
}
```

**Behavior:**

- Navigate to target store
- Current store button appears (back path)
- Target store button disappears (you're there)
- Full context switch

**Example:**

```
Location: Blossom Store
Click: Sushi (different store)
Result: Navigate to Sushi Store
        Blossom button appears (back path)
        Sushi button disappears (current location)
```

### Rule 3: Chrry Anchor Navigation

```typescript
// Chrry is always the home anchor
if (clickedApp.name === "Chrry") {
  navigateToOriginalStore()
  resetSpatialMemory()
}
```

**Behavior:**

- Always returns to original store (home base)
- Resets navigation stack
- Clears spatial memory
- Fresh start

## Technical Implementation

### Component Architecture

```typescript
const StoreApp = useCallback(
  () =>
    storeApp && (
      <A
        href={getAppSlug(storeApp)}
        onClick={(e) => {
          e.preventDefault()

          // Update spatial memory
          setIsNewChat(true, getAppSlug(storeApp))

          // Haptic feedback
          addHapticFeedback()

          // Clear app status
          setAppStatus(undefined)

          // Handle meta/ctrl for power users
          if (e.metaKey || e.ctrlKey) {
            return // Open in new context
          }
        }}
      >
        <Img app={storeApp} size={24} />
        <span>{storeApp?.name}</span>
      </A>
    ),
  [t, app, user, guest],
)
```

### State Management

```typescript
interface SpatialState {
  currentStore: Store
  currentApp: App
  navigationStack: Store[]
  storeBaseApp: App
  visibleButtons: App[]
}

// Update navigation state
function updateSpatialState(targetApp: App) {
  const isSameStore = targetApp.store === currentStore

  if (isSameStore) {
    // Same store - switch app
    return {
      currentApp: targetApp,
      currentStore: currentStore,
      navigationStack: [...navigationStack],
      visibleButtons: [
        ...otherStoreApps,
        currentStore.baseApp, // Show store home button
      ],
    }
  } else {
    // Different store - navigate
    return {
      currentApp: targetApp.store.baseApp,
      currentStore: targetApp.store,
      navigationStack: [...navigationStack, currentStore],
      visibleButtons: [
        ...otherStoreApps.filter((a) => a.store !== targetApp.store),
        currentStore.baseApp, // Show back button
      ],
    }
  }
}
```

### Button Visibility Logic

```typescript
function getVisibleButtons(
  currentStore: Store,
  currentApp: App,
  allStoreApps: App[],
): App[] {
  return allStoreApps.filter((app) => {
    // Hide current store's base app (you're already there)
    if (app.store === currentStore && app.isBaseApp) {
      return false
    }

    // Show all other store base apps
    if (app.isBaseApp) {
      return true
    }

    // Show current app if not base app (for back navigation)
    if (app.id === currentApp.id && !currentApp.isBaseApp) {
      return true
    }

    return false
  })
}
```

## User Experience Flow

### Journey 1: Deep Nesting

```
1. Start: Vex Store (home)
   Buttons: [Blossom] [Perplexity] [Sushi] [Claude]

2. Click: Blossom
   Navigate to: Blossom Store
   Buttons: [Vex] [Perplexity] [Sushi] [Claude]

3. Click: Chrry (in Blossom)
   Switch to: Chrry app
   Buttons: [Vex] [Blossom] [Sushi] [Claude]

4. Click: Perplexity
   Navigate to: Perplexity Store
   Buttons: [Vex] [Blossom] [Chrry] [Claude]

5. Click: Vex
   Navigate back to: Vex Store (home)
   Buttons: [Blossom] [Perplexity] [Sushi] [Claude]
```

### Journey 2: Cross-Store App Discovery

```
1. Location: Blossom Store
   Discover: New app "Focus" in Sushi Store

2. Click: Sushi button
   Navigate to: Sushi Store
   See: Focus app available

3. Click: Focus app
   Switch to: Focus (within Sushi Store)
   Buttons: [Vex] [Blossom] [Sushi] [Claude]

4. Click: Blossom
   Navigate back to: Blossom Store
   Context: Preserved, ready to continue
```

## Advantages Over Traditional Navigation

### vs Apple Watch OS

| Feature              | Apple Watch | Focus Spatial Nav |
| -------------------- | ----------- | ----------------- |
| Depth                | 1 level     | Infinite          |
| Cross-navigation     | ❌          | ✅                |
| Context preservation | ❌          | ✅                |
| Dynamic UI           | ❌          | ✅                |
| Spatial memory       | ❌          | ✅                |

### vs Browser Tabs

| Feature           | Browser Tabs | Focus Spatial Nav |
| ----------------- | ------------ | ----------------- |
| Nesting           | ❌           | ✅                |
| Context switching | Manual       | Automatic         |
| Spatial awareness | ❌           | ✅                |
| Back navigation   | Linear       | Multi-dimensional |

### vs Traditional Sidebar

| Feature          | Sidebar | Focus Spatial Nav |
| ---------------- | ------- | ----------------- |
| Space efficiency | Low     | High              |
| Context clarity  | Low     | High              |
| Navigation speed | Slow    | Fast              |
| Cognitive load   | High    | Low               |

## Design Principles

### 1. Self-Documenting Interface

The navigation bar itself communicates:

- **What's visible** = Where you can go
- **What's missing** = Where you are
- **What appears** = Where you came from

### 2. Zero Cognitive Load

Users never need to remember:

- Where they are (missing button shows location)
- Where they came from (new button shows back path)
- Where they can go (visible buttons show options)

### 3. Infinite Scalability

The system supports:

- Unlimited stores
- Unlimited apps per store
- Unlimited nesting depth
- Unlimited cross-store navigation

### 4. Context Preservation

Every navigation maintains:

- Current store context
- Current app state
- Navigation history
- Spatial memory

## Implementation Guidelines

### For Store Creators

**1. Always Define a Base App**

```typescript
const store = {
  id: "my-store",
  name: "My Store",
  baseApp: {
    id: "my-store-home",
    name: "My Store",
    isBaseApp: true,
    store: "my-store",
  },
}
```

**2. Install Cross-Store Apps**

```typescript
// Allow users to install apps from other stores
const installedApps = [
  ...myStoreApps,
  ...crossStoreApps.filter((app) => app.isBaseApp),
]
```

**3. Preserve Spatial Context**

```typescript
// Always pass store context
<StoreApp
  storeApp={currentStore.baseApp}
  onNavigate={handleSpatialNavigation}
/>
```

### For App Developers

**1. Respect Store Context**

```typescript
// Check if app belongs to current store
const isSameStore = app.store === currentStore

// Handle navigation accordingly
if (isSameStore) {
  switchApp(app)
} else {
  navigateToStore(app.store)
}
```

**2. Clean Up State**

```typescript
// Always clean up before navigation
setAppStatus(undefined)
clearLocalState()
addHapticFeedback()
```

**3. Support Power Users**

```typescript
// Handle meta/ctrl for advanced navigation
if (e.metaKey || e.ctrlKey) {
  openInNewContext(app)
  return
}
```

## Future Enhancements

### 1. Visual Spatial Memory

```
Show minimap of navigation path:
Vex → Blossom → Perplexity → [You are here]
```

### 2. Gesture Navigation

```
Swipe left: Back to previous store
Swipe right: Forward in history
Pinch: Zoom to store overview
```

### 3. Navigation Analytics

```
Track:
- Most used navigation paths
- Store switching patterns
- App discovery routes
```

### 4. Smart Suggestions

```
Based on navigation history:
"You often go from Blossom → Perplexity"
"Quick jump to Perplexity?"
```

## Conclusion

Focus's spatial navigation system represents a paradigm shift in how users interact with multi-dimensional app ecosystems. By combining:

- **Store-based architecture** (context carriers)
- **Dynamic button morphing** (self-documenting UI)
- **Cross-store teleportation** (infinite navigation)
- **Spatial memory** (zero cognitive load)

...we've created the first truly N-dimensional navigation system for productivity applications.

This architecture enables:

- ✅ Infinite store nesting
- ✅ Seamless cross-store navigation
- ✅ Perfect context preservation
- ✅ Zero navigation errors
- ✅ Intuitive spatial awareness

**The result: Users can navigate infinite complexity with zero cognitive overhead.**

---

_Document Version: 1.0_  
_Last Updated: November 11, 2025_  
_Author: Iliyan Velinov_  
_Patent Pending: Spatial Navigation System for Multi-Dimensional App Ecosystems_
