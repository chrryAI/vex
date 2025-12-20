import { v4 as uuidv4, validate } from "uuid"
import {
  VERSION,
  getThreadId,
  pageSizes,
  isE2E,
  getEnv,
} from "@chrryai/chrry/utils"
import {
  getApp,
  getSession,
  getThread,
  getThreads,
  getTranslations,
} from "@chrryai/chrry/lib"
import { locale, locales } from "@chrryai/chrry/locales"
import {
  session,
  thread,
  paginatedMessages,
  appWithStore,
} from "@chrryai/chrry/types"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import {
  getBlogPosts,
  getBlogPost,
  type BlogPost,
  type BlogPostWithContent,
} from "./blog-loader"
import { generateServerMetadata } from "./server-metadata"
import { themeType } from "chrry/context/ThemeContext"

export interface ServerRequest {
  url: string
  hostname: string
  pathname: string
  headers: Record<string, string | undefined>
  cookies: Record<string, string | undefined>
  ip?: string // Client IP address from x-forwarded-for or req.ip
}

export interface ServerData {
  session?: session
  thread?: { thread: thread; messages: paginatedMessages }
  threads?: {
    threads: thread[]
    totalCount: number
  }
  translations?: Record<string, any>
  app?: appWithStore
  siteConfig: ReturnType<typeof getSiteConfig>
  locale: locale
  deviceId: string
  fingerprint: string
  viewPortWidth: string
  viewPortHeight: string
  chrryUrl: string
  isDev: boolean
  apiError?: Error
  theme: "light" | "dark"
  pathname: string // SSR pathname for thread ID extraction
  metadata?: {
    title?: string
    description?: string
    keywords?: string[]
    openGraph?: any
    twitter?: any
    robots?: any
    alternates?: any
  }
  // Blog data
  blogPosts?: BlogPost[]
  blogPost?: BlogPostWithContent
  isBlogRoute?: boolean
}

/**
 * Load all server-side data for SSR
 * This replaces Next.js server components data fetching
 */
export async function loadServerData(
  request: ServerRequest,
): Promise<ServerData> {
  const { hostname, headers, cookies, url } = request

  const isDev = process.env.MODE === "development"

  const API_URL = getEnv().VITE_API_URL

  // Fetch test configuration from API (runtime, not build-time) - only in E2E mode
  let TEST_MEMBER_FINGERPRINTS: string[] = []
  let TEST_GUEST_FINGERPRINTS: string[] = []
  let TEST_MEMBER_EMAILS: string[] = []

  const pathname = request.pathname.startsWith("/")
    ? request.pathname
    : `/${request.pathname}`

  const isLocalePathname =
    pathname &&
    (locales.includes(pathname.split("/")?.[1] as locale) || pathname === "/")

  const localeCookie = cookies.locale as locale

  // Parse Accept-Language header to get browser's preferred language
  const acceptLanguage = headers["accept-language"]
  let browserLocale: locale = "en"

  if (acceptLanguage) {
    // Parse Accept-Language header (e.g., "en-US,en;q=0.9,tr;q=0.8")
    const languages = acceptLanguage
      .split(",")
      .map((lang) => {
        const [code] = lang.trim().split(";")
        // Extract base language code (e.g., "en" from "en-US")
        return code.split("-")[0].toLowerCase()
      })
      .filter((code) => locales.includes(code as locale))

    if (languages.length > 0) {
      browserLocale = languages[0] as locale
    }
  }

  // Priority: URL locale → Cookie → Browser language → Default (en)
  const locale = (
    isLocalePathname
      ? pathname.split("/")?.[1] || browserLocale
      : localeCookie || browserLocale
  ) as locale

  const threadId = getThreadId(pathname)
  const urlObj = new URL(url, `http://${hostname}`)

  // Parse query string for fp parameter (only if URL contains query params)
  let fpFromQuery: string | undefined = undefined
  if (url.includes("?")) {
    fpFromQuery = urlObj.searchParams.get("fp") || undefined
  }

  const deviceId = cookies.deviceId || headers["x-device-id"] || uuidv4()

  if (isE2E && fpFromQuery) {
    try {
      const testConfigUrl = `${API_URL}/test-config?fp=${fpFromQuery}`
      const testConfigResponse = await fetch(testConfigUrl)
      if (testConfigResponse.ok) {
        const testConfig = await testConfigResponse.json()
        TEST_MEMBER_FINGERPRINTS = testConfig.TEST_MEMBER_FINGERPRINTS || []
        TEST_GUEST_FINGERPRINTS = testConfig.TEST_GUEST_FINGERPRINTS || []
        TEST_MEMBER_EMAILS = testConfig.TEST_MEMBER_EMAILS || []
      }
    } catch (error) {
      console.error("Failed to fetch test config:", error)
    }
  }

  const isTestFP = TEST_MEMBER_FINGERPRINTS?.concat(
    TEST_GUEST_FINGERPRINTS,
  ).includes(fpFromQuery || "")

  const apiKey =
    authToken || fpFromQuery || cookies.token || headers["x-token"] || uuidv4()

  const fingerprint = isTestFP
    ? fpFromQuery
    : validate(apiKey)
      ? apiKey
      : headers["x-fp"] || cookies.fingerprint || uuidv4()

  const gift = urlObj.searchParams.get("gift")
  const agentName = cookies.agentName
  const routeType = headers["x-route-type"]
  const viewPortWidth = cookies.viewPortWidth || ""
  const viewPortHeight = cookies.viewPortHeight || ""

  // Extract client IP from request (for Arcjet fingerprinting)
  const clientIp =
    request.ip ||
    headers["x-forwarded-for"] ||
    headers["x-real-ip"] ||
    "0.0.0.0"

  // Handle OAuth callback token
  const authToken = urlObj.searchParams.get("auth_token")

  // For now, use a placeholder - you'd need to implement getChrryUrl for Vite
  const chrryUrl = getSiteConfig(hostname).url

  const siteConfig = getSiteConfig(hostname)

  let thread: { thread: thread; messages: paginatedMessages } | undefined
  let session: session | undefined
  let translations: Record<string, any> | undefined
  let app: appWithStore | undefined
  let apiError: Error | undefined

  // Fetch thread if threadId exists
  if (threadId) {
    try {
      thread = await getThread({
        id: threadId,
        pageSize: pageSizes.threads,
        token: apiKey,
      })
    } catch (error) {
      console.error("Error fetching thread:", error)
    }
  }

  const appId = thread?.thread?.appId || headers["x-app-id"]

  try {
    const [sessionResult, translationsResult, appResult] = await Promise.all([
      getSession({
        appId,
        deviceId,
        fingerprint,
        token: apiKey,
        agentName,
        pathname,
        routeType,
        translate: true,
        locale,
        chrryUrl,
        screenWidth: Number(viewPortWidth),
        screenHeight: Number(viewPortHeight),
        gift: gift || undefined,
        source: "layout",
        // API_URL,
        ip: clientIp, // Pass client IP for Arcjet
      }),

      getTranslations({
        token: apiKey,
        locale,
        // API_URL,
      }),

      getApp({
        chrryUrl,
        appId,
        token: apiKey,
        pathname,
        // API_URL,
      }),
    ])

    session = sessionResult
    translations = translationsResult

    const accountApp = session?.userBaseApp || session?.guestBaseApp
    app = appResult.id === accountApp?.id ? accountApp : appResult

    if (session && app) {
      session.app = app
    }
  } catch (error) {
    console.error("❌ API Error:", error)
    apiError = error as Error
  }

  let threads:
    | {
        threads: thread[]
        totalCount: number
      }
    | undefined

  try {
    threads = await getThreads({
      appId: (session as session)?.app?.id,
      pageSize: pageSizes.menuThreads,
      sort: "bookmark",
      token: apiKey,
      API_URL,
    })
  } catch (error) {
    // captureException(error)
    console.error("❌ API Error:", error)
  }

  // Fetch threads
  try {
    threads = await getThreads({
      appId: app?.id,
      pageSize: pageSizes.menuThreads,
      sort: "bookmark",
      token: apiKey,
      API_URL,
    })
  } catch (error) {
    console.error("Error fetching threads:", error)
  }

  const theme = app?.backgroundColor === "#ffffff" ? "light" : "dark"

  // Detect blog routes and load blog data
  let blogPosts: BlogPost[] | undefined
  let blogPost: BlogPostWithContent | undefined
  let isBlogRoute = false

  // Check if this is a blog route
  if (pathname === "/blog" || pathname.startsWith("/blog/")) {
    isBlogRoute = true

    if (pathname === "/blog") {
      // Blog list page
      blogPosts = getBlogPosts()
    } else {
      // Individual blog post page
      const slug = pathname.replace("/blog/", "")
      blogPost = getBlogPost(slug) || undefined
    }
  }

  const result = {
    session,
    thread,
    threads,
    translations,
    app,
    siteConfig,
    locale,
    deviceId,
    fingerprint: session?.fingerprint!,
    viewPortWidth,
    viewPortHeight,
    chrryUrl,
    isDev,
    apiError,
    theme: theme as themeType,
    blogPosts,
    blogPost,
    isBlogRoute,
    pathname, // Add pathname so client knows the SSR route
  }

  // Generate metadata for this route
  let metadata
  try {
    metadata = await generateServerMetadata(pathname, hostname, locale, result)
  } catch (error) {
    console.error("Error generating metadata in server-loader:", error)
  }

  return {
    ...result,
    fingerprint: session?.fingerprint!,
    metadata,
  }
}
