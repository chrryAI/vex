import { getApp } from "@repo/db"
import { NextRequest, NextResponse } from "next/server"
import getMember from "../../../actions/getMember"
import getGuest from "../../../actions/getGuest"

import { validate, v4 as uuidv4 } from "uuid"
import { COLORS } from "chrry/context/AppContext"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const member = await getMember()
  const guest = await getGuest()

  // Try to get app by slug first (for system apps like "atlas", "peach"), then by UUID
  let app = await getApp({ id })

  if (!app) {
    app = await getApp({ slug: "chrry" })
  }

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

  // Extract theme color from app metadata or use default
  const themeColor = COLORS[app.themeColor as keyof typeof COLORS] || "#f87171"
  const backgroundColor = app.backgroundColor || "#ffffff"

  // Get app icons by size
  // images array: [512px, 192px, 180px, 128px, 32px]
  const icon512 = app.images?.[0]?.url || "/images/pacman/space-invader.png"
  const icon192 = app.images?.[1]?.url || icon512
  const icon180 = app.images?.[2]?.url || icon512

  // Build manifest
  const manifest = {
    name: `${app.name} - ${app.title}`,
    short_name: app.name,
    description:
      app.description?.substring(0, 160) ||
      `${app.name} - AI-powered agent on Vex`,
    start_url: `/${id}`,
    display: app.displayMode || "standalone",
    background_color: backgroundColor,
    theme_color: themeColor,
    orientation: "portrait-primary",
    icons: [
      {
        src: icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: icon180,
        sizes: "180x180",
        type: "image/png",
        purpose: "apple-touch-icon",
      },
    ],
    categories: app.tags?.length ? app.tags : ["productivity", "utilities"],
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  })
}
