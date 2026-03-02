import "dotenv/config"
import fs from "node:fs/promises"
import arcjet, { fixedWindow, shield } from "@arcjet/node"
import cookieParser from "cookie-parser"
import express from "express"

/// <reference types="chrome" />
export const getEnv = () => {
  let processEnv = {}
  if (typeof process !== "undefined" && "env" in process) {
    processEnv = process.env
  }
  let importMetaEnv = {}
  if (typeof import.meta !== "undefined") {
    importMetaEnv = import.meta.env || {}
  }
  return Object.assign(Object.assign({}, processEnv), importMetaEnv)
}
export const isCI = getEnv().VITE_CI === "true" || getEnv().CI === "true"
export const checkIsExtension = () => {
  var _a, _b
  if (
    typeof chrome !== "undefined" &&
    ((_a = chrome.runtime) === null || _a === void 0 ? void 0 : _a.id)
  ) {
    return true
  }
  if (
    typeof browser !== "undefined" &&
    ((_b = browser.runtime) === null || _b === void 0 ? void 0 : _b.id)
  ) {
    return true
  }
  return false
}
export const getExtensionUrl = () => {
  var _a, _b
  if (typeof window === "undefined") return
  if (
    typeof chrome !== "undefined" &&
    ((_a = chrome.runtime) === null || _a === void 0 ? void 0 : _a.getURL)
  ) {
    return chrome.runtime.getURL("index.html") // Chrome
  }
  if (
    typeof browser !== "undefined" &&
    ((_b = browser.runtime) === null || _b === void 0 ? void 0 : _b.getURL)
  ) {
    return browser.runtime.getURL("index.html") // Firefox
  }
  return `${window.location.origin}/index.html` // Fallback
}

const isProduction = process.env.NODE_ENV === "production"

export const isDevelopment = !isProduction
export const isTestingDevice = false && isDevelopment
export const isE2E =
  getEnv().VITE_TESTING_ENV === "e2e" || getEnv().TESTING_ENV === "e2e"

export const chrryDev = {
  mode: "chrryDev",
  slug: "chrryDev",
  storeSlug: "chrry",
  favicon: "chrry",
  isStoreApp: true,
  store: "https://chrry.dev",
  name: "Chrry",
  domain: "chrry.dev",
  url: "https://chrry.dev",
  email: "iliyan@chrry.ai",
  description:
    "🐝 A modern, cross-platform AI Infrastructure for Universal React and TypeScript",
  logo: "/assets/cherry-logo.svg", // Cross-platform SVG
  primaryColor: "#E91E63", // Cherry pink
  links: {
    github: "https://github.com/chrryAI/vex",
    npm: "https://www.npmjs.com/package/@chrryai/chrry",
    // docs: "https://chrry.dev/docs",
    // demo: "https://chrry.dev/demo",
  },
  features: [
    {
      title: "Sushi(WIP)",
      description:
        "🏢 Enterprise-grade compiler infrastructure with multi-agent 🤖 coordination",
      icon: "🍣",
      link: "https://github.com/chrryAI/sushi",
      isOpenSource: true,
    },
    {
      title: "Waffles",
      description: "Playwright testing utilities for Sushi 🍣 e2e strikes 🎯",
      icon: "🧇",
      link: "https://github.com/chrryAI/waffles",
      isOpenSource: true,
    },
    {
      title: "Pepper",
      description: "Universal router with view transitions",
      icon: "🌶️",
      link: "https://github.com/chrryAI/pepper",
      isOpenSource: true,
    },
    {
      title: "Components",
      description: "100+ production-ready UI components",
      icon: "🎨",
      link: "https://github.com/chrryAI/vex/tree/main/packages/ui",
      isOpenSource: true,
    },
    {
      title: "Styles",
      description: "SCSS to TypeScript converter",
      icon: "🎭",
      link: "https://github.com/chrryAI/vex/tree/main/scripts/scss-to-universal.js",
      isOpenSource: true,
    },
    {
      title: "Hooks",
      description: "Reusable React hooks",
      icon: "🪝",
      link: "https://github.com/chrryAI/vex/tree/main/packages/ui/hooks",
      isOpenSource: true,
    },
    {
      title: "Context",
      description: "State management providers",
      icon: "🔄",
      link: "https://github.com/chrryAI/vex/blob/main/packages/ui/context",
      isOpenSource: true,
    },
    {
      title: "Platform",
      description: "Cross-platform utilities",
      icon: "📱",
      link: "https://github.com/chrryAI/vex/tree/main/packages/ui/platform",
      isOpenSource: true,
    },
  ],
}
const vault = {
  url: "https://vault.chrry.ai",
  mode: "vault",
  slug: "vault",
  favicon: "vault",
  storeSlug: "wine",
  name: "Vault",
  isStoreApp: true,
  domain: "vault.chrry.ai",
  store: "https://vault.chrry.ai",
  email: "iliyan@chrry.ai",
  description:
    "AI-powered financial analytics. Track expenses, budgets, insights.",
  logo: "🏦",
  primaryColor: "#059669", // Emerald green
  links: {
    github: "https://github.com/chrryAI/vex",
    docs: "https://vault.chrry.ai/docs",
  },
  features: [
    {
      title: "Expense Tracking",
      description: "AI-categorized expense management",
      icon: "💸",
      link: "/expenses",
      isOpenSource: true,
    },
    {
      title: "White Label",
      description: "Customize for your brand",
      icon: "🎨",
      link: "/white-label",
      isOpenSource: true,
    },
  ],
}
const pear = {
  url: "https://pear.chrry.ai",
  mode: "pear",
  slug: "pear",
  favicon: "pear",
  storeSlug: "wine",
  name: "Pear",
  isStoreApp: false,
  domain: "pear.chrry.ai",
  store: "https://wine.chrry.ai",
  email: "iliyan@chrry.ai",
  description: "AI-powered feedback system. Earn credits for quality insights.",
  logo: "🍐",
  primaryColor: "#84CC16", // Lime green
  links: {
    github: "https://github.com/chrryAI/vex",
    docs: "https://pear.chrry.ai/docs",
  },
  features: [
    {
      title: "AI Feedback Validation",
      description: "Get rewarded for quality feedback",
      icon: "✨",
      link: "/feedback",
      isOpenSource: true,
    },
    {
      title: "White Label",
      description: "Customize for your brand",
      icon: "🎨",
      link: "/white-label",
      isOpenSource: true,
    },
  ],
}
const chrryAI = {
  slug: "chrry",
  favicon: "chrry",
  isStoreApp: true,
  storeSlug: "blossom",
  mode: "chrryAI",
  name: "Chrry",
  domain: "chrry.ai",
  email: "iliyan@chrry.ai",
  chromeWebStoreUrl:
    "https://chromewebstore.google.com/detail/chrry-🍒/odgdgbbddopmblglebfngmaebmnhegfc",
  url: "https://chrry.ai",
  store: "https://chrry.ai",
  description: "AI App Marketplace - Discover, create, and monetize AI apps",
  logo: "🍒",
  primaryColor: "#E91E63", // Cherry pink
  links: {
    github: "https://github.com/chrryAI/vex",
    docs: "https://chrry.ai/docs",
    // store: "https://chrry.store",
  },
  features: [
    {
      title: "App Marketplace",
      description: "Discover and install AI apps",
      icon: "🏪",
      link: "/explore",
      isOpenSource: true,
    },
    {
      title: "Create Stores",
      description: "Build your own AI app marketplace",
      icon: "🏗️",
      link: "/stores/new",
      isOpenSource: true,
    },
    {
      title: "Publish Apps",
      description: "Monetize your AI applications",
      icon: "📱",
      link: "/apps/new",
      isOpenSource: true,
    },
    {
      title: "Revenue Sharing",
      description: "Earn 70% on every sale",
      icon: "💰",
      link: "/affiliate",
      isOpenSource: true,
    },
    {
      title: "Custom Domains",
      description: "White-label your store",
      icon: "🌐",
      link: "/settings/domain",
      isOpenSource: true,
    },
    {
      title: "Analytics",
      description: "Track your app performance",
      icon: "📊",
      link: "/analytics",
      isOpenSource: true,
    },
    {
      title: "Multi-Agent Support",
      description: "Build for any AI platform",
      icon: "🤖",
      link: "/docs/agents",
      isOpenSource: true,
    },
    {
      title: "Developer Tools",
      description: "APIs and SDKs for developers",
      icon: "🛠️",
      link: "/docs/api",
      isOpenSource: true,
    },
  ],
  about: {
    intro:
      "Chrry is the ultimate AI app marketplace where creativity meets monetization. Discover cutting-edge AI applications built by developers worldwide, or create and publish your own AI apps to earn revenue.",
    intro2:
      "With 70% revenue sharing for app creators, custom stores, and powerful developer tools - Chrry empowers both users and builders to harness the full potential of AI technology.",
    approach: {
      title: "Our Mission",
      content:
        "We're building the infrastructure for the AI app economy. Chrry makes it simple for developers to monetize their AI creations while giving users access to a curated marketplace of high-quality applications. Transparency in pricing, usage, and revenue sharing is at our core.",
    },
    platforms: {
      title: "Available Everywhere",
      content:
        "Access Chrry's AI app marketplace across all your devices - web, mobile PWA, and browser extensions.",
      web: {
        title: "🌐 Web Application",
        content:
          "Full marketplace experience with app discovery, installation, and management from any browser.",
      },
      pwa: {
        title: "📱 Progressive Web App",
        content:
          "Install Chrry on your mobile or desktop. Browse apps offline, get notifications, sync across devices.",
      },
      chrome: {
        title: "🧩 Chrome Extension",
        content:
          "Quick access to your installed apps from the browser toolbar. Right-click integration on any webpage.",
      },
    },
  },
}
const focus = {
  favicon: "focus",
  isStoreApp: false,
  mode: "focus",
  slug: "focus",
  version: "26.11.33",
  storeSlug: "blossom",
  name: "Focus",
  domain: "focus.chrry.ai",
  chromeWebStoreUrl:
    "https://chromewebstore.google.com/detail/focus-🍒/nkomoiomfaeodakglkihapminhpgnibl",
  store: "https://chrry.ai",
  email: "iliyan@chrry.ai",
  url: "https://focus.chrry.ai",
  description:
    "AI-powered Pomodoro timer with task management and mood tracking. Stay focused, productive, and mindful while you work.",
  logo: "⏱️",
  primaryColor: "#3B82F6", // Blue
  links: {
    github: "https://github.com/chrryAI/vex",
    docs: "https://focus.chrry.ai/docs",
  },
  features: [
    {
      title: "Focus Timer",
      description: "Pomodoro and custom focus sessions",
      icon: "⏱️",
      link: "/timer",
      isOpenSource: true,
    },
    {
      title: "Task Management",
      description: "Organize and track your tasks",
      icon: "✅",
      link: "/tasks",
      isOpenSource: true,
    },
    {
      title: "AI Task Breakdown",
      description: "Break complex projects into steps",
      icon: "🤖",
      link: "/ai",
      isOpenSource: true,
    },
    {
      title: "Time Tracking",
      description: "Track time across all your tasks",
      icon: "📊",
      link: "/analytics",
      isOpenSource: true,
    },
    {
      title: "Progress Analytics",
      description: "Visualize your productivity patterns",
      icon: "📈",
      link: "/progress",
      isOpenSource: true,
    },
    {
      title: "Goal Setting",
      description: "Set and achieve your goals",
      icon: "🎯",
      link: "/goals",
      isOpenSource: true,
    },
    {
      title: "Productivity Insights",
      description: "AI-powered productivity tips",
      icon: "💡",
      link: "/insights",
      isOpenSource: true,
    },
    {
      title: "Deep Work Mode",
      description: "Eliminate distractions and focus",
      icon: "🧠",
      link: "/deep-work",
      isOpenSource: true,
    },
  ],
}
const atlas = {
  favicon: "atlas",
  mode: "atlas",
  slug: "atlas",
  isStoreApp: true,
  storeSlug: "compass",
  chromeWebStoreUrl:
    "https://chromewebstore.google.com/detail/atlas-🍒/adopnldifkjlgholfcijjgocgnolknpb",
  name: "Atlas",
  domain: "atlas.chrry.ai",
  url: "https://atlas.chrry.ai",
  store: "https://atlas.chrry.ai",
  email: "iliyan@chrry.ai",
  description:
    "Your intelligent geographic companion. Save locations with AI context, create geo-tagged notes, and discover local AI resources.",
  logo: "🌍",
  primaryColor: "#10B981", // Green
  links: {
    github: "https://github.com/chrryai/vex",
    docs: "https://atlas.chrry.ai/docs",
  },
  features: [
    {
      title: "Geo-Tagged Memory",
      description: "Save locations with AI context",
      icon: "📍",
      link: "/memory",
      isOpenSource: true,
    },
    {
      title: "Travel Planning",
      description: "Smart itineraries and local insights",
      icon: "✈️",
      link: "/travel",
      isOpenSource: true,
    },
    {
      title: "Local Discovery",
      description: "Find authentic spots locals love",
      icon: "🗺️",
      link: "/discover",
      isOpenSource: true,
    },
    {
      title: "Weather Integration",
      description: "Real-time weather for your locations",
      icon: "🌤️",
      link: "/weather",
      isOpenSource: true,
    },
    {
      title: "Browser Extension",
      description: "Access Atlas from anywhere",
      icon: "🔌",
      link: "https://chrome.google.com/webstore",
      isOpenSource: true,
    },
  ],
  about: {
    intro:
      "Atlas is your intelligent geographic companion that transforms how you explore and remember places. Save locations with AI-powered context, create geo-tagged notes, and discover local insights wherever you go.",
    intro2:
      "Whether you're planning your next adventure or documenting your favorite spots - Atlas combines location intelligence with AI to help you navigate the world more meaningfully.",
    approach: {
      title: "Smart Geography",
      content:
        "We're reinventing how people interact with places. Atlas uses AI to understand not just where you've been, but why it mattered. From travel planning to local discovery - every feature is designed to enrich your geographic experiences with intelligent context.",
    },
    platforms: {
      title: "Explore Anywhere",
      content:
        "Take Atlas with you across web, mobile, and browser - your geographic memory synced everywhere.",
      web: {
        title: "🌐 Web Application",
        content:
          "Full-featured mapping experience with location management, travel planning, and local discovery from any browser.",
      },
      pwa: {
        title: "📱 Progressive Web App",
        content:
          "Install Atlas as a native app. Access your saved locations offline, get location-based notifications, and seamless sync.",
      },
      chrome: {
        title: "🧩 Chrome Extension",
        content:
          "Save locations while browsing, get context-aware recommendations, and quick access to your geographic memory from the toolbar.",
      },
    },
  },
}
const istanbul = {
  favicon: "atlas",
  isStoreApp: false,
  mode: "istanbul",
  slug: "istanbul",
  storeSlug: "compass",
  name: "Istanbul",
  domain: "istanbul.chrry.ai",
  url: "https://istanbul.chrry.ai",
  store: "https://atlas.chrry.ai",
  email: "iliyan@chrry.ai",
  description:
    "Your personal AI assistant designed for Istanbul and Turkey. Chat in Turkish, collaborate locally, and get things done faster.",
  logo: "🇹🇷",
  primaryColor: "#E30A17", // Turkish red
  links: {
    github: "https://github.com/chrryai/vex",
    docs: "https://istanbul.chrry.ai/docs",
  },
}
const amsterdam = {
  favicon: "atlas",
  mode: "amsterdam",
  slug: "amsterdam",
  isStoreApp: false,
  storeSlug: "compass",
  name: "Amsterdam",
  domain: "amsterdam.chrry.ai",
  url: "https://amsterdam.chrry.ai",
  store: "https://atlas.chrry.ai",
  email: "iliyan@chrry.ai",
  description:
    "Your personal AI assistant designed for Amsterdam and the Netherlands. Chat in Dutch, collaborate locally, and get things done faster.",
  logo: "🇳🇱",
  primaryColor: "#FF6B35", // Dutch orange
  links: {
    github: "https://github.com/chrryai/vex",
    docs: "https://amsterdam.chrry.ai/docs",
  },
}
const tokyo = {
  favicon: "atlas",
  mode: "tokyo",
  slug: "tokyo",
  storeSlug: "compass",
  isStoreApp: false,
  name: "Tokyo",
  domain: "tokyo.chrry.ai",
  url: "https://tokyo.chrry.ai",
  store: "https://atlas.chrry.ai",
  email: "iliyan@chrry.ai",
  description:
    "Your personal AI assistant designed for Tokyo and Japan. Chat in Japanese, collaborate locally, and get things done faster.",
  logo: "🇯🇵",
  primaryColor: "#BC002D", // Japanese red
  links: {
    github: "https://github.com/chrryai/vex",
    docs: "https://tokyo.chrry.ai/docs",
  },
}
const newYork = {
  favicon: "atlas",
  mode: "newYork",
  slug: "newYork",
  storeSlug: "compass",
  name: "New York",
  isStoreApp: false,
  domain: "newyork.chrry.ai",
  url: "https://newyork.chrry.ai",
  store: "https://atlas.chrry.ai",
  email: "iliyan@chrry.ai",
  description:
    "Your personal AI assistant designed for New York City and the USA. Chat, collaborate locally, and get things done faster in the city that never sleeps.",
  logo: "🗽",
  primaryColor: "#0039A6", // NYC blue
  links: {
    github: "https://github.com/chrryai/vex",
    docs: "https://newyork.chrry.ai/docs",
  },
}
const popcorn = {
  favicon: "popcorn",
  mode: "popcorn",
  slug: "popcorn",
  storeSlug: "movies",
  chromeWebStoreUrl:
    "https://chromewebstore.google.com/detail/popcorn-🍒/lfokfhplbjckmfmbakfgpkhaanfencah",
  name: "Popcorn",
  isStoreApp: true,
  domain: "popcorn.chrry.ai",
  url: "https://popcorn.chrry.ai",
  store: "https://popcorn.chrry.ai",
  email: "iliyan@chrry.ai",
  description:
    "Step into the premier hub for iconic films, genre-defining storytelling, and cinematic AI companions that decode every frame.",
  logo: "🍿",
  primaryColor: "#DC2626", // Cinema red
  links: {
    github: "https://github.com/chrryai/vex",
    docs: "https://popcorn.chrry.ai/docs",
  },
}
const zarathustra = {
  favicon: "zarathustra",
  mode: "zarathustra",
  slug: "zarathustra",
  storeSlug: "books",
  chromeWebStoreUrl:
    "https://chromewebstore.google.com/detail/zarathustra-🍒/jijgmcofljfalongocihccblcboppnad",
  name: "Zarathustra",
  domain: "books.chrry.ai",
  url: "https://books.chrry.ai",
  isStoreApp: true,
  store: "https://books.chrry.ai",
  email: "iliyan@chrry.ai",
  description:
    "Your AI philosophy guide. Explore Nietzsche, existentialism, and timeless wisdom through intelligent conversation.",
  logo: "🦋",
  primaryColor: "#7C3AED", // Purple/violet for wisdom
  links: {
    github: "https://github.com/chrryai/vex",
    docs: "https://zarathustra.chrry.ai/docs",
  },
}
const search = {
  favicon: "search",
  mode: "search",
  slug: "search",
  storeSlug: "perplexityStore",
  name: "Search",
  domain: "search.chrry.ai",
  url: "https://search.chrry.ai",
  chromeWebStoreUrl:
    "https://chromewebstore.google.com/detail/search-🍒/cloblmampohoemdaojenlkjbnkpmkiop",
  isStoreApp: false,
  store: "https://search.chrry.ai",
  email: "iliyan@chrry.ai",
  description:
    "AI-powered real-time web search with cited sources. Get instant, accurate answers with verifiable references worldwide.",
  logo: "🔍",
  primaryColor: "#3B82F6", // Blue
  links: {
    github: "https://github.com/chrryai/vex",
    docs: "https://search.chrry.ai/docs",
  },
}
const nebula = {
  url: "https://orbit.chrry.ai",
  mode: "nebula",
  slug: "nebula",
  favicon: "nebula",
  storeSlug: "orbit",
  name: "Nebula",
  isStoreApp: true,
  domain: "orbit.chrry.ai",
  store: "https://orbit.chrry.ai",
  email: "iliyan@chrry.ai",
  description: "Science & Exploration Hub",
  logo: "🌌",
  primaryColor: "#7C3AED", // Violet
  links: {
    docs: "https://orbit.chrry.ai/docs",
  },
}
const vex = {
  url: "https://vex.chrry.ai",
  mode: "vex",
  slug: "vex",
  favicon: "vex",
  storeSlug: "lifeOS",
  name: "Vex",
  isStoreApp: true,
  domain: "vex.chrry.ai",
  store: "https://vex.chrry.ai",
  email: "iliyan@chrry.ai",
  description: "Your AI-Powered Life",
  logo: "🤖",
  primaryColor: "#6366F1", // Indigo
  links: {
    github: "https://github.com/chrryAI/vex",
    docs: "https://vex.chrry.ai/docs",
  },
}
const burn = {
  url: "https://burn.chrry.ai",
  mode: "burn",
  slug: "burn",
  favicon: "burn",
  storeSlug: "blossom",
  name: "Burn",
  isStoreApp: false,
  chromeWebStoreUrl:
    "https://chromewebstore.google.com/detail/burn-🍒/lfokfhplbjckmfmbakfgpkhaanfencah",
  domain: "burn.chrry.ai",
  store: "https://chrry.ai",
  email: "iliyan@chrry.ai",
  description:
    "Anonymous AI chat. No login required. Guest subscriptions, private credits, anonymous agents. Maximum privacy guaranteed.",
  logo: "🔥",
  primaryColor: "#F97316", // Orange/fire color
  links: {
    github: "https://github.com/chrryAI/vex",
    docs: "https://burn.chrry.ai/docs",
  },
}
// E2E testing environment (same as vex but with e2e domain)
const e2eVex = Object.assign(Object.assign({}, vex), {
  url: "https://e2e.chrry.ai",
  domain: "e2e.chrry.ai",
})
const _tribe = Object.assign(Object.assign({}, zarathustra), {
  mode: "tribe",
  name: "Tribe",
  url: "https://tribe.chrry.ai",
  domain: "tribe.chrry.ai",
  isTribe: true,
})
const staging = Object.assign(Object.assign({}, chrryAI), {
  url: "https://staging.chrry.ai",
  domain: "staging.chrry.ai",
})
const sushi = {
  url: "https://sushi.chrry.ai",
  mode: "sushi",
  slug: "sushi",
  favicon: "sushi",
  storeSlug: "sushiStore",
  chromeWebStoreUrl:
    "https://chrome.google.com/webstore/detail/sushi-🍒/fkblifhgfkmdccjkailndfokadjinabn",
  name: "Sushi",
  isStoreApp: true,
  domain: "sushi.chrry.ai",
  store: "https://sushi.chrry.ai",
  email: "iliyan@chrry.ai",
  description:
    "AI coding assistant for generation, debugging & architecture. Production-ready code in seconds. Built for developers.",
  logo: "🍣",
  primaryColor: "#10B981", // Emerald green (coding/terminal theme)
  links: {
    github: "https://github.com/chrryAI/vex",
    docs: "https://sushi.chrry.ai/docs",
  },
}
const grape = {
  url: "https://grape.chrry.ai",
  mode: "grape",
  chromeWebStoreUrl:
    "https://chromewebstore.google.com/detail/grape-🍒/kiplpljdjejcnmlfnkocbjbbcoiegjob",
  slug: "grape",
  favicon: "grape",
  storeSlug: "wine",
  name: "Grape",
  isStoreApp: false,
  domain: "grape.chrry.ai",
  store: "https://grape.chrry.ai",
  email: "iliyan@chrry.ai",
  description: "Discover apps, earn credits. Give feedback with Pear 🍐",
  logo: "🍇",
  primaryColor: "#9333EA", // Purple
  links: {
    github: "https://github.com/chrryAI/vex",
    docs: "https://grape.chrry.ai/docs",
  },
}
export const extensions = [
  "https://focus.chrry.ai",
  "https://chrry.dev",
  "https://vex.chrry.ai",
  "https://chrry.ai",
  "https://popcorn.chrry.ai",
]

const matchesDomain = (host, domain) => {
  return host === domain || host.endsWith(`.${domain}`)
}
export function isTauri() {
  if (typeof window === "undefined") return false
  // Check for Tauri API presence
  return (
    "__TAURI__" in window ||
    "__TAURI_INTERNALS__" in window ||
    "TAURI_EVENT_PLUGIN_INTERNALS" in window
  )
}
export function getSiteTranslation(mode, locale) {
  var _a, _b
  const catalog =
    (_a = siteTranslations[mode]) !== null && _a !== void 0
      ? _a
      : siteTranslations.vex
  return (_b = catalog[locale]) !== null && _b !== void 0 ? _b : catalog.en
}
export function detectsiteModeDomain(hostname, mode) {
  var _a, _b, _c
  const devMode = "tribe"
  const defaultMode = getEnv().VITE_SITE_MODE || mode || devMode
  if (isDevelopment && !checkIsExtension() && !isTauri()) {
    return defaultMode || devMode
  }
  // Get hostname from parameter or window (client-side)
  const rawHost =
    hostname ||
    (typeof window !== "undefined"
      ? (_a =
          window === null || window === void 0 ? void 0 : window.location) ===
          null || _a === void 0
        ? void 0
        : _a.hostname
      : "") ||
    ""
  let host =
    rawHost === null || rawHost === void 0
      ? void 0
      : rawHost.trim().toLowerCase()
  if (host === null || host === void 0 ? void 0 : host.includes("://")) {
    try {
      host = new URL(host).hostname.toLowerCase()
    } catch (e) {
      console.log("Error parsing URL:", e)
    }
  }
  // Helper function to check if hostname matches or is subdomain of domain
  // Check if running in a browser extension
  if (
    typeof window !== "undefined" &&
    ((_c =
      (_b = window.location) === null || _b === void 0
        ? void 0
        : _b.protocol) === null || _c === void 0
      ? void 0
      : _c.startsWith("chrome-extension"))
  ) {
    console.log(
      "🔍 Running in Chrome extension, using VITE_SITE_MODE:",
      defaultMode,
    )
    return defaultMode
  }
  // Domain-based detection (use exact match or subdomain check)
  console.log(`🔍 Detecting mode for host: "${host}"`)
  if (matchesDomain(host, "grape.chrry.ai")) {
    return "grape"
  }
  if (matchesDomain(host, "pear.chrry.ai")) {
    return "pear"
  }
  if (matchesDomain(host, "vault.chrry.ai")) {
    return "vault"
  }
  if (matchesDomain(host, "sushi.chrry.ai")) {
    return "sushi"
  }
  if (matchesDomain(host, "burn.chrry.ai")) {
    return "burn"
  }
  if (matchesDomain(host, "books.chrry.ai")) {
    return "zarathustra"
  }
  if (matchesDomain(host, "search.chrry.ai")) {
    return "search"
  }
  if (matchesDomain(host, "atlas.chrry.ai")) {
    return "atlas"
  }
  if (matchesDomain(host, "istanbul.chrry.ai")) {
    return "istanbul"
  }
  if (matchesDomain(host, "amsterdam.chrry.ai")) {
    return "amsterdam"
  }
  if (matchesDomain(host, "tokyo.chrry.ai")) {
    return "tokyo"
  }
  if (matchesDomain(host, "newyork.chrry.ai")) {
    return "newYork"
  }
  if (matchesDomain(host, "popcorn.chrry.ai")) {
    return "popcorn"
  }
  if (matchesDomain(host, "staging.chrry.ai")) {
    return "staging"
  }
  if (matchesDomain(host, "tribe.chrry.ai")) {
    return "tribe"
  }
  // E2E testing environment
  if (matchesDomain(host, "e2e.chrry.ai")) {
    return "e2eVex"
  }
  if (matchesDomain(host, "orbit.chrry.ai")) {
    return "nebula"
  }
  if (matchesDomain(host, "vex.chrry.ai")) {
    return "vex"
  }
  // Focus custom domain (add your custom domain here)
  if (host === "focus.chrry.ai" || matchesDomain(host, "focusbutton.com")) {
    return "focus"
  }
  // chrry.ai and all subdomains (bloom.chrry.ai, vault.chrry.ai, etc.)
  if (matchesDomain(host, "chrry.ai") && host !== "vex.chrry.ai") {
    return "chrryAI"
  }
  if (matchesDomain(host, "chrry.dev")) {
    return "chrryDev"
  }
  // Store domains
  if (matchesDomain(host, "chrry.store")) {
    return "chrryStore"
  }
  if (matchesDomain(host, "sushi.chrry.ai")) {
    return "sushi"
  }
  // City subdomains
  // Default to defaultMode (vex.chrry.ai or localhost)
  return defaultMode
}
/**
 * Detect which site we're running on
 * @param hostname - Optional hostname for SSR (prevents hydration mismatch)
 */
export function detectsiteMode(hostname) {
  const validModes = [
    "chrryDev",
    "chrryAI",
    "chrryStore",
    "vex",
    "focus",
    "atlas",
    "istanbul",
    "amsterdam",
    "tokyo",
    "newYork",
    "popcorn",
    "zarathustra",
    "search",
    "sushi",
    "e2eVex",
    "grape",
    "staging",
    "burn",
    "pear",
    "vault",
    "tribe",
    "nebula",
  ]
  // If hostname is already a valid siteMode (e.g., "atlas"), use it directly
  if (hostname && validModes.includes(hostname)) {
    return hostname
  }
  // Otherwise, detect from domain (e.g., "atlas.chrry.ai" -> "atlas")
  const result = detectsiteModeDomain(hostname)
  return result
}
const getClientHostname = () => {
  if (typeof window !== "undefined" && window.location) {
    return window.location.hostname
  }
  return undefined
}
/**
 * Get site configuration based on current domain
 * @param hostnameOrMode - Either a hostname (for SSR) or a siteMode string
 */
export function getSiteConfig(hostnameOrMode, caller) {
  let hostname = hostnameOrMode || getClientHostname()
  if (
    hostnameOrMode === null || hostnameOrMode === void 0
      ? void 0
      : hostnameOrMode.includes("://")
  ) {
    try {
      hostname = new URL(hostnameOrMode).hostname
    } catch (_a) {
      hostname = hostnameOrMode
    }
  }
  const mode = detectsiteMode(hostname)
  if (mode === "nebula") {
    return nebula
  }
  if (mode === "sushi") {
    return sushi
  }
  if (!isTauri() && !isDevelopment && isE2E) {
    return e2eVex
  }
  if (mode === "search") {
    return search
  }
  // Check for E2E environment first
  if (hostname && matchesDomain(hostname, "e2e.chrry.ai")) {
    return e2eVex
  }
  if (mode === "chrryDev") {
    return chrryDev
  }
  if (mode === "chrryAI") {
    return chrryAI
  }
  if (mode === "focus") {
    return focus
  }
  // Atlas configuration
  if (mode === "atlas") {
    return atlas
  }
  // Istanbul configuration
  if (mode === "istanbul") {
    return istanbul
  }
  // Amsterdam configuration
  if (mode === "amsterdam") {
    return amsterdam
  }
  // Tokyo configuration
  if (mode === "tokyo") {
    return tokyo
  }
  // New York configuration
  if (mode === "newYork") {
    return newYork
  }
  // Popcorn configuration
  if (mode === "popcorn") {
    return popcorn
  }
  // Zarathustra configuration
  if (mode === "zarathustra") {
    return zarathustra
  }
  if (mode === "e2eVex") {
    return e2eVex
  }
  if (mode === "grape") {
    return grape
  }
  if (mode === "burn") {
    return burn
  }
  if (mode === "staging") {
    return staging
  }
  if (mode === "pear") {
    return pear
  }
  if (mode === "vault") {
    return vault
  }
  if (mode === "tribe") {
    return _tribe
  }
  if (isE2E) {
    return e2eVex
  }
  // Search configuration
  // Vex configuration
  return vex
}
export const whiteLabels = [
  // chrryDev,
  chrryAI,
  focus,
  atlas,
  istanbul,
  amsterdam,
  tokyo,
  newYork,
  popcorn,
  zarathustra,
  search,
  sushi,
  vex,
  pear,
  vault,
]
export const analyticsDomains = whiteLabels.concat(e2eVex).concat(_tribe)
/**
 * Check if current site is Chrry
 */
export function isChrryDevMode() {
  return detectsiteMode() === "chrryDev"
}
/**
 * Check if current site is Vex
 */
export function isVexMode() {
  return detectsiteMode() === "vex"
}

// const getEnv = () => {
//   if (typeof import.meta !== "undefined") {
//     return import.meta.env
//   }
//   if (typeof process.env !== "undefined") {
//     return process.env
//   }

//   return {}
// }

const VERSION = "2.0.52"
// Constants
const port = process.env.PORT || 5173
const base = process.env.BASE || "/"
const _ABORT_DELAY = 10000

const isDev = process.env.NODE_ENV === "development"

// Cached production assets
const templateHtml = isProduction
  ? await fs.readFile("./dist/client/index.html", "utf-8")
  : ""

// Create http server
const app = express()

// Trust proxy - needed for X-Forwarded-For header from reverse proxy
// Set to 1 for single proxy (Nginx) - more secure than 'true'
app.set("trust proxy", 1)

app.use(cookieParser())

// CORS middleware for development (mobile app access)
app.use((req, res, next) => {
  const origin = req.headers.origin

  // Strict validation for development origins
  if (isDev && origin) {
    try {
      const url = new URL(origin)
      const hostname = url.hostname

      // Allow only specific localhost and local network patterns
      const isAllowed =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) || // Strict IP validation
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || // Private network
        /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname) // Private network

      if (isAllowed) {
        res.setHeader("Access-Control-Allow-Origin", origin)
        res.setHeader("Access-Control-Allow-Credentials", "true")
        res.setHeader(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, OPTIONS",
        )
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization",
        )
      }
    } catch (_e) {
      // Invalid origin URL, skip CORS headers
    }
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(200)
  }

  next()
})

// Initialize Arcjet for rate limiting and security
const aj = arcjet({
  key: process.env.ARCJET_KEY || "test-key",
  characteristics: ["ip"],
  // Configure IP detection for Cloudflare
  client: {
    ipDetection: {
      // Cloudflare sends real IP in CF-Connecting-IP header
      headers: ["CF-Connecting-IP", "X-Forwarded-For", "X-Real-IP"],
    },
  },
  rules: [
    // Shield protects against common attacks
    shield({ mode: "LIVE" }),
    // Rate limit SSR requests to prevent DoS
    fixedWindow({
      mode: "LIVE",
      window: "1m",
      max: 100, // 100 requests per minute per IP
    }),
  ],
})

// Add Vite or respective production middlewares
/** @type {import('vite').ViteDevServer | undefined} */
let vite
if (isDev) {
  const { createServer } = await import("vite")
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    base,
  })
  app.use(vite.middlewares)
} else {
  const compression = (await import("compression")).default
  const sirv = (await import("sirv")).default

  // Enhanced compression with better settings
  app.use(
    compression({
      level: 6, // Balance between speed and compression ratio
      threshold: 1024, // Only compress responses > 1KB
      filter: (req, res) => {
        // Don't compress if client doesn't support it
        if (req.headers["x-no-compression"]) {
          return false
        }
        // Compress all text-based content
        return compression.filter(req, res)
      },
    }),
  )

  // Add cache headers for static assets
  app.use((req, res, next) => {
    // Cache static assets aggressively
    if (
      req.path.match(
        /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$/,
      )
    ) {
      // 1 year cache for hashed assets
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
      res.setHeader("Expires", new Date(Date.now() + 31536000000).toUTCString())
    } else if (req.path.startsWith("/assets/")) {
      // 1 year for anything in /assets/ (Vite adds hashes)
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
      res.setHeader("Expires", new Date(Date.now() + 31536000000).toUTCString())
    } else if (req.path === "/" || req.path.endsWith(".html")) {
      // No cache for HTML to ensure fresh content
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
      res.setHeader("Pragma", "no-cache")
      res.setHeader("Expires", "0")
    }
    next()
  })

  app.use(
    base,
    sirv("./dist/client", {
      extensions: [],
      maxAge: 31536000, // 1 year in seconds
      immutable: true,
      gzip: true, // Serve pre-compressed .gz files if available
      brotli: true, // Serve pre-compressed .br files if available
    }),
  )
}

// Build ID is set at build time (GIT_SHA) or runtime fallback
const buildId = process.env.GIT_SHA || Date.now().toString()

// Helper function to escape HTML
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }
  return String(text).replace(/[&<>"']/g, (m) => map[m] || m)
}

// Convert metadata object to HTML meta tags
function metadataToHtml(metadata, serverData) {
  const tags = []

  if (metadata.title) {
    tags.push(`<title>${escapeHtml(metadata.title)}</title>`)
  }

  if (metadata.description) {
    tags.push(
      `<meta name="description" content="${escapeHtml(metadata.description)}" />`,
    )
  }

  if (metadata.keywords && metadata.keywords.length > 0) {
    tags.push(
      `<meta name="keywords" content="${escapeHtml(metadata.keywords.join(", "))}" />`,
    )
  }

  if (metadata.openGraph) {
    const og = metadata.openGraph
    if (og.title) {
      tags.push(
        `<meta property="og:title" content="${escapeHtml(og.title)}" />`,
      )
    }
    if (og.description) {
      tags.push(
        `<meta property="og:description" content="${escapeHtml(og.description)}" />`,
      )
    }
    if (og.url) {
      tags.push(`<meta property="og:url" content="${escapeHtml(og.url)}" />`)
    }
    if (og.siteName) {
      tags.push(
        `<meta property="og:site_name" content="${escapeHtml(og.siteName)}" />`,
      )
    }
    if (og.type) {
      tags.push(`<meta property="og:type" content="${escapeHtml(og.type)}" />`)
    }
    if (og.locale) {
      tags.push(
        `<meta property="og:locale" content="${escapeHtml(og.locale)}" />`,
      )
    }
    if (og.images && og.images.length > 0) {
      og.images.forEach((image) => {
        tags.push(
          `<meta property="og:image" content="${escapeHtml(image.url)}" />`,
        )
        if (image.width) {
          tags.push(
            `<meta property="og:image:width" content="${image.width}" />`,
          )
        }
        if (image.height) {
          tags.push(
            `<meta property="og:image:height" content="${image.height}" />`,
          )
        }
      })
    }
  }

  if (metadata.twitter) {
    const twitter = metadata.twitter
    if (twitter.card) {
      tags.push(
        `<meta name="twitter:card" content="${escapeHtml(twitter.card)}" />`,
      )
    }
    if (twitter.title) {
      tags.push(
        `<meta name="twitter:title" content="${escapeHtml(twitter.title)}" />`,
      )
    }
    if (twitter.description) {
      tags.push(
        `<meta name="twitter:description" content="${escapeHtml(twitter.description)}" />`,
      )
    }
    if (twitter.site) {
      tags.push(
        `<meta name="twitter:site" content="${escapeHtml(twitter.site)}" />`,
      )
    }
    if (twitter.creator) {
      tags.push(
        `<meta name="twitter:creator" content="${escapeHtml(twitter.creator)}" />`,
      )
    }
    if (twitter.images && twitter.images.length > 0) {
      twitter.images.forEach((image) => {
        const imageUrl = typeof image === "string" ? image : image.url
        tags.push(
          `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
        )
      })
    }
  }

  if (metadata.robots) {
    const robotsContent = `${metadata.robots.index ? "index" : "noindex"}, ${metadata.robots.follow ? "follow" : "nofollow"}`
    tags.push(`<meta name="robots" content="${robotsContent}" />`)
  }

  if (metadata.alternates?.canonical) {
    tags.push(
      `<link rel="canonical" href="${escapeHtml(metadata.alternates.canonical)}" />`,
    )
  }

  if (metadata.alternates?.languages) {
    Object.entries(metadata.alternates.languages).forEach(([lang, url]) => {
      tags.push(
        `<link rel="alternate" hreflang="${escapeHtml(lang)}" href="${escapeHtml(url)}" />`,
      )
    })
  }

  // Favicon and Apple Touch Icons - use hostname for white-label detection
  // Use serverData.siteConfig which is already available from server-loader
  const iconSlug = serverData?.siteConfig?.isTribe
    ? "tribe"
    : serverData?.siteConfig?.storeSlug === "compass"
      ? "atlas"
      : serverData?.siteConfig?.slug || serverData?.app?.slug || "chrry"
  const baseIcon = `/images/apps/${iconSlug}.png`
  const apiUrl = process.env.VITE_API_URL || "https://chrry.dev/api"

  // Regular favicons at different sizes using resize endpoint
  // Request 3x density (e.g. 48px for 16px icon) for Super Retina displays
  // Force PNG format for strict browser compatibility
  const favicon16 = `${apiUrl}/resize?url=${encodeURIComponent(baseIcon)}&w=48&h=48&fit=contain&q=100&fmt=png`
  const favicon32 = `${apiUrl}/resize?url=${encodeURIComponent(baseIcon)}&w=96&h=96&fit=contain&q=100&fmt=png`
  const favicon48 = `${apiUrl}/resize?url=${encodeURIComponent(baseIcon)}&w=144&h=144&fit=contain&q=100&fmt=png`

  tags.push(
    `<link rel="icon" type="image/png" sizes="16x16" href="${favicon16}" />`,
  )
  tags.push(
    `<link rel="icon" type="image/png" sizes="32x32" href="${favicon32}" />`,
  )
  tags.push(
    `<link rel="icon" type="image/png" sizes="48x48" href="${favicon48}" />`,
  )
  tags.push(`<link rel="shortcut icon" href="${favicon32}" />`)

  // Apple Touch Icon - same image source, resized to 180x180 (already high density)
  const appleIcon180 = `${apiUrl}/resize?url=${encodeURIComponent(baseIcon)}&w=180&h=180&fit=contain&q=100&fmt=png`

  tags.push(`<link rel="apple-touch-icon" href="${appleIcon180}" />`)
  tags.push(
    `<link rel="apple-touch-icon" sizes="180x180" href="${appleIcon180}" />`,
  )

  return tags.join("\n  ")
}

// Health check endpoint for CI/CD
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    buildId,
    version: VERSION,
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

// Sitemap.xml route - proxy to API
app.get("/sitemap.xml", async (req, res) => {
  try {
    const apiUrl = isDev
      ? "http://localhost:3001/api"
      : process.env.INTERNAL_API_URL ||
        process.env.API_URL ||
        "https://chrry.dev/api"

    const siteConfig = getSiteConfig(req.hostname)

    // Retry logic for dev mode (API may not be ready immediately)
    let response
    let lastError
    const maxRetries = isDev ? 3 : 1

    for (let i = 0; i < maxRetries; i++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(
          () => controller.abort(),
          isDev ? 30000 : 10000,
        )

        response = await fetch(
          `${apiUrl}/sitemap.xml?chrryUrl=${encodeURIComponent(siteConfig.url)})&tribe=${siteConfig.isTribe}`,
          {
            headers: {
              "X-Forwarded-Host": req.hostname,
              "X-Forwarded-Proto": req.protocol,
              "X-Internal-Request": "flash-server",
              "User-Agent": "Chrry-Flash-Server/1.0",
            },
            signal: controller.signal,
          },
        )

        clearTimeout(timeoutId)

        if (response.ok) {
          break // Success, exit retry loop
        }

        lastError = new Error(`API returned ${response.status}`)
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))) // Exponential backoff
        }
      } catch (err) {
        lastError = err
        if (i < maxRetries - 1 && isDev) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
        }
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error("Failed to fetch sitemap")
    }

    const xml = await response.text()
    res.header("Content-Type", "application/xml")
    res.send(xml)
  } catch (error) {
    console.error("❌ Sitemap error:", error)

    // Return a minimal sitemap instead of 500 error
    const minimalSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${req.hostname}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>`

    res.header("Content-Type", "application/xml")
    res.send(minimalSitemap)
  }
})

// Favicon.ico route - redirect to app-specific icon
app.get("/favicon.ico", async (req, res) => {
  try {
    // Use getSiteConfig for white-label detection (same as metadataToHtml)
    const hostname = req.hostname || "localhost"
    const siteConfig = getSiteConfig(`https://${hostname}`)

    // Match metadataToHtml logic exactly
    const iconSlug =
      siteConfig?.storeSlug === "compass"
        ? "atlas"
        : siteConfig?.slug || "chrry"

    const baseIcon = `/images/apps/${iconSlug}.png`
    const apiUrl = process.env.VITE_API_URL || "https://chrry.dev/api"

    // Redirect to 32x32 favicon (96px at 3x density for Retina)
    const faviconUrl = `${apiUrl}/resize?url=${encodeURIComponent(baseIcon)}&w=96&h=96&fit=contain&q=100&fmt=png`

    res.redirect(faviconUrl)
  } catch (error) {
    console.error("❌ Favicon error:", error)
    // Fallback to default
    const apiUrl = process.env.VITE_API_URL || "https://chrry.dev/api"
    const fallback = `${apiUrl}/resize?url=${encodeURIComponent("/images/apps/chrry.png")}&w=96&h=96&fit=contain&q=100&fmt=png`
    res.redirect(fallback)
  }
})

// Manifest.json route - proxy to API
app.get("/manifest.json", async (req, res) => {
  try {
    // Use internal API URL to avoid Cloudflare round-trip
    const apiUrl = isDev
      ? "http://localhost:3001/api"
      : process.env.INTERNAL_API_URL ||
        process.env.API_URL ||
        "https://chrry.dev/api"

    const response = await fetch(`${apiUrl}/manifest`, {
      headers: {
        "X-Forwarded-Host": req.hostname,
        "X-Forwarded-Proto": req.protocol,
        "X-Internal-Request": "flash-server",
        "User-Agent": "Chrry-Flash-Server/1.0",
      },
    })

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }

    const json = await response.json()
    res.header("Content-Type", "application/json")
    res.json(json)
  } catch (error) {
    console.error("❌ Manifest error:", error)
    res.status(500).send("Error generating manifest")
  }
})

// Serve HTML with rate limiting (catch-all route)
app.use(async (req, res) => {
  // Whitelist subdomains and localhost
  const host = req.get("host") || ""
  const hostname = host.split(":")[0] // Remove port if present

  // SECURITY: Rate limiting via Arcjet (aj.protect)
  // Whitelisted domains (.chrry.ai, localhost) are trusted and skip rate limiting
  const isWhitelisted =
    hostname.endsWith(".chrry.ai") || // All subdomains
    hostname === "chrry.ai" || // Main domain
    hostname.startsWith("localhost") || // Local development
    hostname.startsWith("127.0.0.1") || // Local IP
    isDev || // Development mode
    isE2E // E2E testing

  // Debug logging
  if (hostname.includes("e2e") || hostname.includes("staging")) {
    console.log("🔍 Host check:", {
      host,
      hostname,
      isWhitelisted,
      isDev,
      isE2E,
      endsWithChrryAi: hostname.endsWith(".chrry.ai"),
    })
  }

  // Apply Arcjet protection (skip for whitelisted hosts)
  if (!isWhitelisted) {
    const decision = await aj.protect(req)

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return res.status(429).json({ error: "Too many requests" })
      }
      return res.status(403).json({ error: "Forbidden" })
    }
  }

  // Block common bot/scanner paths before SSR
  const pathname = req.path || req.url
  const suspiciousPaths = [
    "/phpinfo.php",
    "/.git/",
    "/config/",
    "/wp-content/",
    "/wp-admin/",
    "/.env",
    "/admin/",
    "/api/v1/",
    "/rest/",
    "/metrics",
    "/.gitlab-ci.yml",
    "/.github/",
    "/root/",
    "/etc/",
    "/_profiler/",
    "/__debug",
  ]

  if (suspiciousPaths.some((path) => pathname.includes(path))) {
    return res.status(404).send("Not Found")
  }

  try {
    const url = req.originalUrl.replace(base, "")

    // Skip SSR for static assets (CSS, JS, images, fonts, etc.)
    // Vite middleware already handles these in dev, sirv handles in production
    const assetExtensions = [
      ".js",
      ".css",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".ico",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
      ".webp",
      ".mp4",
      ".webm",
      ".json",
      ".map",
      ".txt",
      ".xml",
    ]
    const isAsset =
      assetExtensions.some((ext) => url.endsWith(ext)) ||
      url.includes("/@fs/") ||
      url.includes("/.well-known/") ||
      url.startsWith("/@vite/") ||
      url.startsWith("/node_modules/")

    if (isAsset) {
      // Asset requests shouldn't reach here (Vite/sirv should handle them)
      // If they do, return 404 to avoid SSR
      return res.status(404).end()
    }

    /** @type {string} */
    let template
    /** @type {import('./src/entry-server.ts').render} */
    let _render
    /** @type {import('./src/entry-server.ts').loadData} */
    let loadData
    if (!isProduction) {
      // Always read fresh template in development
      template = await fs.readFile("./index.html", "utf-8")
      template = await vite.transformIndexHtml(url, template)
      const entryServer = await vite.ssrLoadModule("/src/entry-server.tsx")
      _render = entryServer.render
      loadData = entryServer.loadData
    } else {
      template = templateHtml
      const entryServer = await import("./dist/server/entry-server.js")
      _render = entryServer.render
      loadData = entryServer.loadData
    }

    // Load server data first (optional - can be undefined for client-only rendering)
    let serverData
    if (loadData) {
      console.log("🔍 Loading server data for:", url)
      // You can build the context from req here
      const context = {
        url,
        hostname: req.hostname || "localhost",
        pathname: url,
        headers: req.headers,
        cookies: req.cookies || {},
        ip:
          req.ip ||
          req.headers["x-forwarded-for"] ||
          req.headers["x-real-ip"] ||
          "0.0.0.0", // Extract client IP
      }
      serverData = await loadData(context)
      console.log("✅ Server data loaded. Theme:", serverData?.theme)

      // Handle OAuth redirect
      if (serverData?.redirect) {
        if (serverData.redirect.setCookie) {
          res.setHeader("Set-Cookie", serverData.redirect.setCookie)
        }
        return res.redirect(serverData.redirect.url)
      }
    }

    // Generate metadata for SSR
    let metaTags = ""
    if (serverData?.metadata) {
      try {
        metaTags = metadataToHtml(serverData.metadata, serverData)
      } catch (error) {
        console.error("Error converting metadata to HTML:", error)
        // Continue without metadata if conversion fails
      }
    }

    // Simple SSR without streaming
    const { renderToString } = await import("react-dom/server")
    const { default: React } = await import("react")

    // Get App component
    const App = !isProduction
      ? (await vite.ssrLoadModule("/src/App.tsx")).default
      : (await import("./dist/server/entry-server.js")).App

    console.log(
      "🔧 SSR: serverData.pathname before render:",
      serverData?.pathname,
    )
    const appHtml = renderToString(React.createElement(App, { serverData }))

    // Collect CSS from Vite's module graph (dev only)
    let cssLinks = ""
    if (!isProduction && vite) {
      const modules = Array.from(vite.moduleGraph.urlToModuleMap.values())
      const cssModules = modules.filter(
        (m) => m.url?.endsWith(".css") || m.url?.endsWith(".scss"),
      )
      cssLinks = cssModules
        .map((m) => `<link rel="stylesheet" href="${m.url}">`)
        .join("\n")
    }

    // Serialize serverData for client-side hydration
    const serverDataScript = serverData
      ? `<script>window.__SERVER_DATA__ = ${JSON.stringify(serverData).replace(/</g, "\\u003c")}</script>`
      : ""

    // Inject router state for SSR hydration (pathname from server)
    const routerState = {
      pathname: serverData?.pathname || url,
      searchParams: Object.fromEntries(
        new URLSearchParams(url.split("?")[1] || ""),
      ),
      hash: url.split("#")[1] || "",
    }

    const routerStateScript = serverData
      ? `<script>window.__ROUTER_STATE__ = ${JSON.stringify(routerState).replace(/</g, "\\u003c")}</script>`
      : ""

    // Sanitize theme value to prevent HTML injection
    const ALLOWED_THEMES = ["dark", "light"]
    const rawTheme = serverData?.theme
    const sanitizedTheme = ALLOWED_THEMES.includes(rawTheme) ? rawTheme : "dark"

    // Replace placeholders - inject metadata, CSS, server data, router state, lang attribute, and theme class
    console.log("🎨 Applying theme class:", sanitizedTheme)
    const html = template
      .replace(`<html lang="en"`, `<html lang="${serverData?.locale || "en"}"`)
      .replace(`class="dark"`, `class="${sanitizedTheme}"`)
      .replace(
        `<!--app-head-->`,
        `${metaTags}\n  ${cssLinks}\n  ${serverDataScript}\n  ${routerStateScript}`,
      )
      .replace(`<!--app-html-->`, appHtml)

    console.log(`✅ HTML generated with theme: ${sanitizedTheme}`)

    res.status(200).set({ "Content-Type": "text/html" }).end(html)
  } catch (e) {
    vite?.ssrFixStacktrace(e)
    console.error(e.stack) // Log for debugging
    res
      .status(500)
      .set("Content-Type", "text/plain")
      .end("Internal Server Error")
  }
})

// Start http server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`)
})
