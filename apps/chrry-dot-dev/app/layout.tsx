import "chrry/globals.scss"
import "chrry/globals.css"
import "chrry/styles/view-transitions.css"

import getMember from "./actions/getMember"
import { Providers } from "../components/Providers"
import { getMetadata } from "../utils"

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const currentMember = await getMember()

  return (
    <html
      lang="en"
      className={"dark red"}
      suppressHydrationWarning
      translate="no"
    >
      {/* <ServiceWorkerRegistration /> */}
      <head>{/* <AppMetadata app={sessionData?.app} /> */}</head>
      <body className="loaded" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
