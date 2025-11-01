"use client"
import React, { createContext, useContext, useRef } from "react"

import { useTranslation } from "react-i18next"
import { COLORS } from "./ThemeContext"
import { useAuth, useData } from "./providers"
import { getSiteConfig } from "../utils/siteConfig"

export { COLORS }

// Track missing keys to avoid duplicate API calls
const reportedMissingKeys = new Set<string>()
// Track all checked keys to avoid re-checking on every render
const checkedKeys = new Set<string>()

export type affiliateStats = {
  hasAffiliateLink: boolean
  code?: string
  affiliateLink?: string
  stats?: {
    clicks: number
    conversions: number
    totalRevenue: number
    commissionEarned: number
    commissionPaid: number
    commissionPending: number
    commissionRate: number
    status: string
  }
  referrals?: {
    total: number
    pending: number
    converted: number
    paid: number
  }
  createdOn?: string
  pendingPayout?: {
    id: string
    amount: number
    status: string
    requestedOn: string
  }
}

export type themeType = "dark" | "light"

export const MONTHLY_GUEST_CREDITS = 30

export const AppContext = createContext<{
  t: (key: string, values?: Record<string, any>, autoAdd?: boolean) => string
}>({
  t: (key: string, values?: Record<string, any>, autoAdd?: boolean) => key,
})

export const AppContextProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const { t: i18nT } = useTranslation()
  const { user } = useAuth()
  const isE2E = process.env.NEXT_PUBLIC_TESTING_ENV === "e2e"
  const isCI = process.env.NEXT_PUBLIC_CI === "true"

  // Get site config for dynamic app name
  const config = getSiteConfig()

  // Auto-append missing translation keys in dev mode
  const t = (key: string, values?: Record<string, any>, autoAdd = true) => {
    const result = i18nT(key, values)

    // Only check in dev mode and if we haven't checked this key before
    if (
      autoAdd &&
      !isCI &&
      isE2E &&
      user?.role === "admin" &&
      typeof window !== "undefined" &&
      !checkedKeys.has(key)
    ) {
      // Mark as checked to avoid re-checking on every render
      checkedKeys.add(key)

      // If translation key equals the result, it means it's missing
      if (result === key && !reportedMissingKeys.has(key)) {
        // Mark as reported to avoid duplicates
        reportedMissingKeys.add(key)

        // Send to API to append to en.json
        //   fetch("/api/translations/missing", {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify({ key, defaultValue: key }),
        //   }).catch((err) => {
        //     // Silent fail - don't break the app
        //     console.log("Failed to log missing translation:", key)
        //   })
      }
    }

    // 🎯 MAGIC: Replace "Vex" with dynamic app name from site config
    // This makes ALL translations white-label ready automatically!
    return result
      .replace(/Vex/g, config.name)
      .replace(/vex/g, config.name.toLowerCase())
  }

  return (
    <AppContext.Provider
      value={{
        t,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within a DriverProvider")
  }

  return context
}
