import type { locale } from "@chrryai/chrry/locales"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import type { ReactNode } from "react"

interface LayoutProps {
  children: ReactNode
  locale?: locale
  theme?: "light" | "dark"
  appName?: string
  isDev?: boolean
  pathname?: string
}

export default function Layout({
  children,
  locale = "en",
  theme = "dark",
  appName = "Chrry",
  isDev = true,
  pathname = "/",
}: LayoutProps) {
  const siteConfig = getSiteConfig()
  const classnames = [theme].filter(Boolean).join(" ")

  return (
    <>
      {/* 
        Metadata is already server-rendered in index.html by server.js
        No need for client-side Helmet or API calls
      */}

      {/* Analytics script */}
      {!isDev && (
        <script
          defer
          data-domain={siteConfig.domain}
          src="https://a.chrry.dev/js/app.js"
        />
      )}

      {/* Main content */}
      <div className={classnames} data-chrry-url={siteConfig.url}>
        {children}
      </div>
    </>
  )
}
