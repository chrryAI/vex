import "chrry/globals.scss"
import "chrry/globals.css"
import "chrry/styles/view-transitions.css"

import type { ReactElement, ReactNode } from "react"
import { v4 as uuidv4 } from "uuid"
import AppMetadata from "./AppMetadata"
import { locale, locales } from "./locales"
import { getMetadata, VERSION, getThreadId, pageSizes, API_URL } from "./utils"

import { getSession, getThread, getTranslations } from "./lib"
import { getSiteConfig, getSiteTranslation } from "./utils/siteConfig"
import Chrry from "./Chrry"

import {
  appWithStore,
  paginatedMessages,
  session,
  sessionUser,
  thread,
} from "./types"

export const generateMeta = async ({ locale }: { locale: locale }) => {
  const siteConfig = getSiteConfig()
  const t = getSiteTranslation(siteConfig.mode, locale)

  return getMetadata({
    title: t.title,
    description: t.description,
    locale,
  })
}

type WrapperProps = {
  children: ReactNode
  apiKey?: string
  viewPortWidth?: string
  viewPortHeight?: string
  session?: session
  translations?: Record<string, any>
  locale?: locale
  thread?: { thread: thread; messages: paginatedMessages }
}

export default async function ChrryAI({
  children,
  apiKey,
  locale,
  headersList,
  cookieStore,
  Wrapper = ({
    children,
    apiKey,
    viewPortWidth,
    viewPortHeight,
    session,
    translations,
    locale,
    thread,
  }: WrapperProps): ReactElement => (
    <Chrry
      thread={thread}
      locale={locale}
      apiKey={apiKey}
      viewPortWidth={viewPortWidth}
      viewPortHeight={viewPortHeight}
      session={session}
      translations={translations}
    >
      {children}
    </Chrry>
  ),
}: {
  children: ReactNode
  apiKey: string
  Wrapper?: (props: WrapperProps) => ReactElement
  locale: locale

  headersList: {
    get(key: string): string | null
  }

  cookieStore: {
    get(key: string): { readonly value?: string } | undefined
  }
}): Promise<ReactElement> {
  const pathname = headersList.get("x-pathname") || ""

  const threadId = getThreadId(pathname)

  const thread = threadId
    ? await getThread({
        id: threadId,
        pageSize: pageSizes.threads,
        token: apiKey,
      })
    : undefined

  const isDev = process.env.NODE_ENV === "development"

  const deviceId =
    cookieStore.get("deviceId")?.value ||
    headersList.get("x-device-id") ||
    uuidv4()

  const hostname = headersList.get("host") || ""

  const fingerprint =
    cookieStore.get("fingerprint")?.value || headersList.get("x-fp") || uuidv4()

  const agentName = cookieStore.get("agentName")?.value

  const appId =
    thread?.thread?.appId || headersList.get("x-app-id") || undefined
  const appSlug =
    thread?.thread?.app?.slug || headersList.get("x-app-slug") || "vex"

  const routeType = headersList.get("x-route-type") || undefined

  const viewPortWidth = cookieStore.get("viewPortWidth")?.value || ""
  const viewPortHeight = cookieStore.get("viewPortHeight")?.value || ""

  // Check for app route from middleware
  const siteConfig = getSiteConfig(hostname)

  let session:
    | session
    | {
        error?: string
        status?: number
      }
    | undefined
  let translations: Record<string, any> | undefined
  let apiError: Error | null = null

  try {
    const [sessionResult, translationsResult] = await Promise.all([
      getSession({
        appId,
        deviceId,
        fingerprint,
        token: apiKey,
        appSlug,
        agentName,
        pathname,
        routeType,
        translate: true,
        locale,
        chrryUrl: siteConfig.url,
        screenWidth: Number(viewPortWidth),
        screenHeight: Number(viewPortHeight),
        source: "layout",
        userAgent: headersList.get("user-agent") || `Chrry/${VERSION}`,
      }),

      getTranslations({
        token: apiKey,
        locale,
      }),
    ])

    session = sessionResult
    translations = translationsResult
  } catch (error) {
    console.error("❌ API Error:", error)
    apiError = error as Error
  }

  // Show detailed error page if API failed
  if (apiError) {
    return (
      <html lang={locale}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>API Connection Error</title>
          <style>{`
            body, html {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
              background: #0a0a0a;
              color: #e5e5e5;
            }
            .error-container {
              background: #1a1a1a;
              border: 1px solid #333;
              border-radius: 8px;
              padding: 24px;
            }
            h1 {
              color: #ef4444;
              margin: 0 0 16px 0;
              font-size: 24px;
            }
            .error-message {
              background: #2a2a2a;
              padding: 16px;
              border-radius: 4px;
              margin: 16px 0;
              font-family: monospace;
              font-size: 14px;
              overflow-x: auto;
            }
            .info-section {
              margin: 16px 0;
              padding: 12px;
              background: #1f1f1f;
              border-radius: 4px;
            }
            .info-section strong {
              color: #60a5fa;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
              margin-left: 8px;
            }
            .status-error {
              background: #ef4444;
              color: white;
            }
            ul {
              margin: 8px 0;
              padding-left: 20px;
            }
            li {
              margin: 4px 0;
            }
            code {
              background: #2a2a2a;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 13px;
            }
          `}</style>
        </head>
        <body>
          <div className="error-container">
            <h1>🚨 API Connection Error</h1>
            <p>Unable to connect to the API server. This usually means:</p>

            <div className="info-section">
              <strong>API Endpoint:</strong> <code>{API_URL}</code>
              <span className="status-badge status-error">UNREACHABLE</span>
            </div>

            <div className="error-message">
              <strong>Error:</strong> {apiError.message}
            </div>

            <div className="info-section">
              <strong>Common Causes:</strong>
              <ul>
                <li>DNS not propagated yet (wait 5-10 minutes)</li>
                <li>API server is down or restarting</li>
                <li>Cloudflare DNS records not configured correctly</li>
                <li>SSL/TLS certificate issues</li>
                <li>CORS configuration blocking the request</li>
              </ul>
            </div>

            <div className="info-section">
              <strong>Debug Info:</strong>
              <ul>
                <li>
                  <strong>Site:</strong> {siteConfig.url}
                </li>
                <li>
                  <strong>Hostname:</strong> {hostname}
                </li>
                <li>
                  <strong>App Slug:</strong> {appSlug || "(none)"}
                </li>
                <li>
                  <strong>Locale:</strong> {locale}
                </li>
                <li>
                  <strong>Version:</strong> {VERSION}
                </li>
              </ul>
            </div>

            <div className="info-section">
              <strong>Quick Fixes:</strong>
              <ul>
                <li>
                  Check if <code>{API_URL.replace("/api", "")}</code> is
                  accessible
                </li>
                <li>Verify Cloudflare DNS records for both domains</li>
                <li>Check API server logs in Coolify</li>
                <li>Restart the web app to clear DNS cache</li>
              </ul>
            </div>
          </div>
        </body>
      </html>
    )
  }

  // Show session error if API returned an error
  if (session && "error" in session) {
    console.error("Session error:", session.error)
    return (
      <html lang={locale}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Session Error</title>
        </head>
        <body
          style={{
            fontFamily: "system-ui",
            padding: "40px",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          <h1 style={{ color: "#ef4444" }}>Session Error</h1>
          <p>{session.error}</p>
          <p style={{ fontSize: "14px", color: "#666" }}>
            Status: {session.status}
          </p>
        </body>
      </html>
    )
  }

  let app: appWithStore | undefined

  let user: sessionUser | undefined

  if (session && "app" in session) {
    app = session.app
  }

  if (session && "user" in session) {
    user = session.user
  }

  const theme = app?.backgroundColor === "#ffffff" ? "light" : "dark" // Fallback to dark black

  const classnames = [theme, app?.themeColor].filter(Boolean).join(" ")

  return (
    <html
      role="application"
      lang={locale}
      className={classnames}
      aria-label={app?.name}
      suppressHydrationWarning
      translate="no"
    >
      {/* <ServiceWorkerRegistration /> */}
      <head suppressHydrationWarning>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content"
        />
        {/* Disable Google Translate to prevent hydration mismatches */}
        <meta name="google" content="notranslate" />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />

        <AppMetadata app={app} />
        {!isDev && user?.role !== "admin" && (
          <>
            <script
              defer
              data-domain={siteConfig.domain}
              src="https://a.chrry.dev/js/app.js"
            />
          </>
        )}
      </head>
      <body className="loaded" suppressHydrationWarning>
        <Wrapper
          thread={thread}
          apiKey={apiKey}
          viewPortWidth={viewPortWidth}
          viewPortHeight={viewPortHeight}
          translations={translations}
          session={session && "app" in session ? session : undefined}
          locale={locale}
        >
          {children}
        </Wrapper>
      </body>
    </html>
  )
}
