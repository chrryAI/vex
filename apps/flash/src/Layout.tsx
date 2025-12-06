import { ReactNode } from "react"
import { getSiteConfig } from "chrry/utils/siteConfig"
import { locale } from "chrry/locales"

interface LayoutProps {
  children: ReactNode
  locale?: locale
  theme?: "light" | "dark"
  appName?: string
  isDev?: boolean
}

export default function Layout({
  children,
  locale = "en",
  theme = "dark",
  appName = "Chrry",
  isDev = true,
}: LayoutProps) {
  const siteConfig = getSiteConfig()

  // These would normally come from your API/server
  // For Vite, you'll need to handle data fetching client-side or via SSR context
  const classnames = [theme].filter(Boolean).join(" ")

  return (
    <>
      {/* Head metadata - in Vite, use react-helmet-async or similar */}
      <div id="meta-tags" style={{ display: "none" }}>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta name="google" content="notranslate" />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
      </div>

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
