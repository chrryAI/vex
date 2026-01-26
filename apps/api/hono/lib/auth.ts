import {
  getUser,
  getGuest as getGuestDb,
  getStore,
  getApp as getAppDb,
} from "@repo/db"
import jwt from "jsonwebtoken"
import captureException from "../../lib/captureException"
import { Context } from "hono"
import { validate } from "uuid"
import { FRONTEND_URL } from "@chrryai/chrry/utils"
import { getSiteConfig, whiteLabels } from "@chrryai/chrry/utils/siteConfig"
import { getAppAndStoreSlugs } from "@chrryai/chrry/utils/url"
import { appWithStore } from "@chrryai/chrry/types"

// ==================== HELPER TYPES ====================
interface RequestParams {
  appSlug?: string
  storeSlug?: string
  pathname: string
  skipCache: boolean
}

interface AuthContext {
  member: Awaited<ReturnType<typeof getMember>>
  guest: Awaited<ReturnType<typeof getGuest>>
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract request parameters from context
 */
function extractRequestParams(c: Context, params: any): RequestParams {
  const request = c.req.raw

  const appSlugParam = c.req.query("appSlug")
  const storeSlugParam = c.req.query("storeSlug")
  const skipCacheParam = c.req.query("skipCache") === "true"
  const pathnameParam = c.req.query("pathname")
  const storeSlugHeader = request.headers.get("x-app-slug")
  const pathnameHeader = request.headers.get("x-pathname")

  const skipCache =
    skipCacheParam ||
    params.skipCache ||
    ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)

  const storeSlug =
    params.storeSlug || storeSlugParam || storeSlugHeader || undefined
  const pathname =
    (pathnameParam
      ? decodeURIComponent(pathnameParam)
      : pathnameHeader || "/"
    ).split("?")[0] || "/"

  return {
    appSlug: appSlugParam,
    storeSlug,
    pathname,
    skipCache,
  }
}

/**
 * Extract app ID from various sources
 */
function extractAppId(c: Context, params: any): string | undefined {
  const request = c.req.raw
  const appIdHeader = request.headers.get("x-app-id")
  const appIdParam = c.req.query("appId")
  return params.appId || appIdParam || appIdHeader || undefined
}

/**
 * Resolve app for account-based request (user = app)
 */
async function resolveAccountApp(
  auth: AuthContext,
  skipCache: boolean,
): Promise<{ app: any; path: string } | null> {
  if (auth.guest) {
    const app = await getAppDb({
      storeSlug: auth.guest.id,
      ownerId: auth.guest.id,
      depth: 1,
      skipCache,
      isSafe: false,
    })
    return { app, path: "accountApp:guest" }
  }

  if (auth.member) {
    const app = await getAppDb({
      storeSlug: auth.member.userName,
      ownerId: auth.member.id,
      depth: 1,
      skipCache,
      isSafe: false,
    })
    return { app, path: "accountApp:member" }
  }

  return null
}

/**
 * Resolve app by explicit ID
 */
async function resolveAppById(
  appId: string,
  auth: AuthContext,
  skipCache: boolean,
): Promise<{ app: any; path: string }> {
  const app = await getAppDb({
    id: appId,
    userId: auth.member?.id,
    guestId: auth.guest?.id,
    depth: 1,
    skipCache,
  })
  return { app, path: "appId" }
}

/**
 * Resolve app from store slug
 */
async function resolveAppFromStore(
  storeSlug: string,
  auth: AuthContext,
  skipCache: boolean,
): Promise<{ app: any; path: string } | null> {
  const storeFromRequest = await getStore({
    slug: storeSlug,
    userId: auth.member?.id,
    guestId: auth.guest?.id,
    depth: 1,
    skipCache,
  })

  if (!storeFromRequest?.store?.appId) return null

  const app = await getAppDb({
    id: storeFromRequest.store.appId,
    userId: auth.member?.id,
    guestId: auth.guest?.id,
    depth: 1,
    skipCache,
  })

  return { app, path: "storeSlug" }
}

/**
 * Resolve app from pathname with white label support
 */
async function resolveAppFromPathname(
  pathname: string,
  requestParams: RequestParams,
  auth: AuthContext,
  siteConfig: any,
): Promise<{ app: any; path: string }> {
  let { appSlug: appSlugGenerated, storeSlug: storeSlugGenerated } =
    getAppAndStoreSlugs(pathname, {
      defaultAppSlug: siteConfig.slug,
      defaultStoreSlug: siteConfig.storeSlug,
    })

  if (requestParams.appSlug) appSlugGenerated = requestParams.appSlug
  if (requestParams.storeSlug) storeSlugGenerated = requestParams.storeSlug

  const whiteLabel = whiteLabels.find(
    (label) => label.slug === appSlugGenerated && label.isStoreApp,
  )

  if (whiteLabel) {
    storeSlugGenerated = whiteLabel.storeSlug
  }

  const app = await getAppDb({
    slug: appSlugGenerated,
    storeSlug: storeSlugGenerated,
    userId: auth.member?.id,
    guestId: auth.guest?.id,
    depth: 1,
    skipCache: requestParams.skipCache,
  })

  return { app, path: whiteLabel ? "whiteLabel" : "pathname" }
}

/**
 * Resolve app using store context (store slug or pathname)
 */
async function resolveAppFromStoreContext(
  requestParams: RequestParams,
  auth: AuthContext,
  siteConfig: any,
): Promise<{ app: any; path: string }> {
  if (requestParams.storeSlug) {
    const result = await resolveAppFromStore(
      requestParams.storeSlug,
      auth,
      requestParams.skipCache,
    )
    if (result) return result
  }

  return resolveAppFromPathname(
    requestParams.pathname,
    requestParams,
    auth,
    siteConfig,
  )
}

/**
 * Get fallback apps (site app, chrry store, burn app)
 */
async function getFallbackApps(
  siteConfig: any,
  auth: AuthContext,
  skipCache: boolean,
) {
  return Promise.all([
    getAppDb({
      slug: siteConfig.slug,
      storeSlug: siteConfig.storeSlug,
      skipCache,
    }),
    getStore({
      domain: siteConfig.store,
      userId: auth.member?.id,
      guestId: auth.guest?.id,
      depth: 1,
      skipCache,
    }),
    getAppDb({
      slug: "burn",
      skipCache,
      depth: 1,
    }),
  ])
}

/**
 * Determine final app from internal or fallback
 */
async function resolveFinalApp(
  appInternal: any,
  store: any,
  siteConfig: any,
  auth: AuthContext,
  skipCache: boolean,
) {
  if (appInternal) return appInternal

  const baseApp =
    store?.apps?.find(
      (app: any) =>
        app.slug === siteConfig.slug &&
        app.store?.slug === siteConfig.storeSlug,
    ) || store?.app

  if (!baseApp?.id) return null

  return getAppDb({
    id: baseApp.id,
    userId: auth.member?.id,
    guestId: auth.guest?.id,
    depth: 1,
    skipCache,
  })
}

/**
 * Enrich app with recursive store apps
 */
async function enrichStoreApps(
  app: any,
  auth: AuthContext,
  skipCache: boolean,
): Promise<void> {
  if (!app?.store?.apps?.length) return

  const enrichedApps = await Promise.all(
    app.store.apps.map(async (storeApp: any) => {
      if (!storeApp) return null

      const isBaseApp = storeApp?.id === storeApp?.store?.appId
      let storeBaseApp = null

      if (isBaseApp) {
        storeBaseApp = await getAppDb({
          id: storeApp.id,
          userId: auth.member?.id,
          guestId: auth.guest?.id,
          depth: 1,
          skipCache,
        })
      } else if (storeApp?.store?.appId) {
        storeBaseApp = await getAppDb({
          id: storeApp.store.appId,
          userId: auth.member?.id,
          guestId: auth.guest?.id,
          skipCache,
          depth: 0,
        })
      }

      return {
        ...storeApp,
        store: { ...storeApp?.store, app: storeBaseApp },
      } as appWithStore
    }),
  )

  app.store.apps = enrichedApps.filter(Boolean) as appWithStore[]
}

/**
 * Ensure required apps are in the store apps list
 */
function ensureRequiredApps(app: any, siteApp: any, burnApp: any): void {
  if (!app?.store?.apps) return

  if (siteApp && !app.store.apps.some((a: any) => a.id === siteApp.id)) {
    app.store.apps.push(siteApp)
  }

  if (burnApp && !app.store.apps.some((a: any) => a.id === burnApp.id)) {
    app.store.apps.push(burnApp)
  }
}

// ==================== MAIN FUNCTION ====================

/**
 * Get app from request
 * Optimized: Request Caching + Early Returns
 */
export async function getApp({
  c,
  accountApp = false,
  ...params
}: {
  c: Context
  appId?: string
  storeSlug?: string
  accountApp?: boolean
  skipCache?: boolean
}) {
  const startTime = Date.now()
  let resolutionPath = ""

  // 1. Check cache
  const cachedApp = c.get("app")
  if (cachedApp && !params.skipCache) {
    if (!params.appId || cachedApp.id === params.appId) {
      console.log(`[getApp] ⚡ Cache hit in ${Date.now() - startTime}ms`)
      return cachedApp
    }
  }

  // 2. Extract request data
  const request = c.req.raw
  const requestParams = extractRequestParams(c, params)
  const appId = extractAppId(c, params)

  // 3. Get auth context
  const member = await getMember(c, { full: true, skipCache: true })
  const guest = await getGuest(c, { skipCache: true })
  const auth: AuthContext = { member, guest }

  // 4. Get site config
  const chrryUrlParam = c.req.query("chrryUrl")
  const chrryUrl = chrryUrlParam || getChrryUrl(request)
  const siteConfig = getSiteConfig(chrryUrl)

  // 5. Resolve app based on request type
  let appInternal = null

  if (accountApp) {
    const result = await resolveAccountApp(auth, requestParams.skipCache)
    if (!result) return null
    appInternal = result.app
    resolutionPath = result.path
  } else if (appId) {
    const result = await resolveAppById(appId, auth, requestParams.skipCache)
    if (!result.app) return null
    appInternal = result.app
    resolutionPath = result.path
  } else {
    const result = await resolveAppFromStoreContext(
      requestParams,
      auth,
      siteConfig,
    )
    appInternal = result.app
    resolutionPath = result.path
  }

  // 6. Get fallback apps
  const [siteApp, chrryStore, burnApp] = await getFallbackApps(
    siteConfig,
    auth,
    requestParams.skipCache,
  )

  // 7. Determine final app
  const store = appInternal?.store || chrryStore
  const app = await resolveFinalApp(
    appInternal,
    store,
    siteConfig,
    auth,
    requestParams.skipCache,
  )

  if (!app) return null

  // 8. Enrich with store apps
  await enrichStoreApps(app, auth, requestParams.skipCache)

  // 9. Ensure required apps
  ensureRequiredApps(app, siteApp, burnApp)

  // 10. Cache result
  c.set("app", app)

  // 11. Log telemetry
  const duration = Date.now() - startTime
  console.log(
    `[getApp] ✓ Resolved via "${resolutionPath}" in ${duration}ms | App: ${app.slug} | Store: ${app.store?.slug || "none"}`,
  )

  return app
}

/**
 * Get authenticated member from request
 * Pure function - no Next.js dependencies
 */
export async function getMember(
  c: Context,
  options: {
    byEmail?: string
    full?: boolean
    skipCache?: boolean
  } = {},
) {
  const { byEmail } = options

  const request = c.req.raw

  const appIdHeader = request.headers.get("x-app-id")
  const appIdParam = c.req.query("appId")

  const appId = appIdParam || appIdHeader || undefined

  const skipCache = options.skipCache || c.req.method !== "GET"
  const full = options.full || skipCache

  if (byEmail) {
    const user = await getUser({ email: byEmail, skipCache, appId })

    if (user) {
      const token = jwt.sign({ email: byEmail }, process.env.NEXTAUTH_SECRET!)

      return {
        ...user,
        token,
        sessionCookie: undefined,
        password: full ? user.password : null,
      }
    }
    return
  }

  try {
    // Check for token in Authorization header
    const authHeader = c.req.header("authorization")

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "")

      // Basic JWT format validation
      if (token.split(".").length !== 3) {
        const fp = authHeader.replace("Bearer ", "")

        const result = await getUser({
          apiKey: fp,
          skipCache: skipCache,
          appId,
        })
        if (result) {
          return {
            ...result,
            token,
            password: full ? result.password : null,
          }
        }

        return
      }

      // Verify and decode the token
      const decoded: any = jwt.verify(token, process.env.NEXTAUTH_SECRET!)
      if (decoded.email) {
        const user = await getUser({
          email: decoded.email,
          skipCache: skipCache,
          appId,
        })

        if (user) {
          return {
            ...user,
            token,
            password: full ? user.password : null,
          }
        }
        return
      }
    }
  } catch (error) {
    captureException(error)
    console.error("Error verifying token:", error)
  }
}
/**
 * Get guest from request
 * Pure function - no Next.js dependencies
 */
export async function getGuest(
  c?: Context,
  { skipCache }: { skipCache?: boolean } = {},
  debug = false,
) {
  const request = c?.req.raw
  const appIdHeader = request?.headers.get("x-app-id")
  const appIdParam = c?.req.query("appId")

  const appId = appIdParam || appIdHeader || undefined

  try {
    // If no context provided, return undefined (for backward compatibility)
    if (!c) {
      return undefined
    }

    const authHeader = c.req.header("authorization")

    if (authHeader?.startsWith("Bearer ")) {
      const fp = authHeader.replace("Bearer ", "")

      if (!validate(fp)) {
        return
      }

      const result = await getGuestDb({ fingerprint: fp, skipCache, appId })

      if (!result) {
        const cookieFingerprint = c.req
          .header("cookie")
          ?.split(";")
          .find((c) => c.trim().startsWith("fingerprint="))
          ?.split("=")[1]

        const headerFingerprint = c.req.header("x-fp")

        const fingerprint = cookieFingerprint || headerFingerprint

        if (fingerprint) {
          const result = await getGuestDb({ fingerprint, skipCache, appId })

          return result || undefined
        }
      }

      return result || undefined
    }

    return
  } catch (error) {
    console.error("Error verifying token:", error)
    return
  }
}
/**
 * Get chrryUrl from request headers
 * Pure function - no Next.js dependencies
 */
export function getChrryUrl(request: Request): string | undefined {
  try {
    const chrryUrlHeader = request.headers.get("x-chrry-url")
    return chrryUrlHeader || FRONTEND_URL
  } catch (error) {
    console.error("Error getting chrryUrl:", error)
    return undefined
  }
}
