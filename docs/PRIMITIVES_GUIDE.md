# 🎨 HTML-like Primitives Guide

## Overview

We've created **HTML-like primitives** that work cross-platform (Web + Native). They match HTML semantics but are powered by Tamagui.

## Quick Migration

### Before (HTML + SCSS):

```tsx
import styles from "./Weather.module.scss"

export function Weather() {
  return (
    <div className={styles.weather}>
      <span className={styles.location}>
        <h3>San Francisco</h3>
      </span>
      <div className={styles.info}>
        <span>72°F</span>
        <span>Sunny</span>
      </div>
    </div>
  )
}
```

### After (Primitives + Tamagui):

```tsx
import { Div, Span, H3 } from "chrry/primitives"
import { WeatherStyles } from "./Weather.styles"

export function Weather() {
  return (
    <Div {...WeatherStyles.weather}>
      <Span {...WeatherStyles.location}>
        <H3>San Francisco</H3>
      </Span>
      <Div {...WeatherStyles.info}>
        <Span>72°F</Span>
        <Span>Sunny</Span>
      </Div>
    </Div>
  )
}
```

**Works on Web, ios, and Android! 🚀**

---

## Available Primitives

### Layout Components

| HTML        | Primitive   | Description                   |
| ----------- | ----------- | ----------------------------- |
| `<div>`     | `<Div>`     | Block container (flex column) |
| `<span>`    | `<Span>`    | Inline container (flex row)   |
| `<section>` | `<Section>` | Semantic section              |
| `<article>` | `<Article>` | Semantic article              |
| `<header>`  | `<Header>`  | Page/section header           |
| `<footer>`  | `<Footer>`  | Page/section footer           |
| `<nav>`     | `<Nav>`     | Navigation container          |
| `<main>`    | `<Main>`    | Main content area             |
| `<aside>`   | `<Aside>`   | Sidebar content               |

### Text Components

| HTML       | Primitive  | Description     |
| ---------- | ---------- | --------------- |
| `<h1>`     | `<H1>`     | Heading level 1 |
| `<h2>`     | `<H2>`     | Heading level 2 |
| `<h3>`     | `<H3>`     | Heading level 3 |
| `<h4>`     | `<H4>`     | Heading level 4 |
| `<h5>`     | `<H5>`     | Heading level 5 |
| `<h6>`     | `<H6>`     | Heading level 6 |
| `<p>`      | `<P>`      | Paragraph       |
| `<strong>` | `<Strong>` | Bold text       |
| `<em>`     | `<Em>`     | Italic text     |
| `<small>`  | `<Small>`  | Small text      |
| `<code>`   | `<Code>`   | Inline code     |
| `<pre>`    | `<Pre>`    | Code block      |
| `<label>`  | `<Label>`  | Form label      |

### List Components

| HTML   | Primitive | Description    |
| ------ | --------- | -------------- |
| `<ul>` | `<Ul>`    | Unordered list |
| `<ol>` | `<Ol>`    | Ordered list   |
| `<li>` | `<Li>`    | List item      |

### Interactive Components

| HTML       | Primitive  | Description |
| ---------- | ---------- | ----------- |
| `<a>`      | `<A>`      | Link/anchor |
| `<button>` | `<Button>` | Button      |

### Utility Components

| HTML   | Primitive | Description         |
| ------ | --------- | ------------------- |
| `<hr>` | `<Hr>`    | Horizontal rule     |
| `<br>` | `<Br>`    | Line break (spacer) |

---

## Usage Examples

### Basic Layout

```tsx
import { Div, H1, P } from "chrry/primitives"
;<Div padding="$4">
  <H1>Welcome to Vex</H1>
  <P>Your AI assistant</P>
</Div>
```

### With Converted Styles

```tsx
import { Div, Span, H3 } from "chrry/primitives"
import { WeatherStyles } from "./Weather.styles"
;<Div {...WeatherStyles.weather}>
  <Span {...WeatherStyles.location}>
    <H3>Location</H3>
  </Span>
</Div>
```

### Semantic HTML

```tsx
import { Header, Nav, Main, Footer, A } from "chrry/primitives"
;<Div>
  <Header>
    <Nav gap="$4">
      <A href="/">Home</A>
      <A href="/about">About</A>
    </Nav>
  </Header>

  <Main>{/* Content */}</Main>

  <Footer>
    <P>© 2025 Vex</P>
  </Footer>
</Div>
```

### Lists

```tsx
import { Ul, Li, Strong } from "chrry/primitives"
;<Ul>
  <Li>
    <Strong>Feature 1:</Strong> Description
  </Li>
  <Li>
    <Strong>Feature 2:</Strong> Description
  </Li>
  <Li>
    <Strong>Feature 3:</Strong> Description
  </Li>
</Ul>
```

### Code Blocks

```tsx
import { Code, Pre } from 'chrry/primitives'

<P>
  Use <Code>npm install</Code> to install packages.
</P>

<Pre>
  npm install tamagui{'\n'}
  npm run dev
</Pre>
```

### Interactive Elements

```tsx
import { Button, A } from 'chrry/primitives'

<Button onPress={() => alert('Clicked!')}>
  Click me
</Button>

<A href="https://vex.chrry.ai" target="_blank">
  Visit Vex
</A>
```

---

## Styling Primitives

### Using Tamagui Props

```tsx
<Div
  backgroundColor="$background"
  padding="$4"
  borderRadius="$3"
  borderColor="$borderColor"
  borderWidth={1}
>
  <H1 color="$blue">Styled Heading</H1>
</Div>
```

### Using Converted Styles

```tsx
import { ThreadStyles } from "./Thread.styles"
;<Div {...ThreadStyles.container}>
  <H1 {...ThreadStyles.title}>Thread</H1>
</Div>
```

### Combining Styles

```tsx
<Div
  {...ThreadStyles.container}
  padding="$4"  // Override
  backgroundColor={isActive ? '$blue' : '$background'}
>
```

### Responsive Styles

```tsx
<Div width="100%" $gtSm={{ width: 600 }} $gtMd={{ width: 900 }}>
  <H1 fontSize="$7" $gtSm={{ fontSize: "$9" }}>
    Responsive Heading
  </H1>
</Div>
```

### Hover & Press States

```tsx
<Div
  backgroundColor="$background"
  hoverStyle={{ backgroundColor: "$backgroundHover" }}
  pressStyle={{ scale: 0.98 }}
  cursor="pointer"
>
  <P>Interactive Card</P>
</Div>
```

---

## Migration Strategy

### Step 1: Import Primitives

```tsx
import { Div, Span, H1, H2, P } from "chrry/primitives"
```

### Step 2: Replace HTML Tags

```tsx
// Before
<div className={styles.container}>
  <h1 className={styles.title}>Title</h1>
  <p className={styles.text}>Text</p>
</div>

// After
<Div className={styles.container}>
  <H1 className={styles.title}>Title</H1>
  <P className={styles.text}>Text</P>
</Div>
```

### Step 3: Replace className with Spread

```tsx
// Before
<Div className={styles.container}>

// After
<Div {...styles.container}>
```

### Step 4: Use Tamagui Tokens

```tsx
// Before
<Div {...styles.container}>

// After
<Div
  {...styles.container}
  backgroundColor="$background"
  padding="$4"
>
```

---

## Platform-Specific Behavior

### Web

- Renders as actual HTML elements (`<div>`, `<h1>`, etc.)
- SEO-friendly
- Accessible
- Works with CSS

### Native (ios/Android)

- Renders as React Native components
- Native performance
- Platform-specific styling
- Gesture support

---

## Best Practices

### ✅ Do:

```tsx
// Use semantic elements
<Header>
  <Nav>
    <A href="/">Home</A>
  </Nav>
</Header>

// Combine with Tamagui styles
<Div {...styles.container} padding="$4">

// Use theme tokens
<H1 color="$color">Title</H1>
```

### ❌ Don't:

```tsx
// Don't use className (use spread instead)
<Div className="container">  // ❌

// Don't hardcode colors (use tokens)
<Div backgroundColor="#ffffff">  // ❌
<Div backgroundColor="$background">  // ✅

// Don't mix HTML and primitives
<div>  // ❌
  <H1>Title</H1>
</div>

<Div>  // ✅
  <H1>Title</H1>
</Div>
```

---

## TypeScript Support

All primitives are fully typed:

```tsx
import { DivProps, H1Props } from "chrry/primitives"

const MyComponent = (props: DivProps) => {
  return <Div {...props} />
}

const MyHeading = (props: H1Props) => {
  return <H1 {...props} />
}
```

---

## Next Steps

1. **Start using primitives in new components**
2. **Gradually migrate existing components**
3. **Remove HTML elements from codebase**
4. **Enjoy cross-platform components!** 🚀

---

**Now your HTML works everywhere! Web, ios, Android - same code! 🎉**
