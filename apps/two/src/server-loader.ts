import { v4 as uuidv4 } from "uuid"
import {
  VERSION,
  getThreadId,
  pageSizes,
} from "chrry/utils"
import { getSession, getThread, getThreads, getTranslations } from "chrry/lib"
import { locale } from "chrry/locales"
import {
  session,
  thread,
  paginatedMessages,
  appWithStore,
} from "chrry/types"
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

/**
 * Load all server-side data for SSR
 * This replaces Next.js server components data fetching
 */
export async function loadServerData(
  request: ServerRequest,
  apiKey: string,
): Promise<ServerData> {
  const { pathname, hostname, headers, cookies } = request

  const threadId = getThreadId(pathname)
  const isDev = process.env.MODE === "development"

  const deviceId = cookies.deviceId || headers["x-device-id"] || uuidv4()
  const fingerprint = headers["x-fp"] || cookies.fingerprint || uuidv4()
  const gift = headers["x-gift"]
  const agentName = cookies.agentName
  const routeType = headers["x-route-type"]
  const viewPortWidth = cookies.viewPortWidth || ""
  const viewPortHeight = cookies.viewPortHeight || ""

  // For now, use a placeholder - you'd need to implement getChrryUrl for Vite
  const chrryUrl = isDev ? "http://localhost:3000" : "https://vex.chrry.ai"
  const locale: locale = (cookies.locale as locale) || "en"

  const siteConfig = getSiteConfig(hostname)

  let thread: { thread: thread; messages: paginatedMessages } | undefined
  let session: session | undefined
  let translations: Record<string, any> | undefined
  let app: appWithStore | undefined
  let threads: { threads: thread[]; totalCount: number } | undefined
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

  const appId = thread?.thread?.appId

  // Fetch session, translations, and app in parallel
  try {
    const [sessionResult, translationsResult] = await Promise.all([
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
        gift,
        source: "ssr",
        userAgent: headers["user-agent"] || `Chrry/${VERSION}`,
      }),

      getTranslations({
        token: apiKey,
        locale,
      }),
    ])

    session = sessionResult
    translations = translationsResult

    // Extract app from session if available
    if (session && "app" in session) {
      app = session.app as appWithStore
    }
  } catch (error) {
    console.error("❌ API Error:", error)
    apiError = error as Error
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
