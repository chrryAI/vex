import "chrry/globals.scss"
import "chrry/globals.css"
import "chrry/styles/view-transitions.css"

import { v4 as uuidv4 } from "uuid"

import AppMetadata from "./AppMetadata"
import { locale, locales } from "chrry/locales"
import {
  CHRRY_URL,
  getMetadata,
  VERSION,
  getThreadId,
  pageSizes,
} from "chrry/utils"
import { getSession, getImageSrc, getThread } from "chrry/lib"
import { getSiteConfig, getSiteTranslation } from "chrry/utils/siteConfig"
import Chrry from "./Chrry"
import { ReactNode } from "react"
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
    locale,
    thread,
  }) => (
    <Chrry
      thread={thread}
      locale={locale}
      apiKey={apiKey}
      viewPortWidth={viewPortWidth}
      viewPortHeight={viewPortHeight}
      session={session}
    >
      {children}
    </Chrry>
  ),
}: {
  children: React.ReactNode
  apiKey: string
  Wrapper?: (props: WrapperProps) => ReactNode
  locale: locale

  headersList: {
    get(key: string): string | null
  }

  cookieStore: {
    get(key: string): { readonly value?: string } | undefined
  }
}) {
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
  const siteConfig = getSiteConfig()

  // Call API session endpoint
  const session = await getSession({
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
    chrryUrl: CHRRY_URL,
    screenWidth: Number(viewPortWidth),
    screenHeight: Number(viewPortHeight),
    userAgent: headersList.get("user-agent") || `Chrry/${VERSION}`,
  })

  if (session && "error" in session) {
    console.error(session.error)
    return <div>{session.error}</div>
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
      <head>
        <link
          rel="apple-touch-icon"
          href={getImageSrc({ app, size: 128 }).src}
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href={getImageSrc({ app, size: 180 }).src}
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={app?.name} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-status-bar-style" content="default" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content"
        />
        {/* Disable Google Translate to prevent hydration mismatches */}
        <meta name="google" content="notranslate" />
        <link rel="sitemap" type="application/xml" href="/api/sitemap" />
        {!isDev && user?.role !== "admin" && (
          <>
            <script
              defer
              data-domain={siteConfig.domain}
              src="https://a.chrry.dev/js/app.js"
            />
          </>
        )}
        <AppMetadata app={app} />
      </head>
      <body className="loaded" suppressHydrationWarning>
        <Wrapper
          thread={thread}
          apiKey={apiKey}
          viewPortWidth={viewPortWidth}
          viewPortHeight={viewPortHeight}
          session={session && "app" in session ? session : undefined}
          locale={locale}
        >
          {children}
        </Wrapper>
      </body>
    </html>
  )
}
