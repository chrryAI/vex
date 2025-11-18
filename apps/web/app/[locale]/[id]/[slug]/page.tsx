import { getStore } from "@repo/db"
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
import { getTranslations } from "chrry/lib"
import getApp from "../../../actions/getApp"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string; locale: string }>
}): Promise<Metadata> {
  const { id, slug, locale } = await params

  // Note: Reserved paths (threads, about, etc.) are handled by middleware
  // and never reach this route. This page only handles store apps.

  // Find the app in the store by slug
  const app = await getApp()
  if (!app) {
    return notFound()
  }

  const translations = await getTranslations({ locale })

  // Get the current domain from request headers
  const headersList = await headers()
  const host = headersList.get("host") || "chrry.ai"
  const protocol = host.includes("localhost") ? "http" : "https"
  const currentDomain = `${protocol}://${host}`

  return generateAppMetadata({
    translations,
    app,
    locale,
    currentDomain,
  })
}

export default async function AppInStorePage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>
}) {
  const app = await getApp()
  if (!app) {
    return notFound()
  }

  // Render the Home component with the app from the store
  return <Home />
}
