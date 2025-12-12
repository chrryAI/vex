import { v4 as uuidv4 } from "uuid"
import { VERSION, getThreadId, pageSizes } from "chrry/utils"
import {
  getApp,
  getSession,
  getThread,
  getThreads,
  getTranslations,
} from "chrry/lib"
import { locale } from "chrry/locales"
import { session, thread, paginatedMessages, appWithStore } from "chrry/types"
import { getSiteConfig } from "chrry/utils/siteConfig"

export interface ServerRequest {
  url: string
  hostname: string
  pathname: string
  headers: Record<string, string | undefined>
  cookies: Record<string, string | undefined>
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
}

const TEST_MEMBER_FINGERPRINTS =
  process.env.TEST_MEMBER_FINGERPRINTS?.split(",") || []
const TEST_GUEST_FINGERPRINTS =
  process.env.TEST_GUEST_FINGERPRINTS?.split(",") || []

/**
 * Load all server-side data for SSR
 * This replaces Next.js server components data fetching
 */
export async function loadServerData(
  request: ServerRequest,
): Promise<ServerData> {
  const { pathname, hostname, headers, cookies, url } = request
  console.log(`🚀 ~ pathname:`, pathname)

  const threadId = getThreadId(pathname)
  const isDev = process.env.MODE === "development"

  // Parse query string for fp parameter (only if URL contains query params)
  let fpFromQuery: string | null = null
  if (url.includes("?")) {
    const urlObj = new URL(url, `http://${hostname}`)
    fpFromQuery = urlObj.searchParams.get("fp")
  }

  const deviceId = cookies.deviceId || headers["x-device-id"] || uuidv4()
  const fingerprint =
    (TEST_MEMBER_FINGERPRINTS?.concat(TEST_GUEST_FINGERPRINTS).includes(
      fpFromQuery || "",
    )
      ? fpFromQuery
      : headers["x-fp"] || cookies.fingerprint) || uuidv4()

  const gift = headers["x-gift"]
  const agentName = cookies.agentName
  const routeType = headers["x-route-type"]
  const viewPortWidth = cookies.viewPortWidth || ""
  const viewPortHeight = cookies.viewPortHeight || ""

  const apiKey = cookies.token || headers["x-token"] || fingerprint || uuidv4()
  // For now, use a placeholder - you'd need to implement getChrryUrl for Vite
  const chrryUrl = getSiteConfig(hostname).url
  const locale: locale = (cookies.locale as locale) || "en"

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
        pathname: `/${pathname}`,
        routeType,
        translate: true,
        locale,
        chrryUrl,
        screenWidth: Number(viewPortWidth),
        screenHeight: Number(viewPortHeight),
        gift,
        source: "layout",
      }),

      getTranslations({
        token: apiKey,
        locale,
      }),

      getApp({
        chrryUrl,
        appId,
        token: apiKey,
        pathname,
      }),
    ])

    session = sessionResult
    translations = translationsResult
    app = appResult

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
    })
  } catch (error) {
    console.error("Error fetching threads:", error)
  }

  const theme = app?.backgroundColor === "#ffffff" ? "light" : "dark"

  return {
    session,
    thread,
    threads,
    translations,
    app,
    siteConfig,
    locale,
    deviceId,
    fingerprint,
    viewPortWidth,
    viewPortHeight,
    chrryUrl,
    isDev,
    apiError,
    theme,
  }
}
