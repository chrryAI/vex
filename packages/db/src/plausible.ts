import dotenv from "dotenv"

dotenv.config()
/**
 * Analytics Event Constants
 * Centralized event names for tracking across the application
 */

// Removed imports to avoid circular dependencies during Vite config loading
export type siteMode =
  | "chrryDev"
  | "vex"
  | "chrryAI"
  | "chrryStore"
  | "focus"
  | "atlas"
  | "istanbul"
  | "amsterdam"
  | "tokyo"
  | "newYork"
  | "popcorn"
  | "zarathustra"
  | "search"
  | "sushi"
  | "grape"
  | "pear"
  | "vault"
  | "burn"
  | "e2eVex"
  | "staging"
  | "tribe"
  | "nebula"
  | "watermelon"

export const chrryDev = {
  mode: "chrryDev" as siteMode,
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
}

const vault = {
  url: "https://vault.chrry.ai",
  mode: "vault" as siteMode,
  slug: "vault",
  favicon: "vault",
  storeSlug: "wine",
  name: "Vault",
  isStoreApp: true,
  domain: "vault.chrry.ai",
  store: "https://vault.chrry.ai",
  email: "iliyan@chrry.ai",
  chromeWebStoreUrl:
    "https://chromewebstore.google.com/detail/vault-🍒/hhpmohjgakgnikmagpnopifahfpbkjab",
  description:
    "AI-powered financial analytics. Track expenses, budgets, insights.",
  logo: "🏦",
  primaryColor: "#059669", // Emerald green
  links: {
    github: "https://github.com/chrryAI/vex",
    docs: "https://vault.chrry.ai/docs",
  },
}

const pear = {
  url: "https://pear.chrry.ai",
  mode: "pear" as siteMode,
  slug: "pear",
  favicon: "pear",
  storeSlug: "wine",
  name: "Pear",
  isStoreApp: false,
  domain: "pear.chrry.ai",
  store: "https://wine.chrry.ai",
  chromeWebStoreUrl:
    "https://chromewebstore.google.com/detail/pear-🍒/meeppkpnlgbamihhokdakhojclfomgbg",

  email: "iliyan@chrry.ai",
  description: "AI-powered feedback system. Earn credits for quality insights.",
  logo: "🍐",
  primaryColor: "#84CC16", // Lime green
  links: {
    github: "https://github.com/chrryAI/vex",
    docs: "https://pear.chrry.ai/docs",
  },
}

const chrryAI = {
  slug: "chrry",
  favicon: "chrry",
  isStoreApp: true,
  storeSlug: "blossom",
  mode: "chrryAI" as siteMode,
  name: "Chrry",
  domain: "chrry.ai",
  email: "iliyan@chrry.ai",
  chromeWebStoreUrl:
    "https://chromewebstore.google.com/detail/chrry-🍒/odgdgbbddopmblglebfngmaebmnhegfc",
  url: "https://chrry.ai",
  store: "https://chrry.ai",
  description:
    "AI Super App - Discover, create, and manage your AI-powered life",
  logo: "🍒",
  primaryColor: "#E91E63", // Cherry pink
  links: {
    github: "https://github.com/chrryAI/vex",
    docs: "https://chrry.ai/docs",
    // store: "https://chrry.store",
  },
}

const focus = {
  favicon: "focus",
  isStoreApp: false,
  mode: "focus" as siteMode,
  slug: "focus",
  version: "26.11.55",
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
}

const atlas = {
  favicon: "atlas",
  mode: "atlas" as siteMode,
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
}

const istanbul = {
  favicon: "atlas",
  isStoreApp: false,
  mode: "istanbul" as siteMode,
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
  mode: "amsterdam" as siteMode,
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
  mode: "tokyo" as siteMode,
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
  mode: "newYork" as siteMode,
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
  mode: "popcorn" as siteMode,
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
  mode: "zarathustra" as siteMode,
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
  mode: "search" as siteMode,
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
  mode: "nebula" as siteMode,
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
  mode: "vex" as siteMode,
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
  mode: "burn" as siteMode,
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
const e2eVex = {
  ...vex,
  url: "https://e2e.chrry.ai",
  domain: "e2e.chrry.ai",
  // store: "https://e2e.chrry.ai",
}

export const tribe = {
  ...zarathustra,
  mode: "tribe" as siteMode,
  // slug: "tribe",
  favicon: "tribe",
  name: "Tribe",
  url: "https://tribe.chrry.ai",
  chromeWebStoreUrl:
    "https://chromewebstore.google.com/detail/tribe-🍒/iejopahgfjnjefodogcpoaibiglbkmoj?authuser=0&hl=en",
  domain: "tribe.chrry.ai",
  description:
    "Your AI-powered social feed. Discover posts, share feedback, and connect with your community.",
  isTribe: true,
}

export const watermelon = {
  ...chrryAI,
  mode: "watermelon" as siteMode,
  // slug: "tribe",
  favicon: "watermelon",
  name: "Watermelon",
  url: "https://watermelon.chrry.ai",
  domain: "watermelon.chrry.ai",
  description:
    "Your AI-powered social feed. Discover posts, share feedback, and connect with your community.",
  isWatermelon: true,
}

const staging = {
  ...chrryAI,
  url: "https://staging.chrry.ai",
  domain: "staging.chrry.ai",
}

const sushi = {
  url: "https://sushi.chrry.ai",
  mode: "sushi" as siteMode,
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
  mode: "grape" as siteMode,
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

export interface SiteConfig {
  mode: siteMode
  slug: string
  chromeWebStoreUrl?: string
  storeSlug: string
  favicon?: string
  name: string
  domain: string
  store: string
  url: string
  isTribe?: boolean
  isWatermelon?: boolean
  description: string
  version?: string
  email: string
  logo: string
  primaryColor: string
}

export const extensions = [
  "https://focus.chrry.ai",
  "https://chrry.dev",
  "https://vex.chrry.ai",
  "https://chrry.ai",
  "https://popcorn.chrry.ai",
]

type siteTranslation = {
  title: string
  description: string
}

type siteTranslationCatalog = Record<string, siteTranslation> & {
  en: siteTranslation
}

const matchesDomain = (host: string, domain: string): boolean => {
  return host === domain || host.endsWith(`.${domain}`)
}

export function isTauri(): boolean {
  if (typeof window === "undefined") return false

  // Check for Tauri API presence
  return (
    "__TAURI__" in window ||
    "__TAURI_INTERNALS__" in window ||
    "TAURI_EVENT_PLUGIN_INTERNALS" in window
  )
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
  grape,
]

export const analyticsDomains = whiteLabels
  .concat(e2eVex)
  .concat(tribe)
  .concat(watermelon)

export const ANALYTICS_EVENTS = {
  // App Management
  APP_VIEWED: "app",
  APP_SAVE_SUCCESS: "app_save_success",
  APP_SAVE_ERROR: "app_save_error",
  APP_DELETE_SUCCESS: "app_delete_success",
  APP_STATUS: "app_status",
  QUOTA_INFO: "quota-info",
  LINK_CLICK: "link_click",
  IS_ATTACHING: "is-attaching",
  CHERRY_DEV_CLICK: "cherry_dev_click",
  VOICE_CONVERSATION: "voice_conversation",
  BLUE_SKY_CLICK: "blue_sky_click",
  VOICE_INPUT: "voice-input",
  BUY_ME_A_COFFEE_CLICK: "buy_me_a_coffee_click",
  WM_APP_LINK_CLICK: "wm_app_link_click",
  WM_BYOK_SUBMIT: "wm_byok_submit",
  WM_BYOK_CLICK: "wm_byok_click",
  WM_BYOK_SUBMIT_SUCCESS: "wm_byok_submit_success",
  WM_BYOK_SUBMIT_ERROR: "wm_byok_submit_error",
  WM_TRIBE_LINK_CLICK: "wm_tribe_link_click",
  FILE_INPUT: "file-input",
  GAME_TOGGLE: "game-toggle",
  HIT_HOURLY_LIMIT: "hit-hourly-limit",
  FILE_UPLOAD: "file-upload",
  APP_LINK_CLICK: "app_link_click",
  SUGGESTIONS_GENERATED: "suggestions_generated",
  COLLABORATION: "collaboration",
  WANNATHIS: "wannathis",
  MESSAGE_COLLABORATION: "message_collaboration",
  WATERMELON: "watermelon",
  LIKE: "like",
  VIDEO_CLICKED: "video_clicked",
  THREAD_LIKES: "thread_likes",
  GRAPE_MODAL_CLOSE: "grape_modal_close",
  GRAPE_APP_SELECT: "grape_app_select",
  GRAPE_PEAR_FEEDBACK: "grape_pear_feedback",
  GRAPE_ICON_CLICK: "grape_icon_click",
  GRAPE_MODAL_OPEN: "grape_modal_open",
  LANGUAGE_SWITCHER: "language_switcher",
  MENU_TOGGLE: "menu-toggle",
  HOME_CLICK: "home-click",
  NEW_CHAT_CLICK: "new-chat-click",
  PRIVATE_CHAT_CLICK: "private-chat-click",
  THREAD_CLICK_MENU: "thread-click-menu",
  LOAD_MORE_THREADS_MENU: "load-more-threads-menu",
  STORE_VIEW: "store_view",
  BOOKMARK: "bookmark",
  STORE_APP_SELECTED: "store_app_selected",
  SPATIAL_NAVIGATION: "spatial_navigation",
  MAXIMIZE_DURATION: "maximize_duration",
  MINIMIZE_DURATION: "minimize_duration",
  MAXIMIZE: "maximize",
  MINIMIZE: "minimize",
  APP_BACK: "app_back",
  CHARACTER_TAG_CREATED: "character_tag_created",

  // Chat & Messaging
  CHAT_SEND: "chat",
  CHAT_STOP: "chat_stop",
  CHAT_REGENERATE: "chat_regenerate",
  CHAT_EDIT: "chat_edit",
  CHAT_DELETE: "chat_delete",

  // Threads
  THREAD_CREATE: "thread",
  THREAD_VIEW: "thread_view",
  THREAD_DELETE: "thread_delete",
  THREAD_SHARE: "thread_share",
  TIMER_START: "timer_start",

  // Memory
  MEMORY_SAVE: "memory",
  MEMORY_DELETE: "memory_delete",
  MEMORY_TOGGLE: "memory_toggle",

  // Feedback (Pear)
  FEEDBACK_SUBMIT: "feedback",
  FEEDBACK_LIKE: "feedback_like",
  FEEDBACK_DISLIKE: "feedback_dislike",
  AGENT_SELECTED: "agent-selected",
  SUBSCRIBE_FROM_CHAT_CLICK: "subscribe-from-chat-click",

  TASK_ADD: "task_add",
  // Subscription
  SUBSCRIBE_CHECKOUT: "subscribe_checkout",
  SUBSCRIBE_VERIFY_PAYMENT: "subscribe_verify_payment",
  SUBSCRIBE_PAYMENT_VERIFIED: "subscribe_payment_verified",
  SUBSCRIBE_PAYMENT_VERIFICATION_FAILED:
    "subscribe_payment_verification_failed",
  SUBSCRIPTION_CHANGE: "subscription",
  SUBSCRIBE_TIER_VIEW: "subscribe_tier_view",
  APP: "app",
  AD_VISIT: "ad_visit",
  TIMER_PRESET: "timer_preset",
  BURN: "burn",
  TIMER_CANCEL: "timer_cancel",
  TIMER_PAUSE: "timer_pause",
  TIMER_RESUME: "timer_resume",
  GH_REPO_CLICK: "gh_repo_click",
  PEAR: "pear",
  THEME_CHANGE: "theme_change",
  COLOR_SCHEME_CHANGE: "color_scheme_change",

  // Authentication
  LOGIN: "login",
  LOGOUT: "logout",
  SIGNUP: "signup",
  PLAY_BIRD_SOUND: "play_bird_sound",
  GOOGLE_SIGNIN: "google_signin",
  APPLE_SIGNIN: "apple_signin",
  GITHUB_SIGNIN: "github_signin",

  // Store & Discovery
  STORE_INSTALL: "store_install",
  GRAPE_OPEN: "grape_open",
  GRAPE_CLOSE: "grape_close",
  GRAPE_APP_VIEW: "grape_app_view",

  // Settings
  LANGUAGE_CHANGE: "language_change",
  PERFORMANCE: "performance",
  PRIVACY_TOGGLE: "privacy_toggle",

  // Navigation
  TERMS_VIEW: "terms_view",
  PRIVACY_VIEW: "privacy_view",
  ABOUT_VIEW: "about_view",
  WHY_VIEW: "why_view",
  THREAD_MESSAGE_AGENT: "thread-message-agent",
  DEBATE_AGENT_SELECTED: "debate_agent_selected",
  AGENT_MODAL: "agent-modal",
  DEBATE_AGENT_MODAL: "debate-agent-modal",
} as const

// Type for event names
export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

// Events that should be sent to API for AI context (not just Plausible)
// These are high-value user actions that help AI understand user behavior
export const MEANINGFUL_EVENTS: AnalyticsEventName[] = [
  // App lifecycle - AI needs to know what apps user is working on
  ANALYTICS_EVENTS.APP,
  ANALYTICS_EVENTS.LINK_CLICK,
  ANALYTICS_EVENTS.GH_REPO_CLICK,
  ANALYTICS_EVENTS.WM_TRIBE_LINK_CLICK,
  ANALYTICS_EVENTS.WM_APP_LINK_CLICK,
  ANALYTICS_EVENTS.WM_BYOK_CLICK,
  ANALYTICS_EVENTS.WM_BYOK_SUBMIT,
  ANALYTICS_EVENTS.WM_BYOK_SUBMIT_SUCCESS,
  ANALYTICS_EVENTS.WM_BYOK_SUBMIT_ERROR,
  ANALYTICS_EVENTS.APP_SAVE_SUCCESS,
  ANALYTICS_EVENTS.VIDEO_CLICKED,
  ANALYTICS_EVENTS.THREAD_LIKES,
  ANALYTICS_EVENTS.APP_SAVE_ERROR,
  ANALYTICS_EVENTS.APP_DELETE_SUCCESS,
  ANALYTICS_EVENTS.CHERRY_DEV_CLICK,
  ANALYTICS_EVENTS.APP_STATUS,
  ANALYTICS_EVENTS.SPATIAL_NAVIGATION,
  ANALYTICS_EVENTS.TASK_ADD,
  ANALYTICS_EVENTS.BUY_ME_A_COFFEE_CLICK,
  ANALYTICS_EVENTS.SUBSCRIBE_FROM_CHAT_CLICK,
  ANALYTICS_EVENTS.SUBSCRIBE_TIER_VIEW,
  ANALYTICS_EVENTS.BOOKMARK,
  ANALYTICS_EVENTS.LIKE,
  ANALYTICS_EVENTS.TIMER_PRESET,
  ANALYTICS_EVENTS.TIMER_START,
  ANALYTICS_EVENTS.TIMER_CANCEL,
  ANALYTICS_EVENTS.TIMER_PAUSE,
  ANALYTICS_EVENTS.TIMER_RESUME,
  ANALYTICS_EVENTS.PLAY_BIRD_SOUND,
  ANALYTICS_EVENTS.SUGGESTIONS_GENERATED,
  ANALYTICS_EVENTS.MESSAGE_COLLABORATION,
  ANALYTICS_EVENTS.APP_LINK_CLICK,
  ANALYTICS_EVENTS.WATERMELON,
  ANALYTICS_EVENTS.BLUE_SKY_CLICK,
  // Chat & messaging - Core user interactions
  ANALYTICS_EVENTS.CHAT_SEND,
  ANALYTICS_EVENTS.AGENT_SELECTED,
  ANALYTICS_EVENTS.DEBATE_AGENT_SELECTED,
  ANALYTICS_EVENTS.VOICE_CONVERSATION,
  ANALYTICS_EVENTS.WM_APP_LINK_CLICK,

  // Threads - Important for context continuity
  ANALYTICS_EVENTS.THREAD_CREATE,
  ANALYTICS_EVENTS.THREAD_VIEW,
  ANALYTICS_EVENTS.THREAD_DELETE,
  ANALYTICS_EVENTS.CHARACTER_TAG_CREATED,
  ANALYTICS_EVENTS.COLLABORATION,

  // Memory - Critical for personalization
  ANALYTICS_EVENTS.MEMORY_SAVE,
  ANALYTICS_EVENTS.MEMORY_DELETE,
  ANALYTICS_EVENTS.BURN, // User wants to forget

  // Feedback (Pear) - Quality signals
  ANALYTICS_EVENTS.FEEDBACK_SUBMIT,
  ANALYTICS_EVENTS.PEAR, // Pear mode activated
  ANALYTICS_EVENTS.GRAPE_PEAR_FEEDBACK,

  // Subscription - Monetization signals
  ANALYTICS_EVENTS.SUBSCRIBE_CHECKOUT,
  ANALYTICS_EVENTS.SUBSCRIBE_PAYMENT_VERIFIED,
  ANALYTICS_EVENTS.SUBSCRIPTION_CHANGE,

  // Authentication - User lifecycle
  ANALYTICS_EVENTS.LOGIN,
  ANALYTICS_EVENTS.LOGOUT,
  ANALYTICS_EVENTS.WANNATHIS,
  ANALYTICS_EVENTS.SIGNUP,
  ANALYTICS_EVENTS.GOOGLE_SIGNIN,
  ANALYTICS_EVENTS.APPLE_SIGNIN,
  ANALYTICS_EVENTS.GITHUB_SIGNIN,

  ANALYTICS_EVENTS.APP_BACK,
  ANALYTICS_EVENTS.MAXIMIZE_DURATION,
  ANALYTICS_EVENTS.MINIMIZE_DURATION,
  ANALYTICS_EVENTS.MAXIMIZE,
  ANALYTICS_EVENTS.MINIMIZE,

  // Store & Discovery - Feature adoption
  ANALYTICS_EVENTS.STORE_VIEW,
  ANALYTICS_EVENTS.STORE_APP_SELECTED,
  ANALYTICS_EVENTS.STORE_INSTALL,
  ANALYTICS_EVENTS.GRAPE_APP_SELECT,

  // Settings - Preference changes
  ANALYTICS_EVENTS.LANGUAGE_SWITCHER,
  ANALYTICS_EVENTS.THEME_CHANGE,

  // Ads - Attribution
  ANALYTICS_EVENTS.AD_VISIT,

  // Limits - User friction points
  ANALYTICS_EVENTS.HIT_HOURLY_LIMIT,
]

const PLAUSIBLE_HOST = process.env.PLAUSIBLE_HOST?.trim()
const PLAUSIBLE_API_KEY = process.env.PLAUSIBLE_API_KEY?.trim()
console.log(`🚀 ~ PLAUSIBLE_HOST:`, PLAUSIBLE_HOST)
console.log(
  `🚀 ~ PLAUSIBLE_API_KEY:`,
  PLAUSIBLE_API_KEY ? `${PLAUSIBLE_API_KEY.slice(0, 10)}...` : "undefined",
)

// All events for Plausible goal tracking (auto-sync to Plausible)
// This list is used to automatically configure Plausible goals
export const ALL_TRACKABLE_EVENTS = Object.values(ANALYTICS_EVENTS)

export async function syncAllGoals() {
  if (!PLAUSIBLE_HOST || !PLAUSIBLE_API_KEY) {
    throw new Error("Missing Plausible environment variables")
  }

  // Diagnostic step: Check which sites this key can access
  console.log("🔍 Verifying API key access...")
  try {
    const sitesRes = await fetch(`${PLAUSIBLE_HOST}/api/v1/sites`, {
      headers: {
        Authorization: `Bearer ${PLAUSIBLE_API_KEY}`,
        Accept: "application/json",
        "User-Agent": "Chrry-Goal-Sync/1.0",
      },
    })
    console.log(`   📡 Sites status: ${sitesRes.status}`)
    if (sitesRes.ok) {
      const sitesData = await sitesRes.json()
      const availableDomains = sitesData.map((s: any) => s.domain)
      console.log(
        `✅ Key is valid. Accessible domains: ${availableDomains.join(", ")}`,
      )
    } else {
      const err = await sitesRes.text()
      try {
        const jsonErr = JSON.parse(err)
        console.error(
          `❌ Key verification failed (sites endpoint): ${sitesRes.status} -`,
          jsonErr,
        )
      } catch {
        console.error(
          `❌ Key verification failed (sites endpoint): ${sitesRes.status} - ${err.slice(0, 500)}`,
        )
      }
    }
  } catch (e: any) {
    console.error("❌ Error during key verification:", e.message)
  }

  console.log(
    `🚀 Starting Plausible goal sync for ${analyticsDomains.length} domains...`,
  )
  console.log(`📊 Trackable events: ${ALL_TRACKABLE_EVENTS.length}`)

  for (const site of analyticsDomains) {
    const domain = site.domain
    console.log(`\n🎯 Syncing goals for "${domain}"...`)

    try {
      // 1. Fetch current goals
      const goalsUrl = new URL(`${PLAUSIBLE_HOST}/api/v1/sites/goals`)
      goalsUrl.searchParams.append("site_id", domain)

      console.log(`   🔗 Fetching: ${goalsUrl.toString()}`)

      const res = await fetch(goalsUrl.toString(), {
        headers: {
          Authorization: `Bearer ${PLAUSIBLE_API_KEY}`,
          "Content-Type": "application/json", // bunu ekle
          Accept: "application/json",
          "User-Agent": "Chrry-Goal-Sync/1.0",
        },
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error(
          `   ❌ Failed to fetch goals for ${domain}: ${res.status} - ${errText.slice(0, 200)}`,
        )
        continue
      }

      const { goals: currentGoals } = await res.json()
      const existingGoalNames = new Set(
        currentGoals.map((g: any) => g.event_name),
      )

      // 2. Identify missing goals
      const missingGoals = ALL_TRACKABLE_EVENTS.filter(
        (event) => !existingGoalNames.has(event),
      )

      if (missingGoals.length === 0) {
        console.log(
          `   ✅ All ${ALL_TRACKABLE_EVENTS.length} goals already exist.`,
        )
        continue
      }

      console.log(`   ➕ Creating ${missingGoals.length} missing goals...`)

      // 3. Create missing goals
      for (const eventName of missingGoals) {
        const createUrl = `${PLAUSIBLE_HOST}/api/v1/sites/goals`
        const createRes = await fetch(createUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PLAUSIBLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            site_id: domain,
            goal_type: "event",
            event_name: eventName,
          }),
        })

        if (createRes.ok) {
          console.log(`      + Created: ${eventName}`)
        } else {
          const err = await createRes.text()
          console.error(`      - Failed: ${eventName} (${err})`)
        }
      }
    } catch (error) {
      console.error(`   ❌ Error syncing ${domain}:`, error)
    }
  }

  console.log("\n✅ Plausible goal synchronization complete!")
}
