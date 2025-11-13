"use client"

import { useMemo, type ReactElement } from "react"
import { app } from "@repo/db"
import { appWithStore } from "chrry/types"

// Simplified list of most common splash screens
const splashScreenConfigs = [
  // iPhone landscape
  {
    media:
      "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    file: "iPhone_16_Pro_Max_landscape.png",
  },
  {
    media:
      "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    file: "iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_landscape.png",
  },
  {
    media:
      "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    file: "iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro_landscape.png",
  },
  {
    media:
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    file: "iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_landscape.png",
  },
  // iPhone portrait
  {
    media:
      "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    file: "iPhone_16_Pro_Max_portrait.png",
  },
  {
    media:
      "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    file: "iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_portrait.png",
  },
  {
    media:
      "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    file: "iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro_portrait.png",
  },
  {
    media:
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    file: "iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png",
  },
]

export default function AppMetadata({
  app,
}: {
  app?: appWithStore | null
}): ReactElement {
  // Get slug from app prop, fallback to "vex"
  const slug = useMemo(() => app?.slug || "vex", [app?.slug])

  // Get title from app context, fallback to "Vex"
  const appTitle = useMemo(() => app?.title || "Vex", [app?.title])

  // Get icon from app context or use default
  const iconHref = useMemo(
    () =>
      slug === "vex"
        ? "/icons/icon-180.png"
        : `/images/apps/${slug.toLowerCase()}.png`,
    [slug],
  )

  const basePath = `/splash_screens/${slug}`
  const manifestPath =
    slug === "vex" ? undefined : `/manifests/${slug}.webmanifest`

  // Only show splash screens for vex (main app) - other apps may not have them
  const showSplashScreens = [
    "vex",
    "peach",
    "atlas",
    "bloom",
    "vault",
  ].includes(slug)

  return (
    <>
      {/* Manifest */}
      {manifestPath && (
        <link key="manifest" rel="manifest" href={manifestPath} />
      )}
      {/* App Icon */}
      <link key="apple-touch-icon" rel="apple-touch-icon" href={iconHref} />
      <link
        key="apple-touch-icon-180"
        rel="apple-touch-icon"
        sizes="180x180"
        href={iconHref}
      />
      {/* App Title */}
      <meta
        key="apple-mobile-web-app-title"
        name="apple-mobile-web-app-title"
        content={appTitle}
      />
      {/* Splash Screens - only for main app */}
      {showSplashScreens &&
        splashScreenConfigs.map((config, index) => (
          <link
            key={`splash-${index}`}
            rel="apple-touch-startup-image"
            media={`screen and ${config.media}`}
            href={`${basePath}/${config.file}`}
          />
        ))}
    </>
  )
}
