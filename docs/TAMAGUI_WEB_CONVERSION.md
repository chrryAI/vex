# 🎨 Converting Web Components to Tamagui

## ✅ Setup Complete!

Your web app now has:

- ✅ **TamaguiProvider** wrapping everything
- ✅ **PlatformProvider** for runtime detection
- ✅ **Shared config** between web and native
- ✅ **46 SCSS files** converted to Tamagui styles

---

## 🚀 How to Convert Components

### **Example: Converting a Simple Component**

#### **Before (SCSS + HTML):**

```tsx
import styles from "./MyComponent.module.scss"

export function MyComponent() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Hello World</h1>
      <p className={styles.text}>Some text</p>
    </div>
  )
}
```

#### **After (Tamagui):**

```tsx
import { Box, H1, Text } from "chrry/platform"
import { MyComponentStyles } from "./MyComponent.styles"

export function MyComponent() {
  return (
    <Box style={MyComponentStyles.container}>
      <H1 style={MyComponentStyles.title}>Hello World</H1>
      <Text style={MyComponentStyles.text}>Some text</Text>
    </Box>
  )
}
```

---

## 📦 Available Components (Built on Tamagui!)

All components are now **Tamagui-powered** with full theming, styling tokens, and animation support!

### **Layout Components:**

```tsx
import { Box, Div, Section } from 'chrry/platform'

<Box>...</Box>           // Tamagui Stack - supports all Tamagui props!
<Div>...</Div>           // Renders as <div> on web
<Section>...</Section>   // Semantic <section> on web
```

### **Text Components:**

```tsx
import { Text, H1, H2, H3, P, Span } from 'chrry/platform'

<Text>...</Text>         // Tamagui Text - full theming support!
<H1>...</H1>            // Semantic heading with Tamagui styling
<H2>...</H2>            // Heading 2
<P>...</P>              // Paragraph
<Span>...</Span>        // Inline text
```

### **Interactive Components:**

```tsx
import { Button, Link, Input } from 'chrry/platform'

<Button onPress={() => {}}>Click me</Button>  // Tamagui Button!
<Link href="/about">About</Link>
<Input placeholder="Type here..." />          // Tamagui Input!
```

### **Other Components:**

```tsx
import { ScrollView, Image } from 'chrry/platform'

<ScrollView>...</ScrollView>  // Tamagui ScrollView
<Image source={{ uri: 'https://...' }} />  // Tamagui Image
```

### **🎨 Tamagui Styling Props:**

All components now support Tamagui's powerful styling:

```tsx
<Box
  padding="$4" // Use design tokens
  backgroundColor="$background"
  borderRadius="$2"
  hoverStyle={{ backgroundColor: "$backgroundHover" }}
  pressStyle={{ scale: 0.98 }}
  animation="quick"
>
  <Text color="$color" fontSize="$5">
    Themed text!
  </Text>
</Box>
```

---

## 🎯 Using Converted Styles

Your SCSS files have been converted to TypeScript style objects:

```tsx
// Import the converted styles
import { AppStyles } from './App.styles'

// Use them directly
<Box style={AppStyles.container}>
  <Text style={AppStyles.title}>Title</Text>
</Box>

// Combine multiple styles
<Box style={[AppStyles.container, AppStyles.highlighted]}>
  ...
</Box>

// Override with inline styles
<Box style={[AppStyles.container, { padding: 20 }]}>
  ...
</Box>
```

---

## 🔧 Platform-Specific Styling

Use the platform hooks for conditional styling:

```tsx
import { usePlatform, useAdaptiveStyles } from "chrry/platform"

function MyComponent() {
  const { isWeb, isNative, select } = usePlatform()

  // Conditional rendering
  if (isWeb) {
    return <div>Web only</div>
  }

  // Platform-specific values
  const fontSize = select({
    web: 16,
    ios: 14,
    android: 14,
    default: 14,
  })

  // Adaptive styles with overrides
  const styles = useAdaptiveStyles(MyStyles, {
    container: {
      web: { cursor: "pointer" },
      native: { elevation: 2 },
    },
  })

  return <Box style={styles.container}>...</Box>
}
```

---

## 📝 Migration Checklist

For each component:

1. ✅ **Import platform components** instead of HTML elements
2. ✅ **Import converted styles** (`.styles.ts` files)
3. ✅ **Replace `className`** with `style` prop
4. ✅ **Replace `onClick`** with `onPress`
5. ✅ **Replace `onChange`** with `onChangeText` (for inputs)
6. ✅ **Test on web** - should work immediately!

---

## 🎨 Style Conversion Notes

Some CSS properties were converted automatically:

- ✅ **Colors:** `#fff` → `'#fff'`
- ✅ **Numbers:** `10px` → `10`
- ✅ **Percentages:** `50%` → `'50%'`
- ✅ **Flex:** `display: flex` → `display: 'flex'`
- ✅ **Camel case:** `font-size` → `fontSize`
- ✅ **Hyphens:** `rbc-off-range` → `rbcOffRange`

Some properties need manual adjustment:

- ⚠️ **box-shadow** → `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`
- ⚠️ **transform** → `translateX`, `translateY`, `scale`, `rotate`
- ⚠️ **transitions** → animations
- ⚠️ **Media queries** → removed (use platform hooks instead)

---

## 🚀 Quick Start Example

Let's convert the `Weather` component as an example:

```tsx
import { Box, Text, usePlatform } from "chrry/platform"
import { WeatherStyles } from "./Weather.styles"

export function Weather({
  location = "San Francisco",
  temperature = 72,
  condition = "Sunny",
}) {
  const { isWeb } = usePlatform()

  return (
    <Box style={WeatherStyles.weather}>
      <Text style={WeatherStyles.location}>{location}</Text>
      <Box style={WeatherStyles.info}>
        <Text>
          {temperature}°F • {condition}
        </Text>
      </Box>
      {isWeb && <Text>🌐 Running on Web</Text>}
    </Box>
  )
}
```

---

## 🎉 Benefits

**ONE Component File:**

- ✅ Works on Web (Next.js)
- ✅ Works on Native (React Native)
- ✅ Works in Extension
- ✅ No `.web.tsx` or `.native.tsx` files needed!

**Better DX:**

- ✅ TypeScript autocomplete
- ✅ Type-safe styles
- ✅ Runtime platform detection
- ✅ Shared code across platforms

---

## 📚 Next Steps

1. **Start with simple components** (e.g., `Button`, `Card`)
2. **Test on web** after each conversion
3. **Use platform hooks** for conditional logic
4. **Gradually migrate** the entire app
5. **Test on native** when ready!

---

**YOU'RE READY TO START CONVERTING! 🚀**

Start with a small component and work your way up!
