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

  const skipCache = options.skipCache || c.req.method !== "GET"
  const full = options.full || skipCache

  if (byEmail) {
    const token = jwt.sign({ email: byEmail }, process.env.NEXTAUTH_SECRET!)
    const user = await getUser({ email: byEmail, skipCache })

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

        const result = await getUser({ apiKey: fp, skipCache: skipCache })
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

      const result = await getGuestDb({ fingerprint: fp, skipCache })

      if (!result) {
        const cookieFingerprint = c.req
          .header("cookie")
          ?.split(";")
          .find((c) => c.trim().startsWith("fingerprint="))
          ?.split("=")[1]

        const headerFingerprint = c.req.header("x-fp")

        const fingerprint = cookieFingerprint || headerFingerprint

        if (fingerprint) {
          const result = await getGuestDb({ fingerprint, skipCache })

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
  const request = c.req.raw

  const member = await getMember(c, { full: true, skipCache: true })
  const guest = !member ? await getGuest(c, { skipCache: true }) : undefined

  // Get query parameters
  const appIdParam = c.req.query("appId")
  const appSlugParam = c.req.query("appSlug")
  const storeSlugParam = c.req.query("storeSlug")
  const chrryUrlParam = c.req.query("chrryUrl")
  const skipCacheParam = c.req.query("skipCache") === "true"

  const pathnameParam = c.req.query("pathname")

  const skipCache = skipCacheParam || params.skipCache || false

  // Get headers
  const appIdHeader = request.headers.get("x-app-id")
  const storeSlugHeader = request.headers.get("x-app-slug")

  const pathnameHeader = request.headers.get("x-pathname")

  const storeSlug =
    params.storeSlug || storeSlugParam || storeSlugHeader || undefined

  const pathname =
    (pathnameParam
      ? decodeURIComponent(pathnameParam)
      : pathnameHeader || "/"
    ).split("?")[0] || "/"
  const appId = params.appId || appIdParam || appIdHeader || undefined

  // Get store from header if provided
  const storeFromRequest = storeSlug
    ? await getStore({
        slug: storeSlug,
        userId: member?.id,
        guestId: guest?.id,
        depth: 1,
        skipCache,
      })
    : null

  // Get chrryUrl
  const chrryUrl = chrryUrlParam || (await getChrryUrl(request))
  const siteConfig = getSiteConfig(chrryUrl)

  // Get site app
  const siteApp = await getAppDb({
    slug: siteConfig.slug,
    storeSlug: siteConfig.storeSlug,
    skipCache,
  })

  // Get chrry store
  const chrryStore = await getStore({
    domain: siteConfig.store,
    userId: member?.id,
    guestId: guest?.id,
    depth: 1,
    skipCache,
  })

  // Parse app/store slugs from pathname
  let { appSlug: appSlugGenerated, storeSlug: storeSlugGenerated } =
    getAppAndStoreSlugs(pathname, {
      defaultAppSlug: siteConfig.slug,
      defaultStoreSlug: siteConfig.storeSlug,
    })

  // Override with params if provided
  if (appSlugParam) appSlugGenerated = appSlugParam
  if (storeSlugParam) storeSlugGenerated = storeSlugParam

  // Check white label
  const whiteLabel = whiteLabels.find(
    (label) => label.slug === appSlugGenerated && label.isStoreApp,
  )
  if (whiteLabel) {
    storeSlugGenerated = whiteLabel.storeSlug
  }

  // Resolve app (priority: appId > storeFromHeader > slug)
  const appInternal = accountApp
    ? guest
      ? await getAppDb({
          storeSlug: guest.id,
          guestId: guest.id,
          depth: 1,
          skipCache,
        })
      : member
        ? await getAppDb({
            storeSlug: member.userName,
            userId: member.id,
            depth: 1,
            skipCache,
          })
        : undefined
    : appId
      ? await getAppDb({
          id: appId,
          userId: member?.id,
          guestId: guest?.id,
          depth: 1,
          skipCache,
        })
      : storeFromRequest?.store?.appId
        ? await getAppDb({
            id: storeFromRequest.store.appId,
            userId: member?.id,
            guestId: guest?.id,
            depth: 1,
            skipCache,
          })
        : await getAppDb({
            slug: appSlugGenerated,
            storeSlug: storeSlugGenerated,
            userId: member?.id,
            guestId: guest?.id,
            depth: 1,
            skipCache,
          })

  if (!appInternal && accountApp) {
    return null
  }

  const store = appInternal?.store || chrryStore

  // Find base app
  const baseApp =
    store?.apps?.find(
      (app) =>
        app.slug === siteConfig.slug &&
        app.store?.slug === siteConfig.storeSlug,
    ) || store?.app

  // Get final app
  const app =
    appInternal ||
    (await getAppDb({
      id: baseApp?.id,
      userId: member?.id,
      guestId: guest?.id,
      depth: 1,
      skipCache,
    }))

  if (!app) {
    return null
  }

  // Enrich store.apps with store.app references
  if (app?.store?.apps?.length) {
    const currentStoreApps = app.store.apps || []
    const storeApps = [...currentStoreApps]

    const enrichedApps = await Promise.all(
      storeApps.map(async (storeApp) => {
        if (!storeApp) return null

        const isBaseApp = storeApp?.id === storeApp?.store?.appId

        let storeBaseApp: appWithStore | null = null
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
          const baseAppData = await getAppDb({
            id: storeApp.store.appId,
            userId: member?.id,
            guestId: guest?.id,
            skipCache,
            depth: 0,
          })
          storeBaseApp = baseAppData ?? null
        }

        return {
          ...storeApp,
          store: {
            ...storeApp?.store,
            app: storeBaseApp,
          },
        } as appWithStore
      }),
    )

    const validApps = enrichedApps.filter(Boolean) as appWithStore[]
    app.store.apps = validApps
  }

  // Add site app if not already in list
  if (
    app &&
    siteApp &&
    app.store?.apps &&
    !app.store.apps.some((a) => a.id === siteApp.id)
  ) {
    app.store.apps.push(siteApp)
  }

  return app
}
