import { getUser, getGuest as getGuestDb, getStore } from "@repo/db"
import jwt from "jsonwebtoken"
import captureException from "../../lib/captureException"
import { Context } from "hono"
import { validate } from "uuid"
import { FRONTEND_URL } from "@chrryai/chrry/utils"
import { getSiteConfig, whiteLabels } from "@chrryai/chrry/utils/siteConfig"
import { getApp as getAppDb } from "@repo/db"
import { getAppAndStoreSlugs } from "@chrryai/chrry/utils/url"
import { appWithStore } from "@chrryai/chrry/types"
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
    const token = jwt.sign({ email: byEmail }, process.env.NEXTAUTH_SECRET!)
    const user = await getUser({ email: byEmail, skipCache, appId })

    if (user) {
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

    if (authHeader && authHeader.startsWith("Bearer ")) {
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

    if (authHeader && authHeader.startsWith("Bearer ")) {
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

/**
 * Get app from request
 * Pure function - no Next.js dependencies
 */
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
  // TELEMETRY: Track performance
  const startTime = Date.now()
  let resolutionPath = "unknown"

  // 1. PERFORMANCE: Request-Level Cache (Memoization)
  // If we already resolved the app in this request lifecycle (e.g. in middleware), return it.
  const cachedApp = c.get("app")
  if (cachedApp && !params.skipCache) {
    // Safety check: ensure the cached app matches the ID we are asking for
    if (!params.appId || cachedApp.id === params.appId) {
      console.log(`[getApp] ⚡ Cache hit in ${Date.now() - startTime}ms`)
      return cachedApp
    }
  }

  const request = c.req.raw

  // 2. QUERY PARAMS & HEADERS
  const appSlugParam = c.req.query("appSlug")
  const storeSlugParam = c.req.query("storeSlug")
  const chrryUrlParam = c.req.query("chrryUrl")
  const skipCacheParam = c.req.query("skipCache") === "true"
  const pathnameParam = c.req.query("pathname")

  const skipCache =
    skipCacheParam ||
    params.skipCache ||
    ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)

  const storeSlugHeader = request.headers.get("x-app-slug")
  const pathnameHeader = request.headers.get("x-pathname")

  const storeSlug =
    params.storeSlug || storeSlugParam || storeSlugHeader || undefined
  const pathname =
    (pathnameParam
      ? decodeURIComponent(pathnameParam)
      : pathnameHeader || "/"
    ).split("?")[0] || "/"

  const appIdHeader = request.headers.get("x-app-id")
  const appIdParam = c.req.query("appId")

  const appId = params.appId || appIdParam || appIdHeader || undefined

  // 3. AUTH RESOLUTION (Sequential for DB Economy)
  const member = await getMember(c, { full: true, skipCache: true })
  // Lazy evaluation: Only fetch guest if member is missing
  const guest = !member ? await getGuest(c, { skipCache: true }) : undefined

  // 4. CONTEXT RESOLUTION
  const chrryUrl = chrryUrlParam || (await getChrryUrl(request))
  const siteConfig = getSiteConfig(chrryUrl)

  // 5. APP RESOLUTION LOGIC (Flattened for Readability)
  let appInternal = null

  // PATH A: Account App (User is the App)
  if (accountApp) {
    resolutionPath = "accountApp"
    if (guest) {
      resolutionPath = "accountApp:guest"
      appInternal = await getAppDb({
        storeSlug: guest.id,
        ownerId: guest.id,
        depth: 1,
        skipCache,
        isSafe: false,
      })
    } else if (member) {
      resolutionPath = "accountApp:member"
      appInternal = await getAppDb({
        storeSlug: member.userName,
        ownerId: member.id,
        depth: 1,
        skipCache,
        isSafe: false,
      })

      // console.log(`🚀 ~ spppppp:`, appInternal?.name)
    }
  }
  // PATH B: Explicit App ID
  else if (appId) {
    resolutionPath = "appId"
    appInternal = await getAppDb({
      id: appId,
      userId: member?.id,
      guestId: guest?.id,
      depth: 1,
      skipCache,
    })
  }
  // PATH C: Store Context Resolution
  else {
    // Resolve store from request if explicit slug provided
    const storeFromRequest = storeSlug
      ? await getStore({
          slug: storeSlug,
          userId: member?.id,
          guestId: guest?.id,
          depth: 1,
          skipCache,
        })
      : null

    if (storeFromRequest?.store?.appId) {
      resolutionPath = "storeSlug"
      appInternal = await getAppDb({
        id: storeFromRequest.store.appId,
        userId: member?.id,
        guestId: guest?.id,
        depth: 1,
        skipCache,
      })
    } else {
      // Fallback to URL/Pathname resolution
      let { appSlug: appSlugGenerated, storeSlug: storeSlugGenerated } =
        getAppAndStoreSlugs(pathname, {
          defaultAppSlug: siteConfig.slug,
          defaultStoreSlug: siteConfig.storeSlug,
        })

      if (appSlugParam) appSlugGenerated = appSlugParam
      if (storeSlugParam) storeSlugGenerated = storeSlugParam

      // Check white label overrides
      const whiteLabel = whiteLabels.find(
        (label) => label.slug === appSlugGenerated && label.isStoreApp,
      )
      if (whiteLabel) {
        storeSlugGenerated = whiteLabel.storeSlug
      }

      resolutionPath = whiteLabel ? "whiteLabel" : "pathname"
      appInternal = await getAppDb({
        slug: appSlugGenerated,
        storeSlug: storeSlugGenerated,
        userId: member?.id,
        guestId: guest?.id,
        depth: 1,
        skipCache,
      })
    }
  }

  // 6. VALIDATION & FALLBACK
  if (appId && !appInternal) return null
  if (accountApp && !appInternal) return null

  // Get site app & chrry store context
  // Note: These run in parallel as they are independent deps
  const [siteApp, chrryStore, burnApp] = await Promise.all([
    getAppDb({
      slug: siteConfig.slug,
      storeSlug: siteConfig.storeSlug,
      skipCache,
    }),
    getStore({
      domain: siteConfig.store,
      userId: member?.id,
      guestId: guest?.id,
      depth: 1,
      skipCache,
    }),
    getAppDb({
      slug: "burn",
      // storeSlug: siteConfig.storeSlug,
      skipCache,
      depth: 1,
    }),
  ])

  const store = appInternal?.store || chrryStore
  const baseApp =
    store?.apps?.find(
      (app) =>
        app.slug === siteConfig.slug &&
        app.store?.slug === siteConfig.storeSlug,
    ) || store?.app

  // Final App Object
  const app =
    appInternal ||
    (await getAppDb({
      id: baseApp?.id,
      userId: member?.id,
      guestId: guest?.id,
      depth: 1,
      skipCache,
    }))

  if (!app) return null

  // 7. ENRICHMENT (Recursive Store Apps)
  if (app?.store?.apps?.length) {
    const currentStoreApps = app.store.apps || []
    // Use Promise.all here because we WANT parallel fetching for the list
    const enrichedApps = await Promise.all(
      currentStoreApps.map(async (storeApp) => {
        if (!storeApp) return null
        const isBaseApp = storeApp?.id === storeApp?.store?.appId
        let storeBaseApp = null

        if (isBaseApp) {
          storeBaseApp =
            (await getAppDb({
              id: storeApp?.id,
              userId: member?.id,
              guestId: guest?.id,
              depth: 1,
              skipCache,
            })) || null
        } else if (storeApp?.store?.appId) {
          storeBaseApp =
            (await getAppDb({
              id: storeApp.store.appId,
              userId: member?.id,
              guestId: guest?.id,
              skipCache,
              depth: 0,
            })) || null
        }

        return {
          ...storeApp,
          store: { ...storeApp?.store, app: storeBaseApp },
        } as appWithStore
      }),
    )
    app.store.apps = enrichedApps.filter(Boolean) as appWithStore[]
  }

  // Ensure site app is in the list
  if (
    app &&
    siteApp &&
    app.store?.apps &&
    !app.store.apps.some((a) => a.id === siteApp.id)
  ) {
    app.store.apps.push(siteApp)
  }

  if (
    app &&
    burnApp &&
    app.store?.apps &&
    !app.store.apps.some((a) => a.id === burnApp.id)
  ) {
    app.store.apps.push(burnApp)
  }

  // 8. SET CACHE (The Win)
  // Store the result in Hono context so subsequent calls (e.g. in route handler) get it instantly
  c.set("app", app)

  // TELEMETRY: Log resolution path and performance
  const duration = Date.now() - startTime
  // console.log(
  //   `[getApp] ✓ Resolved via "${resolutionPath}" in ${duration}ms | App: ${app.slug} | Store: ${app.store?.slug || "none"}`,
  // )

  return app
}
