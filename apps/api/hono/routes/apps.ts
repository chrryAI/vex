import { Hono } from "hono"
import { getApp as getAppDb, getStore } from "@repo/db"
import { getMember, getGuest } from "../lib/auth"
import { getChrryUrl } from "../lib/getChrryUrl"
import { getSiteConfig, whiteLabels } from "chrry/utils/siteConfig"
import { getAppAndStoreSlugs } from "chrry/utils/url"
import { appWithStore } from "chrry/types"

export const apps = new Hono()

// GET /apps - Intelligent app resolution (no ID)
apps.get("/", async (c) => {
  const request = c.req.raw

  const member = await getMember(request, { full: true, skipCache: true })
  const guest = !member
    ? await getGuest(request, { skipCache: true })
    : undefined

  // Get query parameters
  const appIdParam = c.req.query("appId")
  const appSlugParam = c.req.query("appSlug")
  const storeSlugParam = c.req.query("storeSlug")
  const chrryUrlParam = c.req.query("chrryUrl")

  // Get headers
  const appIdHeader = request.headers.get("x-app-id")
  const storeSlugHeader = request.headers.get("x-app-slug")
  const pathname = request.headers.get("x-pathname")

  // Determine appId (priority: param > header)
  const appId = appIdParam || appIdHeader || undefined

  // Get store from header if provided
  const storeFromHeader = storeSlugHeader
    ? await getStore({
        slug: storeSlugHeader,
        userId: member?.id,
        guestId: guest?.id,
        depth: 1,
      })
    : null

  // Get chrryUrl
  const chrryUrl = chrryUrlParam || (await getChrryUrl(request))
  const siteConfig = getSiteConfig(chrryUrl)

  // Get site app
  const siteApp = await getAppDb({
    slug: siteConfig.slug,
    storeSlug: siteConfig.storeSlug,
  })

  // Get chrry store
  const chrryStore = await getStore({
    domain: siteConfig.store,
    userId: member?.id,
    guestId: guest?.id,
    depth: 1,
  })

  // Parse app/store slugs from pathname
  let { appSlug, storeSlug } = getAppAndStoreSlugs(pathname || "/", {
    defaultAppSlug: siteConfig.slug,
    defaultStoreSlug: siteConfig.storeSlug,
  })

  // Override with params if provided
  if (appSlugParam) appSlug = appSlugParam
  if (storeSlugParam) storeSlug = storeSlugParam

  // Check white label
  const whiteLabel = whiteLabels.find(
    (label) => label.slug === appSlug && label.isStoreApp,
  )
  if (whiteLabel) {
    storeSlug = whiteLabel.storeSlug
  }

  // Resolve app (priority: appId > storeFromHeader > slug)
  const appInternal = appId
    ? await getAppDb({
        id: appId,
        userId: member?.id,
        guestId: guest?.id,
        depth: 1,
      })
    : storeFromHeader?.store?.appId
      ? await getAppDb({
          id: storeFromHeader.store.appId,
          userId: member?.id,
          guestId: guest?.id,
          depth: 1,
        })
      : await getAppDb({
          slug: appSlug,
          storeSlug: storeSlug,
          userId: member?.id,
          guestId: guest?.id,
          depth: 1,
        })

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
    }))

  if (!app) {
    return c.json({ error: "App not found" }, 404)
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
            })) || null
        } else if (storeApp?.store?.appId) {
          const baseAppData = await getAppDb({
            id: storeApp.store.appId,
            userId: member?.id,
            guestId: guest?.id,
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

  return c.json(app)
})

// GET /apps/:id - Get single app by ID
apps.get("/:id", async (c) => {
  const id = c.req.param("id")
  const request = c.req.raw

  const member = await getMember(request, { full: true, skipCache: true })
  const guest = !member
    ? await getGuest(request, { skipCache: true })
    : undefined

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const app = await getAppDb({
    id,
    userId: member?.id,
    guestId: guest?.id,
    depth: 1,
  })

  if (!app) {
    return c.json({ error: "App not found" }, 404)
  }

  return c.json(app)
})
