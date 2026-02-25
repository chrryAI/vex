# ⏱️ Focus - Custom Domain Configuration

## Overview

Focus now has its own **separate site mode** with custom domain support, independent metadata, and dedicated app configuration.

---

## ✅ What Was Added

### **1. New siteMode: "focus"**

```typescript
export type siteMode = "chrryDev" | "vex" | "chrryAI" | "chrryStore" | "focus"
```

Focus is now a first-class site mode alongside Chrry, Vex, and others.

---

## 🌐 Domain Configuration

### **Supported Domains**

```typescript
// Primary subdomain
focus.chrry.ai → "focus" mode

// Custom domain (add yours here)
getfocus.ai → "focus" mode

// Any custom domain you configure
yourfocus.com → "focus" mode (add to detectsiteModeDomain)
```

### **Domain Detection Logic**

```typescript
export function detectsiteModeDomain(hostname?: string): siteMode {
  const host = hostname || window.location.hostname

  // Focus custom domain - checked BEFORE general chrry.ai
  if (host.includes("focus.chrry.ai") || host.includes("getfocus.ai")) {
    return "focus"
  }

  // Other chrry.ai subdomains
  if (host.includes("chrry.ai") && !host.includes("vex.chrry.ai")) {
    return "chrryAI"
  }

  // ... other domains
}
```

**Important**: Focus is checked **before** the general `chrry.ai` check to ensure it gets its own mode.

---

## 🎨 Focus Site Configuration

### **Metadata**

```typescript
{
  mode: "focus",
  slug: "focus",
  storeSlug: "blossom",
  name: "Focus",
  domain: "focus.chrry.ai",
  url: "https://focus.chrry.ai",
  email: "iliyan@chrry.ai",
  description: "AI-powered productivity assistant...",
  logo: "⏱️",
  primaryColor: "#3B82F6", // Blue
}
```

### **Links**

```typescript
links: {
  github: "https://github.com/chrryAI/chrry",
  docs: "https://focus.chrry.ai/docs",
}
```

### **Features**

```typescript
features: [
  {
    title: "Focus Timer",
    description: "Pomodoro and custom focus sessions",
    icon: "⏱️",
    link: "/timer",
  },
  {
    title: "Task Management",
    description: "Organize and track your tasks",
    icon: "✅",
    link: "/tasks",
  },
  {
    title: "AI Task Breakdown",
    description: "Break complex projects into steps",
    icon: "🤖",
    link: "/ai",
  },
  {
    title: "Time Tracking",
    description: "Track time across all your tasks",
    icon: "📊",
    link: "/analytics",
  },
  {
    title: "Progress Analytics",
    description: "Visualize your productivity patterns",
    icon: "📈",
    link: "/progress",
  },
  {
    title: "Goal Setting",
    description: "Set and achieve your goals",
    icon: "🎯",
    link: "/goals",
  },
  {
    title: "Productivity Insights",
    description: "AI-powered productivity tips",
    icon: "💡",
    link: "/insights",
  },
  {
    title: "Deep Work Mode",
    description: "Eliminate distractions and focus",
    icon: "🧠",
    link: "/deep-work",
  },
]
```

---

## 🌍 Translations (All Languages)

Focus has dedicated translations in **10 languages**:

```typescript
focus: {
  en: "Focus - AI Productivity Assistant",
  de: "Focus - KI-Produktivitätsassistent",
  fr: "Focus - Assistant de productivité IA",
  ja: "Focus - AI生産性アシスタント",
  ko: "Focus - AI 생산성 어시스턴트",
  pt: "Focus - Assistente de Produtividade IA",
  es: "Focus - Asistente de Productividad IA",
  zh: "Focus - AI 生产力助手",
  nl: "Focus - AI-productiviteitsassistent",
  tr: "Focus - Yapay Zekâ Üretkenlik Asistanı",
}
```

---

## 🔧 Usage

### **Automatic Detection**

```typescript
// Client-side - automatic
const config = getSiteConfig()
console.log(config.mode) // "focus" when on focus.chrry.ai

// Server-side - pass hostname
import { headers } from "next/headers"

const headersList = await headers()
const hostname = headersList.get("host") || ""
const config = getSiteConfig(hostname)
console.log(config.mode) // "focus"
```

### **Direct Mode**

```typescript
// Pass mode directly
const config = getSiteConfig("focus")
console.log(config.name) // "Focus"
console.log(config.logo) // "⏱️"
```

---

## 🎯 How It Works

### **Request Flow**

```
1. User visits focus.chrry.ai
   ↓
2. detectsiteModeDomain("focus.chrry.ai")
   ↓
3. Checks: host.includes("focus.chrry.ai") → true
   ↓
4. Returns: "focus"
   ↓
5. getSiteConfig("focus")
   ↓
6. Returns Focus-specific config
   ↓
7. App renders with Focus branding
```

### **Domain Priority**

```typescript
Priority Order:
1. chrry.dev → chrryDev
2. focus.chrry.ai / getfocus.ai → focus ⭐
3. *.chrry.ai (except vex) → chrryAI
4. vex.chrry.ai → vex
5. chrry.store → chrryStore
6. localhost → vex (default)
```

---

## 🚀 Adding Custom Domains

### **Step 1: Update Domain Detection**

```typescript
// packages/ui/utils/siteConfig.ts

if (
  host.includes("focus.chrry.ai") ||
  host.includes("getfocus.ai") ||
  host.includes("yourfocus.com") // Add your domain
) {
  return "focus"
}
```

### **Step 2: Configure DNS**

```
yourfocus.com → Server IP (A record)
www.yourfocus.com → yourfocus.com (CNAME)
```

### **Step 3: SSL Certificate**

```bash
# Add domain to SSL cert
certbot certonly --webroot -w /var/www/html \
  -d yourfocus.com \
  -d www.yourfocus.com
```

### **Step 4: Test**

```bash
curl https://yourfocus.com
# Should return Focus app with Focus branding
```

---

## 📊 Comparison: Focus vs Chrry AI

### **Focus Mode** (focus.chrry.ai)

```typescript
{
  mode: "focus",
  name: "Focus",
  logo: "⏱️",
  primaryColor: "#3B82F6", // Blue
  storeSlug: "blossom",
  features: [
    "Focus Timer",
    "Task Management",
    "AI Task Breakdown",
    "Time Tracking",
    "Progress Analytics",
    "Goal Setting",
    "Productivity Insights",
    "Deep Work Mode",
  ]
}
```

### **Chrry AI Mode** (chrry.ai)

```typescript
{
  mode: "chrryAI",
  name: "Chrry",
  logo: "🍒",
  primaryColor: "#E91E63", // Pink
  storeSlug: "chrry",
  features: [
    "App Marketplace",
    "Create Stores",
    "Publish Apps",
    "Revenue Sharing",
    "Custom Domains",
    "Analytics",
    "Multi-Agent Support",
    "Developer Tools",
  ]
}
```

**Key Difference**: Focus is a **dedicated productivity app**, while Chrry AI is the **marketplace platform**.

---

## 🎨 Branding Differences

### **Focus**

- **Color**: Blue (#3B82F6) - Calm, focused
- **Icon**: ⏱️ - Timer/productivity
- **Vibe**: Minimalist, distraction-free
- **Target**: Individual productivity users

### **Chrry AI**

- **Color**: Pink (#E91E63) - Vibrant, creative
- **Icon**: 🍒 - Playful, memorable
- **Vibe**: Marketplace, discovery
- **Target**: App creators and consumers

---

## 🔐 SEO & Metadata

### **Focus-Specific Meta Tags**

```html
<!-- When on focus.chrry.ai -->
<title>Focus - AI Productivity Assistant</title>
<meta
  name="description"
  content="Master your time and achieve your goals with AI-powered focus sessions, task management, and productivity insights."
/>
<meta property="og:title" content="Focus - AI Productivity Assistant" />
<meta
  property="og:description"
  content="AI-powered productivity assistant..."
/>
<meta property="og:url" content="https://focus.chrry.ai" />
<link rel="canonical" href="https://focus.chrry.ai" />
```

### **Chrry AI Meta Tags**

```html
<!-- When on chrry.ai -->
<title>Chrry - AI App Marketplace</title>
<meta name="description" content="Discover, create, and monetize AI apps..." />
<meta property="og:url" content="https://chrry.ai" />
```

---

## 🧪 Testing

### **Test Domain Detection**

```typescript
// Test Focus subdomain
detectsiteModeDomain("focus.chrry.ai") // → "focus" ✅

// Test custom domain
detectsiteModeDomain("getfocus.ai") // → "focus" ✅

// Test other chrry.ai subdomains
detectsiteModeDomain("bloom.chrry.ai") // → "chrryAI" ✅
detectsiteModeDomain("chrry.ai") // → "chrryAI" ✅

// Test vex
detectsiteModeDomain("vex.chrry.ai") // → "vex" ✅
```

### **Test Site Config**

```typescript
const config = getSiteConfig("focus")

console.log(config.mode) // "focus"
console.log(config.name) // "Focus"
console.log(config.logo) // "⏱️"
console.log(config.primaryColor) // "#3B82F6"
console.log(config.features.length) // 8
```

---

## 📝 Environment Variable Fallback

If domain detection fails, you can still use env vars:

```bash
# .env
VITE_SITE_MODE=focus
```

```typescript
// Will return "focus" mode
detectsiteMode() // → "focus"
```

---

## 🚢 Deployment Checklist

### **Before Launch**

- [x] Add "focus" siteMode type
- [x] Add Focus translations (10 languages)
- [x] Add Focus domain detection
- [x] Add Focus site configuration
- [x] Update validModes array
- [x] Add env var fallback

### **DNS Configuration**

- [ ] Point focus.chrry.ai to server
- [ ] Point custom domain (if any) to server
- [ ] Configure SSL certificates
- [ ] Test HTTPS on all domains

### **Testing**

- [ ] Test focus.chrry.ai loads correctly
- [ ] Test custom domain (if configured)
- [ ] Test Focus branding appears
- [ ] Test Focus features list
- [ ] Test translations in all languages
- [ ] Test SSR with hostname detection

### **Monitoring**

- [ ] Set up analytics for focus.chrry.ai
- [ ] Monitor traffic and conversions
- [ ] Track user engagement
- [ ] Monitor performance metrics

---

## 🎉 Summary

### **What We Built**

✅ **Separate Site Mode** - Focus is independent from Chrry AI
✅ **Custom Domain Support** - focus.chrry.ai + custom domains
✅ **Dedicated Metadata** - SEO, OG tags, descriptions
✅ **Unique Branding** - Blue theme, timer icon, productivity focus
✅ **8 Feature Highlights** - Timer, tasks, AI, tracking, analytics, goals, insights, deep work
✅ **10 Language Translations** - Full i18n support
✅ **Domain Detection** - Automatic routing based on hostname
✅ **SSR Compatible** - Works with Next.js server-side rendering

### **How to Use**

```typescript
// Automatic detection
const config = getSiteConfig()

// With hostname (SSR)
const config = getSiteConfig(hostname)

// Direct mode
const config = getSiteConfig("focus")
```

### **Domains**

```
focus.chrry.ai → Focus app ✅
getfocus.ai → Focus app ✅ (add custom domain)
yourfocus.com → Focus app ✅ (add to detection)
```

**Focus is now a standalone productivity platform with its own identity!** ⏱️✨
