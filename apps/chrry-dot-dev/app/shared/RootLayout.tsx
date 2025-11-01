import "chrry/globals.scss"
import "chrry/globals.css"
import "chrry/styles/view-transitions.css"

import { ReactNode } from "react"
import { NextIntlClientProvider } from "next-intl"
import { ViewTransitions } from "next-view-transitions"
import Script from "next/script"
import { session } from "chrry/types"

interface RootLayoutProps {
  children: ReactNode
  locale: string
  session: session | null
  viewPortWidth?: string
  viewPortHeight?: string
  agentName?: string
  deviceId?: string
  os?: string
  browser?: string
  device?: string
  enableAnalytics?: boolean
  analyticsId?: string
  conversionId?: string
  // Import these components from the consuming app
  Providers: any
  AppMetadata: any
  Splash?: any
  ServiceWorkerRegistration?: any
}

export default function RootLayout({
  children,
  locale,
  session,
  viewPortWidth,
  viewPortHeight,
  agentName,
  deviceId,
  os,
  browser,
  device,
  enableAnalytics = false,
  analyticsId,
  conversionId,
  Providers,
  AppMetadata,
  Splash,
  ServiceWorkerRegistration,
}: RootLayoutProps) {
  const cookieConsent =
    typeof window !== "undefined"
      ? localStorage.getItem("cookieConsent") === "true"
      : false

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <AppMetadata app={session?.app} />

        {enableAnalytics && cookieConsent && (
          <>
            {analyticsId && (
              <>
                <Script
                  src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`}
                  strategy="afterInteractive"
                />
                <Script id="google-analytics" strategy="afterInteractive">
                  {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${analyticsId}');
                  `}
                </Script>
              </>
            )}

            {conversionId && (
              <>
                <Script
                  async
                  src={`https://www.googletagmanager.com/gtag/js?id=${conversionId}`}
                />
                <Script id="google-conversion" strategy="afterInteractive">
                  {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){window.dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${conversionId}');
                    
                    gtag('event', 'conversion', {
                        'send_to': '${conversionId}/Pv8hCICswIQbEKXX1IdB',
                        'value': 1.0,
                        'currency': 'EUR'
                    });
                  `}
                </Script>
              </>
            )}
          </>
        )}
      </head>

      <body className="loaded" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={{}}>
          <ViewTransitions>
            <Providers
              viewPortWidth={viewPortWidth}
              viewPortHeight={viewPortHeight}
              agentName={agentName}
              deviceId={deviceId}
              session={session}
              os={os}
              browser={browser}
              device={device}
            >
              {children}
            </Providers>
          </ViewTransitions>
        </NextIntlClientProvider>

        {Splash && <Splash />}
        {ServiceWorkerRegistration && <ServiceWorkerRegistration />}
      </body>
    </html>
  )
}
