"use server"

import { headers } from "next/headers"
import { validate } from "uuid"
import { getApp, getStore } from "@repo/db"
import { user, guest } from "@repo/db"
import getMember from "./getMember"
import getGuest from "./getGuest"
import { getSiteConfig } from "chrry/utils/siteConfig"
import { excludedSlugRoutes, getAppAndStoreSlugs } from "chrry/utils/url"
import { locales } from "chrry/locales"
import { appWithStore } from "chrry/types"
import getChrryUrl from "./getChrryUrl"

export default async function getAppAction({
  ...rest
}: {
  member?: user
  guest?: guest
  appId?: string
  appSlug?: string
  routeType?: string
  chrryUrl?: string
} = {}) {
  const member = await getMember()
  const guest = await getGuest()

  const headersList = await headers()
  const appId = rest.appId || headersList.get("x-app-id")

  const appSlug = rest.appSlug || headersList.get("x-app-slug")

  const chrryUrl = rest.chrryUrl || (await getChrryUrl())

  const siteConfig = getSiteConfig(chrryUrl)

  const baseConfig = getSiteConfig()

  const siteApp = await getApp({
    slug: baseConfig.slug,
    storeSlug: baseConfig.storeSlug,
  })

  const chrryStore = await getStore({
    domain: siteConfig.store,
    userId: member?.id,
    guestId: guest?.id,
    depth: 1, // Populate one level of nested store.apps
  })

  if (!chrryStore || !chrryStore.app || !chrryStore.store) {
    return null
  }

  const appFromParams = appId
    ? await getApp({
        id: appId,
        userId: member?.id,
        guestId: guest?.id,
        depth: 1,
      })
    : appSlug
      ? await getApp({
          slug: appSlug,
          userId: member?.id,
          guestId: guest?.id,
          depth: 1,
        })
      : undefined

  const store = appFromParams?.store || chrryStore

  // Find base app by siteConfig.slug (e.g., "focus" for focus.chrry.ai)
  // This may differ from store's default app (store.app)
  const baseApp =
    store?.apps?.find(
      (app) =>
        app.slug === siteConfig.slug &&
        app.store?.slug === siteConfig.storeSlug,
    ) || store?.app

  // If no slug param, use store's default app directly
  // Otherwise fetch by slug
  let app = await getApp({
    id: appFromParams?.id || baseApp?.id,
    userId: member?.id,
    guestId: guest?.id,
    depth: 1,
  })

  if (app?.store?.apps?.length) {
    const currentStoreApps = app.store?.apps || []

    // Get apps from different parent stores for quick navigation

    // Combine: current store apps + apps from different parent stores
    const storeApps = [...currentStoreApps]

    // Enrich each app with store.app reference
    const enrichedApps = await Promise.all(
      storeApps.map(async (app) => {
        if (!app) return null

        const isBaseApp = app?.id === app?.store?.appId

        let storeBaseApp: appWithStore | null = null
        if (isBaseApp) {
          // Self-reference for base apps
          storeBaseApp =
            (await getApp({
              id: app?.id,
              userId: member?.id,
              guestId: guest?.id,
              depth: 1,
            })) || null
        } else if (app?.store?.appId) {
          const baseAppData = await getApp({
            id: app?.store?.appId,
            userId: member?.id,
            guestId: guest?.id,
            depth: 0,
          })
          storeBaseApp = baseAppData ?? null
        }

        return {
          ...app,
          store: {
            ...app?.store,
            app: storeBaseApp,
          },
        } as appWithStore
      }),
    )

    const validApps = enrichedApps.filter(Boolean) as appWithStore[]
    app.store.apps = validApps
  }

  if (
    app &&
    siteApp &&
    app.store?.apps &&
    !app.store?.apps?.some((app) => app.id === siteApp.id)
  ) {
    app.store.apps.push(siteApp)
  }

  return app
}
