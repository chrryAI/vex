import React from "react"
import AppProviders from "./context/providers"
import { session, thread, paginatedMessages } from "chrry/types"
import { locale } from "./locales"

export default function Chrry({
  children,
  session,
  thread,
  viewPortWidth,
  viewPortHeight,
  onSetLanguage,
  signInContext,
  apiKey,
  signOutContext,
  locale,
  useExtensionIcon,
}: {
  useExtensionIcon?: (slug?: string) => void
  locale?: locale
  thread?: { thread: thread; messages: paginatedMessages }
  apiKey?: string
  children?: React.ReactNode
  session?: session
  viewPortWidth?: string
  viewPortHeight?: string
  onSetLanguage?: (pathWithoutLocale: string, language: locale) => void
  signInContext?: (
    provider: "google" | "apple" | "credentials",
    options: {
      email?: string
      password?: string
      redirect?: boolean
      callbackUrl: string
      errorUrl?: string
      blankTarget?: boolean
    },
  ) => Promise<any>
  signOutContext?: (options: {
    callbackUrl: string
    errorUrl?: string
  }) => Promise<any>
}) {
  return (
    <AppProviders
      useExtensionIcon={useExtensionIcon}
      locale={locale}
      session={session}
      viewPortWidth={viewPortWidth}
      viewPortHeight={viewPortHeight}
      onSetLanguage={onSetLanguage}
      signInContext={signInContext}
      apiKey={apiKey}
      signOutContext={signOutContext}
      thread={thread}
    >
      {children}
    </AppProviders>
  )
}
