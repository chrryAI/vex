import getApp, { getWhiteLabel } from "chrry-dot-dev/app/actions/getApp"
import { COLORS } from "chrry/context/ThemeContext"
import { API_URL } from "chrry/utils"
import getAppSlug from "chrry/utils/getAppSlug"
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { getSiteConfig } from "chrry/utils/siteConfig"
import { getImageSrc } from "chrry/lib"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const app = await getApp({ request })

  const whiteLabel = app ? await getWhiteLabel({ app }) : undefined
  const headersList = await headers()

  const pathname = headersList.get("x-pathname") || ""
  const hostname = headersList.get("host") || ""

  // Try to get app by slug first (for system apps like "atlas", "peach"), then by UUID

  if (!app) {
    return NextResponse.json(
      { error: "App not found" },
      {
        headers: {
          "Content-Type": "application/manifest+json",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      },
    )
  }

  const siteConfig = getSiteConfig(hostname)

  const baseUrl = whiteLabel?.store?.domain || siteConfig.url

  const toRelative = (val: string) => {
    return val.replace(baseUrl, "")
  }

  const store = app.store

  const storeSlug = store?.slug || "chrry"

  // Prefer a dedicated white-label base URL for this storeSlug if configured
  const rawSlug = whiteLabel
    ? getAppSlug({
        targetApp: app,
        pathname,
        baseApp: whiteLabel,
      })
    : `${storeSlug}/${app.slug}`

  const slug = rawSlug.startsWith("/") ? rawSlug.slice(1) : rawSlug

  const canonicalUrl = `${baseUrl}/${slug}`

  // Extract theme color from app metadata or use default
  const themeColor = COLORS[app.themeColor as keyof typeof COLORS] || "#f87171"
  const backgroundColor = app.backgroundColor || "#000000"

  // Get app icons by size
  // images array: [512px, 192px, 180px, 128px, 32px]

  // Build manifest
  const manifest = {
    name: `${app.name} - ${app.title}`,
    short_name: app.name,
    description:
      app.description?.substring(0, 160) ||
      `${app.name} - AI-powered agent on Blossom`,
    start_url: toRelative(canonicalUrl),
    scope: "/",
    display: app.displayMode || "standalone",
    background_color: backgroundColor,
    theme_color: themeColor,
    orientation: "portrait-primary",
    icons: [16, 48, 128, 180, 192, 512].reduce(
      (icons, size) =>
        icons.concat({
          src: toRelative(
            getImageSrc({ app, size, BASE_URL: baseUrl }).src ||
              "/images/pacman/space-invader.png",
          ),
          sizes: `${size}x${size}`,
          type: "image/png",
          purpose: "any maskable",
        }),
      [] as any,
    ),

    categories: app.tags?.length ? app.tags : ["productivity", "utilities"],
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  })
}
