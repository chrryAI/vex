import type { ReactElement, ReactNode } from "react"
import { getMember } from "chrrydotdev"
import { v4 as uuidv4 } from "uuid"

import {
  getGuest as getGuestDb,
  migrateUser,
  getThread,
  getStore,
  getApp as getAppDb,
} from "@repo/db"

import { getLocale } from "next-intl/server"
import { locale } from "chrry/locales"
import { cookies, headers } from "next/headers"

import {
  generateAppMetadata,
  generateStoreMetadata,
  generateThreadMetadata,
} from "chrry/utils"
import { Providers } from "../components/Providers"
import { NextIntlClientProvider } from "next-intl"
import { getSiteConfig } from "chrry/utils/siteConfig"
import { getTranslations } from "chrry/lib"
import ChrryAI, { generateMeta } from "./ChrryAI"
import { getThreadId } from "chrry/utils"
import getApp from "./actions/getApp"
import { getWhiteLabel } from "chrry-dot-dev/app/actions/getApp"

export const generateMetadata = async () => {
  const headersList = await headers()
  const hostname = headersList.get("host") || ""
  const siteConfig = getSiteConfig(hostname)

  const pathname = headersList.get("x-pathname") || ""

  const threadId = getThreadId(pathname)
  const locale = (await getLocale()) as locale

  const thread = threadId ? await getThread({ id: threadId }) : undefined

  const translations = await getTranslations({ locale })

  if (thread) {
    return generateThreadMetadata({
      thread: thread as any,
      locale,
      currentDomain: siteConfig.url,
      translations,
    })
  }

  // Only check for store if pathname is a single segment (e.g., /chrry, /vex)
  // Not empty and not multiple segments (e.g., /chrry/app)
  const pathSegments = pathname.split("/").filter(Boolean)
  const store =
    pathSegments.length === 1 && pathSegments[0] && pathSegments[0].length >= 3
      ? await getStore({ slug: pathSegments[0], depth: 1 })
      : null

  if (store) {
    const storeMetadata = generateStoreMetadata({
      store: (await getAppDb({ id: store.app?.id, depth: 1 }))?.store!,
      locale,
      currentDomain: siteConfig.url,
      translations,
    })

    console.log(storeMetadata, "storeMetadata")

    return storeMetadata
  }

  const app = await getApp()
  console.log(`🚀 ~ generateMetadata ~ app:`, app?.name)

  const whiteLabel = app ? await getWhiteLabel({ app }) : undefined
  console.log(
    `🚀 ~ generateMetadata ~ whiteLabel:`,
    whiteLabel?.store?.domain,
    app?.store?.domain,
  )

  if (!app || !app.store) {
    return generateMeta({ locale })
  }

  return generateAppMetadata({
    translations,
    locale,
    app,
    store: app.store,
    currentDomain: whiteLabel?.store?.domain || siteConfig.url,
    pathname,
    whiteLabel,
  })
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>): Promise<ReactElement> {
  const currentMember = await getMember()
  const headersList = await headers()

  const locale = (await getLocale()) as locale

  const cookieStore = await cookies()

  const fingerprint =
    cookieStore.get("fingerprint")?.value || headersList.get("x-fp") || uuidv4()

  const guest = await getGuestDb({ fingerprint: fingerprint })

  if (currentMember && !currentMember?.migratedFromGuest) {
    const toMigrate = currentMember.email
      ? (await getGuestDb({ email: currentMember.email })) || guest
      : guest

    if (toMigrate && !toMigrate?.migratedToUser) {
      await migrateUser({
        user: currentMember,
        guest: toMigrate,
      })

      currentMember.migratedFromGuest = true
    }
  }

  return (
    <NextIntlClientProvider locale={locale} messages={{}}>
      <ChrryAI
        Wrapper={Providers}
        apiKey={currentMember?.token || fingerprint}
        locale={locale as locale}
        headersList={headersList}
        cookieStore={cookieStore}
      >
        {children}
      </ChrryAI>
    </NextIntlClientProvider>
  )
}
