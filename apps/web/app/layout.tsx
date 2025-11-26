import type { ReactElement, ReactNode } from "react"
import { getMember } from "chrrydotdev"
import { v4 as uuidv4 } from "uuid"

import {
  deleteCreditUsage,
  deleteMessage,
  deleteSubscription,
  deleteThread,
  getGuest as getGuestDb,
  getMessages,
  getSubscriptions,
  getThreads,
  getUser,
  getApp,
  updateGuest,
  updateThread,
  updateUser,
  migrateUser,
} from "@repo/db"

import { getLocale } from "next-intl/server"
import { locale } from "chrry/locales"
import { cookies, headers } from "next/headers"

import {
  TEST_GUEST_FINGERPRINTS,
  TEST_MEMBER_EMAILS,
  TEST_MEMBER_FINGERPRINTS,
} from "@repo/db"

import { generateAppMetadata } from "chrry/utils"
import { Providers } from "../components/Providers"
import { NextIntlClientProvider } from "next-intl"
import { getSiteConfig } from "chrry/utils/siteConfig"
import { getTranslations } from "chrry/lib"
import ChrryAI, { generateMeta } from "./ChrryAI"
import { getThreadId } from "chrry/utils"
import { threadId } from "worker_threads"
import cleanupTest from "../lib/cleanupTest"

export const generateMetadata = async () => {
  const headersList = await headers()
  const hostname = headersList.get("host") || ""

  const pathname = headersList.get("x-pathname") || ""

  const threadId = getThreadId(pathname)

  const siteConfig = getSiteConfig(hostname)
  const locale = (await getLocale()) as locale

  const app = await getApp({
    slug: siteConfig.slug,
    storeDomain: siteConfig.store,
    depth: 1, // Populate one level of nested store.apps
  })

  if (!app || !app.store) {
    return generateMeta({ locale })
  }

  const translations = await getTranslations({ locale })

  return generateAppMetadata({
    translations,
    locale,
    app,
    store: app.store,
    currentDomain: siteConfig.url,
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

  const url = headersList.get("x-url") || ""
  const isCheckout = url.includes("checkout")

  if (!threadId && fingerprint && !isCheckout) {
    await cleanupTest({
      fingerprint: fingerprint,
    })
  }

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
