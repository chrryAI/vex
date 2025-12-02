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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string; locale: string }>
}): Promise<Metadata> {
  const { locale, id } = await params

  // Note: Reserved paths (threads, about, etc.) are handled by middleware
  // and never reach this route. This page only handles store apps.

  // Find the app in the store by slug
  const member = await getMember()
  const guest = await getGuest()

  // Check if it's a store first
  const store = !validate(id)
    ? await getStore({ slug: id, userId: member?.id, guestId: guest?.id })
    : await getStore({ id, userId: member?.id, guestId: guest?.id })

  const translations = await getTranslations({ locale })

  // Get the current domain from request headers
  const headersList = await headers()
  const host = headersList.get("host") || "chrry.ai"
  const protocol = host.includes("localhost") ? "http" : "https"
  const currentDomain = `${protocol}://${host}`

  if (store) {
    return generateStoreMetadata({
      translations,
      store: { ...store.store, apps: store.apps, app: store.app || null },
      locale,
      currentDomain,
    })
  }

  const app = validate(id)
    ? await getApp({ id, userId: member?.id, guestId: guest?.id })
    : await getApp({ slug: id, userId: member?.id, guestId: guest?.id })

  if (!app) {
    return notFound()
  }

  return generateAppMetadata({
    translations,
    app,
    locale,
    currentDomain,
  })
}

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
