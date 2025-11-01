"use client"

/**
 * Centralized exports for all context providers and hooks
 */

// Providers
export { ErrorProvider, useError } from "./ErrorProvider"
export { NavigationProvider, useNavigationContext } from "./NavigationProvider"
export { AuthProvider, useAuth } from "./AuthProvider"
export { ChatProvider, useChat } from "./ChatProvider"
export { DataProvider, useData } from "./DataProvider"
export { AppProvider, useApp } from "./AppProvider"
export { PlatformProvider } from "../../platform"

// Composition root - combines all providers
import React, { ReactNode, useState } from "react"
import { PlatformProvider } from "../../platform"
import { ThemeProvider } from "../ThemeContext"
import { StylesProvider } from "../StylesContext"
import { ErrorProvider } from "./ErrorProvider"
import { NavigationProvider } from "./NavigationProvider"
import { AuthProvider, session } from "./AuthProvider"
import { DataProvider } from "./DataProvider"
import { ChatProvider } from "./ChatProvider"
import { AppProvider } from "./AppProvider"
import { AppContextProvider } from "../AppContext"
import { locale } from "../../locales"
import useSWR, { SWRConfig } from "swr"
import { Hey } from "chrry/Sidebar"
import { thread, paginatedMessages } from "chrry/types"

interface AppProvidersProps {
  locale?: locale
  apiKey?: string
  children: ReactNode
  session?: session
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
  viewPortWidth?: string
  viewPortHeight?: string
  useExtensionIcon?: (slug?: string) => void
  thread?: { thread: thread; messages: paginatedMessages }
}

/**
 * Centralized provider composition
 * Order matters: providers with no dependencies should be outer,
 * providers with dependencies should be inner
 */
export default function AppProviders({
  children,
  session,
  onSetLanguage,
  apiKey,
  signInContext,
  signOutContext,
  viewPortWidth,
  viewPortHeight,
  thread,
  locale,
  useExtensionIcon,
}: AppProvidersProps) {
  const [error, setError] = useState("")
  // Global SWR configuration with 429 error handling
  const swrConfig = {
    onError: (error: any) => {
      if (error?.status === 429) {
        // const errorKey = `rate_limit_${Date.now()}`
        const lastShown = localStorage.getItem("last_rate_limit_toast")
        const now = Date.now()

        // Only show toast if it's been more than 30 seconds since last one
        if (!lastShown || now - parseInt(lastShown) > 30000) {
          setError(
            "Rate limit exceeded. Please wait a moment before trying again.",
          )
          localStorage.setItem("last_rate_limit_toast", now.toString())
        }
      }
    },
    onErrorRetry: (
      error: any,
      key: string,
      config: any,
      revalidate: any,
      { retryCount }: any,
    ) => {
      // Don't retry on 429 errors
      if (error?.status === 429) return

      // Default retry logic for other errors
      if (retryCount >= 3) return
      setTimeout(() => revalidate({ retryCount }), 5000)
    },
  }

  return (
    <SWRConfig value={swrConfig}>
      <PlatformProvider
        viewPortWidth={viewPortWidth}
        viewPortHeight={viewPortHeight}
        session={session}
      >
        <ErrorProvider>
          <ThemeProvider session={session}>
            <AuthProvider
              locale={locale}
              error={error}
              apiKey={apiKey}
              onSetLanguage={onSetLanguage}
              signInContext={signInContext}
              signOutContext={signOutContext}
              session={session}
            >
              <DataProvider session={session}>
                <AppProvider session={session}>
                  <ChatProvider thread={thread} session={session}>
                    <NavigationProvider session={session}>
                      <AppContextProvider>
                        <StylesProvider>
                          <Hey useExtensionIcon={useExtensionIcon}>
                            {children}
                          </Hey>
                        </StylesProvider>
                      </AppContextProvider>
                    </NavigationProvider>
                  </ChatProvider>
                </AppProvider>
              </DataProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorProvider>
      </PlatformProvider>
    </SWRConfig>
  )
}
