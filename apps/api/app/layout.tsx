import "chrry/globals.scss"
import "chrry/globals.css"
import "chrry/styles/view-transitions.css"

import { getMetadata } from "../utils"
import { isE2E } from "chrry/utils"

export const generateMetadata = async () => {
  return getMetadata({
    title: "Chrry API - AI-Powered Platform Infrastructure",
    description:
      "Core API infrastructure for Chrry platform. Real-time WebSocket communication, guest-first architecture, and AI-powered tools including analytics, calendar, and productivity features.",
    keywords: [
      "chrry api",
      "ai platform",
      "websocket api",
      "real-time api",
      "guest-first architecture",
      "ai infrastructure",
      "chrry",
      "platform api",
    ],
    locale: "en",
  })
}

const isDevelopment = process.env.NODE_ENV === "development"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={"dark red"}
      suppressHydrationWarning
      translate="no"
    >
      <head>
        <>
          {isDevelopment || isE2E ? null : (
            <script
              defer
              data-domain="chrry.dev"
              src="https://a.chrry.dev/js/app.js"
            />
          )}
        </>
      </head>
      <body className="loaded" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
