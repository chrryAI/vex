# 🎨 Tamagui Migration Guide

## Overview

We've set up Tamagui for cross-platform styling (Web + Native) and created a tool to convert SCSS to Tamagui styles.

## Quick Start

### Convert SCSS to Tamagui

```bash
# Convert single file
npm run scss2tama packages/ui/Thread.module.scss

# Convert all SCSS files
npm run scss2tama:all
```

## Using Tamagui Styles

### Before (Web-only SCSS):

```tsx
import styles from "./Thread.module.scss"

export function Thread() {
  return (
    <div className={styles.thread}>
      <div className={styles.header}>
        <h1>Thread</h1>
      </div>
    </div>
  )
}
```

### After (Cross-platform Tamagui):

```tsx
import { YStack, XStack, H1 } from "tamagui"
import { ThreadStyles } from "./Thread.styles"

export function Thread() {
  return (
    <YStack {...ThreadStyles.thread}>
      <XStack {...ThreadStyles.header}>
        <H1>Thread</H1>
      </XStack>
    </YStack>
  )
}
```

## Tamagui Components

### Layout Components

```tsx
// Vertical stack (flex-direction: column)
<YStack gap="$4" padding="$3">
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</YStack>

// Horizontal stack (flex-direction: row)
<XStack gap="$2" alignItems="center">
  <Text>Left</Text>
  <Text>Right</Text>
</XStack>

// Scrollable
<ScrollView>
  <YStack>
    {/* Content */}
  </YStack>
</ScrollView>
```

### Text Components

```tsx
<H1>Heading 1</H1>
<H2>Heading 2</H2>
<Text>Body text</Text>
<Paragraph>Paragraph</Paragraph>
```

### Interactive Components

```tsx
<Button
  backgroundColor="$blue"
  color="white"
  pressStyle={{ opacity: 0.8 }}
  onPress={() => {}}
>
  Click me
</Button>

<Input
  placeholder="Type here..."
  backgroundColor="$background"
  borderColor="$borderColor"
/>
```

## Theme Tokens

### Colors

```tsx
<Text color="$color">Default text</Text>
<Text color="$placeholderColor">Muted text</Text>
<YStack backgroundColor="$background">Content</YStack>

// Brand colors
<Text color="$red">Error</Text>
<Text color="$orange">Peach</Text>
<Text color="$yellow">Warning</Text>
<Text color="$green">Success</Text>
<Text color="$blue">Atlas</Text>
<Text color="$purple">Bloom</Text>
<Text color="$violet">Vault</Text>
```

### Spacing

```tsx
<YStack
  padding="$2"      // 8px
  margin="$4"       // 16px
  gap="$3"          // 12px
>
```

### Sizes

```tsx
<Text fontSize="$3">Small</Text>
<Text fontSize="$5">Medium</Text>
<Text fontSize="$7">Large</Text>
```

## Responsive Design

```tsx
<YStack
  width="100%"
  $gtSm={{ width: 600 }} // > 600px
  $gtMd={{ width: 900 }} // > 900px
  $gtLg={{ width: 1200 }} // > 1200px
>
  <Text>Responsive!</Text>
</YStack>
```

## Animations

```tsx
<YStack
  animation="quick"
  pressStyle={{ scale: 0.95 }}
  hoverStyle={{ backgroundColor: "$backgroundHover" }}
  enterStyle={{ opacity: 0, y: -10 }}
  exitStyle={{ opacity: 0, y: 10 }}
>
  <Text>Animated!</Text>
</YStack>
```

## Platform-Specific Code

```tsx
import { Platform } from 'react-native'

<YStack
  {...(Platform.OS === 'web' && {
    cursor: 'pointer',
  })}
  {...(Platform.OS === 'ios' && {
    shadowColor: '$shadow',
  })}
>
```

## Migration Strategy

### Phase 1: Core Components (Now)

1. ✅ Set up Tamagui in native app
2. ✅ Convert all SCSS to `.styles.ts` files
3. 🔄 Create `.native.tsx` versions of key components
4. 🔄 Test on ios/Android

### Phase 2: Shared Components (Next)

1. Migrate `Thread.tsx` to use Tamagui
2. Migrate `Message.tsx` to use Tamagui
3. Migrate `Chat.tsx` to use Tamagui
4. Share components between web and native

### Phase 3: Full Migration (Later)

1. Replace all SCSS with Tamagui
2. Remove `.module.scss` files
3. Optimize bundle size
4. Add animations

## Common Patterns

### Conditional Styling

```tsx
<YStack
  backgroundColor={isActive ? '$blue' : '$background'}
  borderColor={hasError ? '$red' : '$borderColor'}
>
```

### Combining Styles

```tsx
<YStack
  {...ThreadStyles.container}
  {...(isCompact && ThreadStyles.compact)}
  padding="$4"  // Override
>
```

### Custom Variants

```tsx
<Button variant="outlined" size="large" theme="orange">
  Custom Button
</Button>
```

## Troubleshooting

### Issue: Styles not applying

**Solution:** Make sure you wrap your app in `TamaguiProvider`:

```tsx
<TamaguiProvider config={config}>
  <App />
</TamaguiProvider>
```

### Issue: Metro bundler errors

**Solution:** Clear cache and restart:

```bash
npm run dev -- --clear
```

### Issue: TypeScript errors

**Solution:** Restart TypeScript server in your IDE

## Resources

- [Tamagui Docs](https://tamagui.dev)
- [Tamagui Components](https://tamagui.dev/docs/components/stacks)
- [Tamagui Themes](https://tamagui.dev/docs/core/theme)
- [Tamagui Animations](https://tamagui.dev/docs/core/animations)

## Next Steps

1. **Test the native app:**

   ```bash
   npm run native
   # Press 'i' for ios or 'a' for Android
   ```

2. **Create your first cross-platform component:**

   ```tsx
   // packages/ui/Button.tsx
   import { Button as TamaguiButton } from "tamagui"

   export function Button({ children, ...props }) {
     return (
       <TamaguiButton backgroundColor="$blue" color="white" {...props}>
         {children}
       </TamaguiButton>
     )
   }
   ```

3. **Use it everywhere:**

   ```tsx
   // Works on web, ios, and Android!
   import { Button } from "chrry/Button"
   ;<Button onPress={() => alert("Hello!")}>Click me</Button>
   ```

---

**You're now ready to build cross-platform components! 🚀**
