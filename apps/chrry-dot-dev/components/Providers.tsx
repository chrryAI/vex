"use client"

import "chrry/i18n"

import AppProviders from "chrry/context/providers"
import { createNavigation } from "next-intl/navigation"
import { defaultLocale, locale, locales } from "chrry/locales"
import { useLocalStorage } from "chrry/hooks"

import {
  signIn as signInContext,
  signOut as signOutContext,
} from "next-auth/react"
import { app } from "@repo/db"
import { Hey } from "chrry/Sidebar"
import { Suspense } from "react"
export function Providers({
  children,
  member,
  os,
  browser,
  session,
  agentName,
  device,
  fingerprint,
  deviceId,
  viewPortWidth,
  viewPortHeight,
  app,
}: {
  children: React.ReactNode
  member: any
  os?: string
  browser?: string
  session?: any
  device?: string
  isSmallDevice?: boolean
  isMobileDevice?: boolean
  isDrawerOpen?: boolean
  agentName?: string
  deviceId?: string
  viewPortWidth?: string
  viewPortHeight?: string
  fingerprint?: string
  app?: app
}) {
  const {
    // usePathname,
    useRouter: useI18nRouter,
  } = createNavigation({
    locales,
  })

  return (
    <AppProviders
      signInContext={(provider, options) => {
        return signInContext(provider, {
          blankTarget: true,
          callbackUrl: options.callbackUrl,
        })
      }}
      signOutContext={signOutContext}
      session={session}
      viewPortWidth={viewPortWidth}
      viewPortHeight={viewPortHeight}
    >
      {children}
    </AppProviders>
  )
}
