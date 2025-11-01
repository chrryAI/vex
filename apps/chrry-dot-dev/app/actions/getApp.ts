"use server"

import { headers } from "next/headers"
import { validate } from "uuid"
import { getApp, getApps as getAppsDB } from "@repo/db"
import { user, guest } from "@repo/db"

export default async function getAppAction({
  member,
  guest,
  ...rest
}: {
  member?: user
  guest?: guest
  appId?: string
  appSlug?: string
  routeType?: string
}) {
  const headersList = await headers()
  const appId = rest.appId || headersList.get("x-app-id")

  const appSlug = rest.appSlug || headersList.get("x-app-slug")
  const routeType = rest.routeType || headersList.get("x-route-type")

  let app = null

  // Fetch app if this is an app route
  if (routeType && (appId || appSlug)) {
    app =
      appId && validate(appId)
        ? await getApp({
            id: appId,
            userId: member?.id,
            guestId: guest?.id,
          })
        : undefined

    app = appSlug
      ? await getApp({
          slug: appSlug,
          userId: member?.id,
          guestId: guest?.id,
        })
      : undefined
  }

  return app
}

export async function getApps() {
  const apps = await getAppsDB()

  return apps
}
