"use server"

import { headers } from "next/headers"
import { validate } from "uuid"
import { getApp } from "@repo/db"
import { user, guest } from "@repo/db"
import getMember from "./getMember"
import getGuest from "./getGuest"

export default async function getAppAction({
  ...rest
}: {
  member?: user
  guest?: guest
  appId?: string
  appSlug?: string
  routeType?: string
} = {}) {
  const member = await getMember()
  const guest = await getGuest()

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
