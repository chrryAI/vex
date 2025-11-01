# 🎨 Tamagui-Powered Platform Primitives

## ✅ What Changed

Your platform primitives are now **built on Tamagui** instead of raw React Native components!

### **Before:**

```tsx
// Raw React Native components
<View style={styles.container}>
  <Text style={styles.text}>Hello</Text>
</View>
```

### **After:**

```tsx
// Tamagui-powered components with theming!
<Box padding="$4" backgroundColor="$background">
  <Text color="$color" fontSize="$5">
    Hello
  </Text>
</Box>
```

---

## 🚀 Benefits

### **1. Automatic Theming**

All components automatically respond to your theme:

```tsx
<Box backgroundColor="$background">
  {" "}
  {/* Light: #fff, Dark: #111827 */}
  <Text color="$color">Text</Text> {/* Light: #111827, Dark: #f9fafb */}
</Box>
```

### **2. Design Tokens**

Use consistent spacing, colors, and sizes:

```tsx
<Box
  padding="$4" // Consistent spacing
  margin="$2"
  borderRadius="$3"
  backgroundColor="$blue"
>
  <Text fontSize="$5" fontWeight="$6">
    Consistent typography
  </Text>
</Box>
```

### **3. Interactive States**

Built-in hover, press, and focus states:

```tsx
<Box
  backgroundColor="$background"
  hoverStyle={{ backgroundColor: "$backgroundHover" }}
  pressStyle={{ scale: 0.98 }}
  focusStyle={{ borderColor: "$blue" }}
>
  Interactive!
</Box>
```

### **4. Animations**

Easy animations out of the box:

```tsx
<Box
  animation="quick"
  enterStyle={{ opacity: 0, scale: 0.9 }}
  exitStyle={{ opacity: 0, scale: 0.9 }}
>
  Animated entrance!
</Box>
```

### **5. Responsive Design**

Media queries built-in:

```tsx
<Box
  width="100%"
  $sm={{ width: "50%" }}
  $md={{ width: "33%" }}
  $lg={{ width: "25%" }}
>
  Responsive!
</Box>
```

---

## 📦 Component Reference

### **Box** (Tamagui Stack)

```tsx
import { Box } from "chrry/platform"
;<Box
  as="div" // Semantic HTML tag
  padding="$4" // Tamagui token
  backgroundColor="$background"
  borderRadius="$2"
  hoverStyle={{ backgroundColor: "$backgroundHover" }}
>
  Content
</Box>
```

**Props:**

- All `StackProps` from Tamagui
- `as` - HTML tag (div, section, article, etc.)
- `className` - CSS class name
- `onClick` - Click handler
- `onHover` - Hover handler
- All Tamagui styling props (padding, margin, colors, etc.)

---

### **Text** (Tamagui Text)

```tsx
import { Text } from "chrry/platform"
;<Text
  as="span" // Semantic HTML tag
  color="$color"
  fontSize="$5"
  fontWeight="$6"
  hoverStyle={{ color: "$colorHover" }}
>
  Text content
</Text>
```

**Props:**

- All `TextProps` from Tamagui
- `as` - HTML tag (span, p, h1, h2, etc.)
- `className` - CSS class name
- `onClick` - Click handler
- All Tamagui text styling props

---

### **Button** (Tamagui Button)

```tsx
import { Button } from "chrry/platform"
;<Button
  type="button"
  onPress={() => console.log("Clicked!")}
  backgroundColor="$blue"
  color="white"
  padding="$3"
  borderRadius="$2"
  hoverStyle={{ backgroundColor: "$purple" }}
  pressStyle={{ scale: 0.95 }}
>
  Click me
</Button>
```

**Props:**

- All `ButtonProps` from Tamagui
- `type` - button, submit, reset
- `onPress` - Click handler
- All Tamagui styling props

---

### **Input** (Tamagui Input)

```tsx
import { Input } from "chrry/platform"
;<Input
  type="text"
  placeholder="Enter text..."
  value={value}
  onChangeText={setValue}
  backgroundColor="$background"
  borderColor="$borderColor"
  padding="$3"
  borderRadius="$2"
  focusStyle={{ borderColor: "$blue" }}
/>
```

**Props:**

- All `InputProps` from Tamagui
- `type` - text, email, password, number, tel, url, search
- `name` - Form field name
- `required` - Required field
- All Tamagui styling props

---

### **ScrollView** (Tamagui ScrollView)

```tsx
import { ScrollView } from "chrry/platform"
;<ScrollView backgroundColor="$background" padding="$4">
  <Box>Scrollable content</Box>
</ScrollView>
```

**Props:**

- All `ScrollViewProps` from Tamagui
- All Tamagui styling props

---

### **Image** (Tamagui Image)

```tsx
import { Image } from "chrry/platform"
;<Image
  source={{ uri: "https://..." }}
  alt="Description"
  width={200}
  height={200}
  borderRadius="$3"
/>
```

**Props:**

- All `ImageProps` from Tamagui
- `alt` - Accessibility label
- `loading` - lazy, eager
- All Tamagui styling props

---

## 🎯 Migration Examples

### **Example 1: Simple Container**

```tsx
// Before
<View style={{ padding: 16, backgroundColor: '#fff' }}>
  <Text style={{ fontSize: 18, color: '#111' }}>Hello</Text>
</View>

// After
<Box padding="$4" backgroundColor="$background">
  <Text fontSize="$5" color="$color">Hello</Text>
</Box>
```

### **Example 2: Interactive Button**

```tsx
// Before
<Pressable
  onPress={handlePress}
  style={({ pressed }) => ({
    backgroundColor: pressed ? '#ddd' : '#fff',
    padding: 12,
  })}
>
  <Text>Click me</Text>
</Pressable>

// After
<Button
  onPress={handlePress}
  backgroundColor="$background"
  padding="$3"
  pressStyle={{ backgroundColor: '$backgroundHover' }}
>
  Click me
</Button>
```

### **Example 3: Themed Card**

```tsx
// Before
<View style={{
  backgroundColor: '#fff',
  padding: 16,
  borderRadius: 8,
  shadowColor: '#000',
  shadowOpacity: 0.1,
}}>
  <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Title</Text>
  <Text style={{ fontSize: 14, color: '#666' }}>Description</Text>
</View>

// After
<Box
  backgroundColor="$background"
  padding="$4"
  borderRadius="$3"
  shadowColor="$color"
  shadowOpacity={0.1}
  shadowRadius="$2"
>
  <Text fontSize="$6" fontWeight="$7">Title</Text>
  <Text fontSize="$3" color="$placeholderColor">Description</Text>
</Box>
```

---

## 🎨 Available Design Tokens

### **Colors:**

- `$background` - Background color (light/dark aware)
- `$backgroundHover` - Hover background
- `$color` - Text color (light/dark aware)
- `$colorHover` - Hover text color
- `$borderColor` - Border color
- `$placeholderColor` - Placeholder text
- `$red`, `$orange`, `$yellow`, `$green`, `$blue`, `$purple`, `$pink`, `$violet`

### **Spacing:**

- `$1` through `$20` - Consistent spacing scale

### **Font Sizes:**

- `$1` through `$10` - Typography scale

### **Border Radius:**

- `$1` through `$10` - Rounded corners

---

## 🔥 Advanced Features

### **Variants:**

Create reusable style variants:

```tsx
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
```

### **Animations:**

```tsx
<Box
  animation="bouncy"
  enterStyle={{ opacity: 0, y: -20 }}
  exitStyle={{ opacity: 0, y: 20 }}
>
  Animated!
</Box>
```

### **Media Queries:**

```tsx
<Box
  padding="$2"
  $sm={{ padding: "$4" }}
  $md={{ padding: "$6" }}
  $lg={{ padding: "$8" }}
>
  Responsive padding
</Box>
```

### **Pseudo States:**

```tsx
<Box
  backgroundColor="$background"
  hoverStyle={{ backgroundColor: "$backgroundHover" }}
  pressStyle={{ scale: 0.98 }}
  focusStyle={{ borderColor: "$blue" }}
  disabledStyle={{ opacity: 0.5 }}
>
  All states covered!
</Box>
```

---

## 🎉 Summary

**Your primitives are now:**

- ✅ **Tamagui-powered** - Full theming and design tokens
- ✅ **Type-safe** - TypeScript autocomplete for all props
- ✅ **Themeable** - Automatic light/dark mode
- ✅ **Interactive** - Built-in hover, press, focus states
- ✅ **Animated** - Easy animations
- ✅ **Responsive** - Media queries built-in
- ✅ **Cross-platform** - Works on web and native

**Start using Tamagui styling props everywhere!** 🚀
