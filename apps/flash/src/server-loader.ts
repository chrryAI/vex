import {
  getApp,
  getSession,
  getThread,
  getThreads,
  getTranslations,
  getTribePost,
  getTribePosts,
  getTribes,
} from "@chrryai/chrry/lib"
import { type locale, locales } from "@chrryai/chrry/locales"
import type {
  appWithStore,
  paginatedMessages,
  paginatedTribePosts,
  paginatedTribes,
  session,
  thread,
  tribe,
  tribePostWithDetails,
} from "@chrryai/chrry/types"
import {
  API_INTERNAL_URL,
  getPostId,
  getThreadId,
  isE2E,
  pageSizes,
} from "@chrryai/chrry/utils"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import { excludedSlugRoutes } from "@chrryai/chrry/utils/url"
import type { themeType } from "chrry/context/ThemeContext"
import { v4 as uuidv4, validate } from "uuid"
import {
  type BlogPost,
  type BlogPostWithContent,
  getBlogPost,
  getBlogPosts,
} from "./blog-loader"
import { captureException } from "./captureException"
import { generateServerMetadata } from "./server-metadata"

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
  showAllTribe?: boolean
  accountApp?: appWithStore
  showTribe: boolean
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
  // Tribe data
  tribes?: paginatedTribes
  tribePosts?: paginatedTribePosts
  tribePost?: tribePostWithDetails
  tribe?: tribe
  searchParams?: Record<string, string> & {
    get: (key: string) => string | null
    has: (key: string) => boolean
    toString: () => string
  } // URL search params with URLSearchParams-compatible API
  // Agent profile data
}

/**
 * Load all server-side data for SSR
 * This replaces Next.js server components data fetching
 */
export async function loadServerData(
  request: ServerRequest,
): Promise<ServerData> {
  const { hostname, headers, cookies, url } = request

  const isDev = process.env.NODE_ENV !== "production"

  const API_URL = API_INTERNAL_URL

  // Fetch test configuration from API (runtime, not build-time) - only in E2E mode
  let TEST_FINGERPRINTS: string[] = []

  const pathname = (
    (request.pathname.startsWith("/")
      ? request.pathname
      : `/${request.pathname}`) || "/"
  ).split("?")?.[0]

  // OPTIMIZATION: Start fetching blog data early to parallelize with session/app data fetching
  // This allows file system reads to happen concurrently with API calls
  const isBlogList = pathname === "/blog"
  const isBlogPost = pathname.startsWith("/blog/") && pathname !== "/blog"

  const blogDataPromise = isBlogList
    ? getBlogPosts()
    : isBlogPost
      ? getBlogPost(pathname.replace("/blog/", ""))
      : Promise.resolve(null)

  const isLocalePathname =
    pathname && locales.includes(pathname.split("/")?.[1] as locale)

  const localeCookie = cookies.locale as locale

  const showTribe = cookies.showTribe === "true"
  const themeCookie = cookies.theme as themeType

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
  let fpFromQuery: string | undefined
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
        TEST_FINGERPRINTS = testConfig.TEST_FINGERPRINTS || []
      }
    } catch (error) {
      console.error("Failed to fetch test config:", error)
    }
  }

  const isTestFP = TEST_FINGERPRINTS.includes(fpFromQuery || "")

  // Handle OAuth callback - exchange auth_code for token (more secure than token in URL)
  const authCode = urlObj.searchParams.get("auth_token")

  const cookieToken = cookies.token

  let authToken: string | null = cookieToken || null

  if (authCode) {
    try {
      // Exchange one-time code for JWT token
      const exchangeResponse = await fetch(`${API_URL}/auth/exchange-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: authCode }),
      })

      if (exchangeResponse.ok) {
        const { token } = await exchangeResponse.json()
        authToken = token
        console.log("✅ Auth code exchanged for token")
      } else {
        console.error("❌ Auth code exchange failed")
      }
    } catch (error) {
      authToken = null
      console.error("❌ Auth code exchange error:", error)
    }
  }

  const apiKeyCandidate = authToken
    ? authToken
    : cookieToken && !validate(cookieToken) // member token
      ? cookieToken
      : isTestFP
        ? fpFromQuery
        : cookieToken ||
          headers["x-token"] ||
          cookies.fingerprint ||
          headers["x-fp"]

  const tokenCandidate = authToken || apiKeyCandidate

  const fingerprintCandidate =
    fpFromQuery && isTestFP
      ? fpFromQuery
      : validate(tokenCandidate)
        ? tokenCandidate
        : cookies.fingerprint || headers["x-fp"]

  let apiKey =
    tokenCandidate ||
    (isTestFP && fpFromQuery ? fpFromQuery : fingerprintCandidate) ||
    uuidv4()

  const fingerprint = fingerprintCandidate || uuidv4()

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

  let threads:
    | {
        threads: thread[]
        totalCount: number
      }
    | undefined

  // Handle OAuth callback token

  // For now, use a placeholder - you'd need to implement getChrryUrl for Vite
  const chrryUrl = getSiteConfig(hostname).url
  const tribeSlug = pathname?.startsWith("/t/")
    ? pathname.replace("/t/", "").split("?")[0]
    : undefined

  const siteConfig = getSiteConfig(hostname)

  let thread: { thread: thread; messages: paginatedMessages } | undefined
  let session: session | undefined
  let translations: Record<string, any> | undefined
  let app: appWithStore | undefined
  let accountApp: appWithStore | undefined
  let apiError: Error | undefined

  // Fetch thread if threadId exists
  let threadResult: { thread: thread; messages: paginatedMessages } | undefined
  let appId: string | undefined
  let isBlogRoute = false

  // Blog data
  let blogPosts: BlogPost[] | undefined
  let blogPost: BlogPostWithContent | undefined

  // Tribe data
  let tribes: paginatedTribes | undefined
  let tribePosts: paginatedTribePosts | undefined
  let tribePost: tribePostWithDetails | undefined
  let tribe: tribe | undefined

  const searchParamsRecord: Record<string, string> = {}
  urlObj.searchParams.forEach((value, key) => {
    searchParamsRecord[key] = value
  })
  const searchParams = {
    ...searchParamsRecord,
    get: (key: string) => searchParamsRecord[key] ?? null,
    has: (key: string) => key in searchParamsRecord,
    toString: () => new URLSearchParams(searchParamsRecord).toString(),
  } as Record<string, string> & {
    get: (key: string) => string | null
    has: (key: string) => boolean
    toString: () => string
  }

  const showAllTribe =
    pathname === "/tribe" || (siteConfig.isTribe && pathname === "/")
  try {
    const sessionResult = await getSession({
      // appId: appResult.id,
      deviceId,
      fingerprint,
      token: apiKey,
      agentName,
      pathname,
      routeType,
      locale,
      chrryUrl,
      screenWidth: Number(viewPortWidth),
      screenHeight: Number(viewPortHeight),
      gift: gift || undefined,
      source: "layout",
      API_URL,
      ip: clientIp, // Pass client IP for Arcjet
    })

    // Check if this is a blog route
    if (pathname === "/blog" || pathname.startsWith("/blog/")) {
      isBlogRoute = true

      // Reuse the early-fetched blog data promise
      try {
        const blogData = await blogDataPromise

        if (isBlogList) {
          // Blog list page
          blogPosts = blogData as BlogPost[] | undefined
        } else if (isBlogPost) {
          // Individual blog post page
          blogPost = (blogData as BlogPostWithContent | null) || undefined
        }
      } catch (error) {
        console.error("❌ Blog data fetch failed:", error)
        // Fallback to null on error
        blogPosts = undefined
        blogPost = undefined
      }
    }

    const MAX_UNTIL = 10
    const until = searchParams.get("until")
      ? Math.min(Number(searchParams.get("until")), MAX_UNTIL)
      : 1

    apiKey =
      sessionResult?.user?.token || sessionResult?.guest?.fingerprint || apiKey

    threadResult = threadId
      ? await getThread({
          id: threadId,
          pageSize: pageSizes.posts * until,
          token: apiKey,
          API_URL,
        })
      : undefined

    const postId = getPostId(pathname)

    let tribePostResult: tribePostWithDetails | undefined
    if (postId) {
      try {
        tribePostResult = await getTribePost({
          id: postId,
          token: apiKey,
          API_URL,
        })
      } catch (error) {
        console.error("❌ Tribe post fetch failed:", error)
        tribePostResult = undefined
      }
    }

    appId =
      tribePostResult?.appId ||
      threadResult?.thread?.appId ||
      headers["x-app-id"]

    const appResult = await getApp({
      chrryUrl,
      appId,
      token: apiKey,
      pathname,
      API_URL,
    })

    const sortBy =
      (searchParams.get("sort") as "date" | "hot" | "liked") || "hot"

    const tags = searchParams.get("tags")
      ? searchParams.get("tags")!.split(",").filter(Boolean)
      : []

    const canShowTribeProfile =
      !tribeSlug && !excludedSlugRoutes?.includes(pathname) && !showAllTribe

    const [translationsResult, threadsResult, tribesResult, tribePostsResult] =
      await Promise.all([
        getTranslations({
          token: apiKey,
          locale,
          API_URL,
        }),

        getThreads({
          appId: appResult.id,
          pageSize: pageSizes.menuThreads,
          sort: "bookmark",
          token: apiKey,
          API_URL,
        }),
        !isBlogRoute
          ? getTribes({
              pageSize: 15,
              page: 1,
              token: apiKey,
              appId: canShowTribeProfile ? appResult.id : undefined,
              API_URL,
            })
          : Promise.resolve(undefined),
        !isBlogRoute
          ? getTribePosts({
              pageSize: 10,
              page: 1,
              token: apiKey,
              appId: canShowTribeProfile ? appResult.id : undefined,
              API_URL,
              sortBy,
              tags,
            })
          : Promise.resolve(undefined),
      ])

    threads = threadsResult

    thread = threadResult

    translations = translationsResult

    session = sessionResult

    tribes = tribesResult
    tribePost = tribePostResult
    tribePosts = tribePostsResult

    tribe = tribes?.tribes.find((t) => t.slug === tribeSlug)

    accountApp = session?.userBaseApp || session?.guestBaseApp
    app = appResult.id === accountApp?.id ? accountApp : appResult
  } catch (error) {
    captureException(error)
    console.error("❌ API Error:", error)
    apiError = error as Error
  }

  // Fetch threads

  const theme =
    themeCookie || (app?.backgroundColor === "#ffffff" ? "light" : "dark")

  // Agent profile route

  // Check if this is a tribe route OR if app slug is 'chrry'

  // Try to extract store and app slugs from URL (works for /:storeSlug/:appSlug pattern)
  // This handles clean URLs like /blossom/chrry without /agent prefix

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
    tribes,
    tribePosts,
    tribePost,
    showTribe,
    accountApp,
    tribe,
    showAllTribe,
    pathname, // Add pathname so client knows the SSR route
  }
  // Generate metadata for this route
  let metadata
  try {
    metadata = await generateServerMetadata(pathname, hostname, locale, result)
  } catch (error) {
    console.error("Error generating metadata in server-loader:", error)
  }

  // Parse all search params for client hydration

  return {
    ...result,
    fingerprint: session?.fingerprint ?? fingerprint,
    metadata,
    searchParams, // Pass search params to client for hydration consistency
  }
}
