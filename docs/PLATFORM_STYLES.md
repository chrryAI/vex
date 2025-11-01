# Platform Styles - Auto-mapping className to React Native

## Overview

Your platform primitives now automatically convert `className` to React Native styles on native platforms!

## How It Works

1. **Style Registry**: All `.styles.ts` files are registered in `PlatformProvider`
2. **Auto-mapping**: When you use `className`, it automatically maps to the corresponding style object
3. **Utility Classes**: Common utility classes (flex, items-center, p-4) are also supported

## Usage

### 1. Import your styles

```tsx
import { AppStyles } from "./App.styles"
```

### 2. Register styles in PlatformProvider

```tsx
<PlatformProvider styleModules={{ AppStyles }}>{children}</PlatformProvider>
```

### 3. Use className as normal

```tsx
import { Div } from "chrry/platform"
import { AppStyles } from "./App.styles"
import clsx from "clsx"

function MyComponent() {
  return (
    <Div className={clsx(styles.app, "flex items-center")}>
      {/* Works on both web AND native! */}
    </Div>
  )
}
```

## What Gets Mapped

### CSS Module Classes

```tsx
// App.styles.ts
export const AppStyles = {
  app: {
    display: "flex",
    padding: 20,
    backgroundColor: "#fff"
  }
}

// Usage
<Div className="app"> // ← Automatically maps to AppStyles.app on native
```

### Utility Classes

Supported utilities:

- **Flexbox**: `flex`, `flex-row`, `flex-col`, `items-center`, `justify-between`, `flex-1`
- **Spacing**: `p-4`, `m-2`, `gap-3` (multiplied by 4)
- **Positioning**: `absolute`, `relative`
- **Text**: `text-center`, `font-bold`
- **Sizing**: `w-full`, `h-full`
- **Display**: `hidden`
- **Opacity**: `opacity-50`

## Example

```tsx
// App.tsx
import { Div, Text } from "chrry/platform"
import { AppStyles } from "./App.styles"

export function App() {
  return (
    <Div className="app flex-col items-center p-4">
      <Text className="title font-bold text-center">Hello World</Text>
    </Div>
  )
}

// On web: Uses className as-is
// On native: Converts to:
// {
//   ...AppStyles.app,
//   flexDirection: "column",
//   alignItems: "center",
//   padding: 16
// }
```

## Benefits

✅ **Write once, run everywhere** - Same code for web and native
✅ **No platform-specific files** - No `.native.tsx` or `.web.tsx` needed
✅ **Type-safe** - Full TypeScript support
✅ **Performant** - Results are cached
✅ **Flexible** - Mix CSS modules with utility classes

## Registering Multiple Style Modules

```tsx
import { AppStyles } from "./App.styles"
import { ChatStyles } from "./Chat.styles"
import { ButtonStyles } from "./Button.styles"
;<PlatformProvider
  styleModules={{
    AppStyles,
    ChatStyles,
    ButtonStyles,
  }}
>
  {children}
</PlatformProvider>
```

All classes from all modules will be available via `className`!
