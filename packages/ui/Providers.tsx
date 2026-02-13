"use client"
import "./i18n"
import AppProviders from "./context/providers"

export function Providers({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return <AppProviders>{children}</AppProviders>
}
