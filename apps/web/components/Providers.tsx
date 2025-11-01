"use client"

import "chrry/i18n"

import { createNavigation } from "next-intl/navigation"
import { defaultLocale, locale, locales } from "chrry/locales"
import { useLocalStorage } from "chrry/hooks"
import Chrry from "chrry/Chrry"
import { thread, paginatedMessages } from "chrry/types"

import {
  signIn as signInContext,
  signOut as signOutContext,
} from "next-auth/react"
import { NextIntlClientProvider } from "next-intl"

export function Providers({
  children,
  apiKey,
  viewPortWidth,
  viewPortHeight,
  thread,
  session,
}: {
  children: React.ReactNode
  apiKey?: string
  viewPortWidth?: string
  viewPortHeight?: string
  session?: any
  thread?: { thread: thread; messages: paginatedMessages }
}) {
  const { useRouter: useI18nRouter } = createNavigation({ locales })
  const i18nRouter = useI18nRouter()

  const [language, setLanguage] = useLocalStorage<locale>(
    "language",
    session?.locale || defaultLocale,
  )

  return (
    <NextIntlClientProvider messages={{}} locale={language}>
      <Chrry
        apiKey={apiKey}
        viewPortWidth={viewPortWidth}
        viewPortHeight={viewPortHeight}
        thread={thread}
        session={session}
        onSetLanguage={(path, lang) => {
          setLanguage(lang)
          i18nRouter.replace(path, { locale: lang })
        }}
        signInContext={(provider, options) => {
          return signInContext(provider, {
            blankTarget: true,
            callbackUrl: options.callbackUrl,
          })
        }}
        signOutContext={signOutContext}
      >
        {children}
      </Chrry>
    </NextIntlClientProvider>
  )
}
