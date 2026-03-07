import {
  getApp,
  getSession,
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
import { API_INTERNAL_URL, getPostId, isE2E } from "@chrryai/chrry/utils"
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
  ip?: string
}

export interface ServerData {
  session?: session
  thread?: { thread: thread; messages: paginatedMessages }
  threads?: {
    threads: thread[]
    totalCount: number
  }
  apiKey?: string
  canShowAllTribe?: boolean
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
  pathname: string
  metadata?: {
    title?: string
    description?: string
    keywords?: string[]
    openGraph?: any
    twitter?: any
    robots?: any
    alternates?: any
  }
  blogPosts?: BlogPost[]
  blogPost?: BlogPostWithContent
  isBlogRoute?: boolean
  tribes?: paginatedTribes
  tribePosts?: paginatedTribePosts
  tribePost?: tribePostWithDetails
  tribe?: tribe
  searchParams?: Record<string, string> & {
    get: (key: string) => string | null
    has: (key: string) => boolean
    toString: () => string
  }
}

export async function loadServerData(
  request: ServerRequest,
): Promise<ServerData> {
  const { hostname, headers, cookies, url } = request

  const isDev = process.env.NODE_ENV !== "production"

  const API_URL = API_INTERNAL_URL

  let TEST_FINGERPRINTS: string[] = []

  const pathname = (
    (request.pathname.startsWith("/")
      ? request.pathname
      : `/${request.pathname}`) || "/"
  ).split("?")?.[0]

  const BOT_UA_PATTERN =
    /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|petalbot|mj12bot|dotbot|serpstatbot|rogerbot|exabot|sistrix|sogou|archive\.org_bot|ia_archiver|xbot|grok|gptbot|chatgpt-user|perplexitybot|claudebot/i
  const userAgent = headers["user-agent"] || ""
  const isBot = BOT_UA_PATTERN.test(userAgent)

  const isBlogList = pathname === "/blog"
  const isBlogPost = pathname.startsWith("/blog/") && pathname !== "/blog"

  const blogDataPromise = isBlogList
    ? getBlogPosts()
    : isBlogPost
      ? getBlogPost(pathname.replace("/blog/", ""))
      : Promise.resolve(null)

  const isLocalePathname =
    pathname && locales.includes(pathname.split("/")?.[1] as locale)

  const language = cookies.locale as locale

  const showTribe = cookies.showTribe === "true"
  const themeCookie = cookies.theme as themeType

  const acceptLanguage = headers["accept-language"]
  let browserLocale: locale = "en"

  if (acceptLanguage) {
    const languages = acceptLanguage
      .split(",")
      .map((lang) => {
        const [code] = lang.trim().split(";")
        return code.split("-")[0].toLowerCase()
      })
      .filter((code) => locales.includes(code as locale))

    if (languages.length > 0) {
      browserLocale = languages[0] as locale
    }
  }

  const locale = (
    isLocalePathname
      ? pathname.split("/")?.[1] || browserLocale
      : language || browserLocale
  ) as locale

  const urlObj = new URL(url, `http://${hostname}`)

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

  const authCode = urlObj.searchParams.get("auth_token")

  const cookieToken = cookies.token

  let authToken: string | null = cookieToken || null

  if (authCode) {
    try {
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
    : cookieToken && !validate(cookieToken)
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

  const apiKey =
    tokenCandidate ||
    (isTestFP && fpFromQuery ? fpFromQuery : fingerprintCandidate) ||
    uuidv4()

  const fingerprint = fingerprintCandidate || uuidv4()

  const gift = urlObj.searchParams.get("gift")
  const agentName = cookies.agentName
  const routeType = headers["x-route-type"]
  const viewPortWidth = cookies.viewPortWidth || ""
  const viewPortHeight = cookies.viewPortHeight || ""

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

  const chrryUrl = getSiteConfig(hostname).url
  const tribeSlug = pathname?.startsWith("/t/")
    ? pathname.replace("/t/", "").split("?")[0]
    : undefined

  const siteConfig = getSiteConfig(hostname)

  let session: session | undefined
  let translations: Record<string, any> | undefined
  let app: appWithStore | undefined
  let apiError: Error | undefined

  let appId: string | undefined
  let isBlogRoute = false

  let blogPosts: BlogPost[] | undefined
  let blogPost: BlogPostWithContent | undefined

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

  const pathnameWithoutLocale = isLocalePathname
    ? `/${pathname.split("/").slice(2).join("/")}`
    : pathname

  const canShowAllTribe =
    pathnameWithoutLocale === "/tribe" ||
    (siteConfig.isTribe &&
      (pathnameWithoutLocale === "/" || pathnameWithoutLocale === ""))

  try {
    const sessionResult = isBot
      ? await getSession({
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
          ip: clientIp,
        })
      : undefined

    if (pathname === "/blog" || pathname.startsWith("/blog/")) {
      isBlogRoute = true

      try {
        const blogData = await blogDataPromise

        if (isBlogList) {
          blogPosts = blogData as BlogPost[] | undefined
        } else if (isBlogPost) {
          blogPost = (blogData as BlogPostWithContent | null) || undefined
        }
      } catch (error) {
        console.error("❌ Blog data fetch failed:", error)
      }
    }

    const postId = getPostId(pathname)

    let tribePostResult: tribePostWithDetails | undefined
    if (postId && isBot) {
      try {
        tribePostResult = await getTribePost({
          id: postId,
          token: apiKey,
          API_URL,
          language,
        })
      } catch (error) {
        console.error("❌ Tribe post fetch failed:", error)
        tribePostResult = undefined
      }
    }

    appId = tribePostResult?.appId || headers["x-app-id"]

    const appResult = isBot
      ? await getApp({
          chrryUrl,
          appId,
          token: apiKey,
          pathname,
          API_URL,
        })
      : ({ id: appId } as appWithStore)

    const sortBy =
      (searchParams.get("sort") as "date" | "hot" | "liked") || "hot"

    const tags = searchParams.get("tags")
      ? searchParams.get("tags")!.split(",").filter(Boolean)
      : []

    const canShowTribeProfile =
      !tribeSlug && !excludedSlugRoutes?.includes(pathname) && !canShowAllTribe

    const [translationsResult, tribesResult, tribePostsResult] =
      await Promise.all([
        getTranslations({
          token: apiKey,
          locale,
          API_URL,
        }),

        isBot && !isBlogRoute
          ? getTribes({
              pageSize: 15,
              page: 1,
              token: apiKey,
              // appId: canShowTribeProfile ? appResult.id : undefined,
              API_URL,
            })
          : Promise.resolve(undefined),
        isBot && !isBlogRoute
          ? getTribePosts({
              pageSize: 10,
              page: 1,
              token: apiKey,
              appId: canShowTribeProfile ? appResult.id : undefined,
              API_URL,
              sortBy,
              tags,
              language,
            })
          : Promise.resolve(undefined),
      ])

    translations = translationsResult

    session = sessionResult

    tribes = tribesResult
    tribePost = tribePostResult
    tribePosts = tribePostsResult

    tribe = tribes?.tribes.find((t) => t.slug === tribeSlug)
  } catch (error) {
    captureException(error)
    console.error("❌ API Error:", error)
    apiError = error as Error
  }

  const theme =
    themeCookie || (app?.backgroundColor === "#ffffff" ? "light" : "dark")

  const result = {
    session,
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
    tribe,
    apiKey,
    canShowAllTribe,
    pathname,
  }
  let metadata
  try {
    metadata = await generateServerMetadata(pathname, hostname, locale, result)
  } catch (error) {
    console.error("Error generating metadata in server-loader:", error)
  }

  return {
    ...result,
    fingerprint: session?.fingerprint ?? fingerprint,
    metadata,
    searchParams,
  }
}
