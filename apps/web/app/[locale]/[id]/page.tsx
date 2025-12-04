import Home from "chrry/Home"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import Sidebar from "chrry/Sidebar"
import { headers } from "next/headers"
import { generateAppMetadata, generateStoreMetadata } from "chrry/utils"
import { getTranslations } from "chrry/lib"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { validate } from "uuid"
import Store from "chrry/Store"
import React from "react"
import { getApp, getStore } from "@repo/db"
import { storeWithApps } from "chrry/types"

export default async function AppPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const member = await getMember()
  const guest = await getGuest()

  // Check if it's a store first
  const store = !validate(id)
    ? await getStore({ slug: id, userId: member?.id, guestId: guest?.id })
    : await getStore({ id, userId: member?.id, guestId: guest?.id })

  if (store) {
    const baseApp = await getApp({
      id: store?.app?.id,
      userId: member?.id,
      guestId: guest?.id,
      depth: 1,
    })
    if (!baseApp) {
      return notFound()
    }

    return (
      <>
        <Store store={baseApp.store as unknown as storeWithApps} />
      </>
    )
  }

  // Otherwise, try to load as an app
  const app = validate(id)
    ? await getApp({ id, userId: member?.id, guestId: guest?.id })
    : await getApp({ slug: id, userId: member?.id, guestId: guest?.id })

  if (!app) {
    return notFound()
  }

  return <Home />
}
