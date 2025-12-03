"use server"

import { headers } from "next/headers"
import { getApp, getStore } from "@repo/db"
import { user, guest } from "@repo/db"
import getMember from "./getMember"
import getGuest from "./getGuest"
import { getSiteConfig, whiteLabels } from "chrry/utils/siteConfig"
import { appWithStore } from "chrry/types"
import getChrryUrl from "./getChrryUrl"
import { getAppAndStoreSlugs } from "chrry/utils/url"

export default async function getAppAction({
  request,
  ...rest
}: {
  member?: user
  guest?: guest
  appId?: string
  appSlug?: string
  routeType?: string
  storeSlug?: string
  chrryUrl?: string
  request?: Request
} = {}) {
  const member = await getMember()
  const guest = await getGuest()

  const headersList = request?.headers || (await headers())
  const appId = rest.appId || headersList.get("x-app-id")

  const path = headersList.get("x-pathname")

  const chrryUrl = rest.chrryUrl || (await getChrryUrl(request))

  const siteConfig = getSiteConfig(chrryUrl)

  const siteApp = await getApp({
    slug: siteConfig.slug,
    storeSlug: siteConfig.storeSlug,
  })

  const chrryStore = await getStore({
    domain: siteConfig.store,
    userId: member?.id,
    guestId: guest?.id,
    depth: 1, // Populate one level of nested store.apps
  })

  let { appSlug, storeSlug } = getAppAndStoreSlugs(path || "/", {
    defaultAppSlug: siteConfig.slug,
    defaultStoreSlug: siteConfig.storeSlug,
  })

  if (rest.appSlug) {
    appSlug = rest.appSlug
  }
  if (rest.storeSlug) {
    storeSlug = rest.storeSlug
  }
  // if (!chrryStore || !chrryStore.app || !chrryStore.store) {
  //   return null
  // }

  const appInternal = appId
    ? await getApp({
        id: appId,
        userId: member?.id,
        guestId: guest?.id,
        depth: 1,
      })
    : await getApp({
        slug: appSlug,
        storeSlug: storeSlug,
        userId: member?.id,
        guestId: guest?.id,
        depth: 1,
      })

  const store = appInternal?.store || chrryStore

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
  const app =
    appInternal ||
    (await getApp({
      id: baseApp?.id,
      userId: member?.id,
      guestId: guest?.id,
      depth: 1,
    }))

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

export const getWhiteLabel = async ({ app }: { app: appWithStore }) => {
  let whiteLabel = whiteLabels.find(
    (label) => label.storeSlug === app.store?.slug && label.isStoreApp,
  )

  const storeApp = whiteLabel
    ? app?.store?.apps.find(
        (a) =>
          a.slug === whiteLabel?.slug &&
          a.store?.slug === whiteLabel?.storeSlug,
      )
    : undefined

  if (storeApp) {
    return storeApp
  }

  const chrryUrl = await getChrryUrl()

  const siteConfig = getSiteConfig(chrryUrl)

  if (!whiteLabel) {
    const baseApp = await getApp({
      slug: siteConfig.slug,
      storeSlug: siteConfig.storeSlug,
      depth: 1,
    })

    if (baseApp) {
      whiteLabel = whiteLabels.find(
        (label) => label.storeSlug === baseApp.store?.slug && label.isStoreApp,
      )

      if (!baseApp) {
        return baseApp
      }
    }
  }

  return await getAppAction({
    storeSlug: whiteLabel?.storeSlug,
    appSlug: whiteLabel?.slug,
  })
}
