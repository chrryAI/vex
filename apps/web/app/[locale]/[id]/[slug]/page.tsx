import { getApp, getStore } from "@repo/db"
import Home from "chrry/Home"
import React from "react"
import getMember from "../../../actions/getMember"
import getGuest from "../../../actions/getGuest"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import { validate } from "uuid"
import { headers } from "next/headers"
import { generateAppMetadata } from "chrry/utils"
import { storeWithApps } from "chrry/types"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string; locale: string }>
}): Promise<Metadata> {
  const { id, slug, locale } = await params

  // Note: Reserved paths (threads, about, etc.) are handled by middleware
  // and never reach this route. This page only handles store apps.

  const member = await getMember()
  const guest = await getGuest()

  // id is the store slug/id, slug is the app slug
  const store = !validate(id)
    ? await getStore({ slug: id, userId: member?.id, guestId: guest?.id })
    : await getStore({ id, userId: member?.id, guestId: guest?.id })

  if (!store) {
    return {
      description: "The requested store could not be found.",
    }
  }

  // Find the app in the store by slug
  const app = !validate(id)
    ? store.apps?.find((a) => a.slug === slug)
    : await getApp({ id, userId: member?.id, guestId: guest?.id })

  if (!app) {
    return {
      description: "The requested app could not be found.",
    }
  }

  // Get the current domain from request headers
  const headersList = await headers()
  const host = headersList.get("host") || "chrry.ai"
  const protocol = host.includes("localhost") ? "http" : "https"
  const currentDomain = `${protocol}://${host}`

  return generateAppMetadata({
    app,
    store: store.store as unknown as storeWithApps,
    locale,
    currentDomain,
  })
}

export default async function AppInStorePage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>
}) {
  const { id, slug } = await params

  // Note: Reserved paths (threads, about, etc.) are handled by middleware
  // and never reach this route. This page only handles store apps.

  const member = await getMember()
  const guest = await getGuest()

  // id is the store slug/id, slug is the app slug
  const store = !validate(id)
    ? await getStore({ slug: id, userId: member?.id, guestId: guest?.id })
    : await getStore({ id, userId: member?.id, guestId: guest?.id })

  if (!store) {
    return notFound()
  }

  const app = !validate(id)
    ? store.apps?.find((a) => a.slug === slug)
    : await getApp({ id, userId: member?.id, guestId: guest?.id })

  if (!app) {
    return notFound()
  }

  // Render the Home component with the app from the store
  return <Home />
}
