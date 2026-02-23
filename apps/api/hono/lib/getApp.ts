import type { appWithStore } from "@chrryai/chrry/types"
import { FRONTEND_URL } from "@chrryai/chrry/utils"
import { getSiteConfig, whiteLabels } from "@chrryai/chrry/utils/siteConfig"
import { getAppAndStoreSlugs } from "@chrryai/chrry/utils/url"
import { db, eq, getApp as getAppDb, getStore } from "@repo/db"
import { stores } from "@repo/db/src/schema"
import type { Context } from "hono"
import { getActiveRentalsForStore } from "../../lib/adExchange/getActiveRentals"
import { getGuest, getMember } from "./auth"

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
    appSlug: params.appSlug || appSlugParam || undefined,
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
      guestId: auth.guest.id,
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
      userId: auth.member.id,
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

async function resolveAppBySlug(
  appSlug: string,
  storeSlug: string,
  auth: AuthContext,
  skipCache: boolean,
): Promise<{ app: any; path: string }> {
  const app = await getAppDb({
    slug: appSlug,
    storeSlug,
    userId: auth.member?.id,
    guestId: auth.guest?.id,
    depth: 1,
    skipCache,
  })

  return { app, path: "appSlug" }
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

async function resolveAppFromStoreCandidate(
  requestParams: RequestParams,
  auth: AuthContext,
  siteConfig: any,
): Promise<{ app: any; path: string } | null> {
  const pathname = requestParams.pathname

  const segments = pathname?.split("/").filter(Boolean) ?? []
  if (segments.length === 0) return null

  // First segment is always the store slug candidate
  const storeSlugCandidate = segments[0]
  // Second+ segment is the app slug (only present for store/app paths)
  const appSlugCandidate =
    segments.length >= 2 ? segments[segments.length - 1] : undefined

  const [dbStore] = storeSlugCandidate
    ? await db
        .select({
          id: stores.id,
          appId: stores.appId,
        })
        .from(stores)
        .where(eq(stores.slug, storeSlugCandidate))
        .limit(1)
    : []

  if (!dbStore) return null

  // Single segment (/lifeos) → return store's main app
  // Two+ segments (/sushistore/sakabsii) → return specific app within store
  const app = appSlugCandidate
    ? await getAppDb({
        slug: appSlugCandidate,
        storeSlug: storeSlugCandidate,
        userId: auth.member?.id,
        guestId: auth.guest?.id,
        depth: 1,
        skipCache: requestParams.skipCache,
      })
    : dbStore.appId
      ? await getAppDb({
          id: dbStore.appId,
          userId: auth.member?.id,
          guestId: auth.guest?.id,
          depth: 1,
          skipCache: requestParams.skipCache,
        })
      : undefined

  if (!app) return null

  return { app, path: "storeCandidate" }
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
      userId: auth.member?.id,
      guestId: auth.guest?.id,
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
      userId: auth.member?.id,
      guestId: auth.guest?.id,
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
    app.store.apps.map(async (storeApp: appWithStore) => {
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

  // Add active slot rentals to store.apps
  if (app?.store?.id) {
    try {
      const rentedAppsWithMetadata = await getActiveRentalsForStore({
        storeId: app.store.id,
        userId: auth.member?.id,
        guestId: auth.guest?.id,
      })

      // Filter out apps that already exist in store.apps
      const newRentedApps = rentedAppsWithMetadata.filter(
        (a) => !app.store.apps.find((b: appWithStore) => b.id === a?.id),
      )

      // Add rented apps to the beginning of the list (priority placement)
      if (newRentedApps.length > 0) {
        // Check if current user is the store owner
        const isStoreOwner =
          (auth.member && app.store.userId === auth.member.id) ||
          (auth.guest && app.store.guestId === auth.guest.id)

        // Re-fetch apps with depth 1 for full details
        const extendedApps = await Promise.all(
          newRentedApps
            .filter((a) => !!a)
            .map(async (rentedApp) => {
              const fullApp = await getAppDb({
                id: rentedApp.id,
                userId: auth.member?.id,
                guestId: auth.guest?.id,
                depth: 1,
                skipCache,
              })

              // Only attach rental metadata if user is the store owner
              if (fullApp && isStoreOwner && rentedApp._rental) {
                return {
                  ...fullApp,
                  _rental: rentedApp._rental,
                }
              }

              return fullApp
            }),
        )

        app.store.apps = [...extendedApps.filter(Boolean), ...app.store.apps]
      }
    } catch (error) {
      console.error("Failed to fetch active rentals:", error)
      // Don't fail the whole request if rentals fail
    }
  }
}

/**
 * Ensure required apps are in the store apps list
 */
function ensureRequiredApps(app: any, siteApp: any, burnApp: any): void {
  if (!app?.store?.apps || !Array.isArray(app.store.apps)) return

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
  ...params
}: {
  c: Context
  appId?: string
  storeSlug?: string
  appSlug?: string
  accountApp?: boolean
  skipCache?: boolean
  chrryUrl?: string
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
  const chrryUrl = params.chrryUrl || chrryUrlParam || getChrryUrl(request)
  const siteConfig = getSiteConfig(chrryUrl)

  const accountApp = params.accountApp || c.req.query("accountApp") === "true"

  const appSlug = requestParams.appSlug
  const storeSlug = requestParams.storeSlug

  // 5. Resolve app based on request type
  let appInternal = null

  if (accountApp) {
    // For account app: if no auth exists, return null early
    const result = await resolveAccountApp(auth, requestParams.skipCache)
    if (!result) return null // No auth (guest/member) - fail fast
    if (!result.app) return null // Auth exists but no app - don't use fallback
    appInternal = result.app
    resolutionPath = result.path
  } else if (appId) {
    const result = await resolveAppById(appId, auth, requestParams.skipCache)
    if (!result.app) return null
    appInternal = result.app
    resolutionPath = result.path
  } else if (appSlug && storeSlug) {
    const result = await resolveAppBySlug(
      appSlug,
      storeSlug,
      auth,
      requestParams.skipCache,
    )
    if (!result.app) return null
    appInternal = result.app
    resolutionPath = result.path
  } else {
    const result =
      (await resolveAppFromStoreCandidate(requestParams, auth, siteConfig)) ??
      (await resolveAppFromStoreContext(requestParams, auth, siteConfig))
    appInternal = result?.app
    resolutionPath = result?.path ?? "storeContext"
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

export function getChrryUrl(request: Request): string | undefined {
  try {
    const chrryUrlHeader = request.headers.get("x-chrry-url")
    return chrryUrlHeader || FRONTEND_URL
  } catch (error) {
    console.error("Error getting chrryUrl:", error)
    return undefined
  }
}
