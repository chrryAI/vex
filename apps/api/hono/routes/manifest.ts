import { Hono } from "hono"
import { getApp } from "@repo/db"
import { getMember, getGuest } from "../lib/auth"
import { validate } from "uuid"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"

// Inline COLORS to avoid React Native dependencies
const COLORS = {
  red: "#ef4444", // red-500
  orange: "#f97316", // orange-500
  blue: "#3b82f6", // blue-500
  green: "#22c55e", // green-500
  violet: "#8b5cf6", // violet-500
  purple: "#a855f7", // purple-500
} as const

export const manifest = new Hono()

// GET /manifest.json - Generate PWA manifest based on hostname
manifest.get("/", async (c) => {
  const url = new URL(c.req.url)
  const forwardedHost = c.req.header("X-Forwarded-Host")

  const chrryUrl = url.searchParams.get("chrryUrl") || forwardedHost

  // Get site config based on hostname
  const siteConfig = getSiteConfig(chrryUrl || undefined)
  const appSlug = siteConfig.slug

  // Get app by slug
  let app = await getApp({ slug: appSlug })

  if (!app) {
    app = await getApp({ slug: "chrry" })
  }

  if (!app) {
    return c.json(
      { error: "App not found" },
      {
        status: 404,
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
  // images array: [512px, 192x192, 180x180, 128px, 32px]
  const baseIcon = app.images?.[0]?.url || `/images/apps/${app?.slug}.png`

  // Helper to resize images for exact dimensions (prevents blurriness on iPhone)
  const resizeIcon = (url: string, size: number) => {
    // Get API URL (use internal URL in production to avoid Cloudflare round-trip)
    const apiUrl =
      process.env.INTERNAL_API_URL ||
      process.env.API_URL ||
      "https://chrry.dev/api"

    // Use our resize API - centers image on canvas without upscaling
    return `${apiUrl}/resize?url=${encodeURIComponent(url)}&w=${size}&h=${size}&fit=contain&q=100`
  }

  const icon512 = app.images?.[0]?.url || resizeIcon(baseIcon, 512) // Resize to exact 512x512
  const icon192 = app.images?.[1]?.url || resizeIcon(baseIcon, 192)
  const icon180 = app.images?.[2]?.url || resizeIcon(baseIcon, 180)

  // Build manifest
  const manifestData = {
    name: `${app.name} - ${app.title}`,
    short_name: app.name,
    description:
      app.description?.substring(0, 160) ||
      `${app.name} - AI-powered agent on Vex`,
    start_url: "/",
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
        purpose: "any",
      },
    ],
    categories: app.tags?.length ? app.tags : ["productivity", "utilities"],
  }

  c.header("Content-Type", "application/manifest+json")
  c.header("Cache-Control", "public, max-age=3600, s-maxage=86400")

  return c.json(manifestData)
})

// GET /manifest/:id - Generate PWA manifest for an app
manifest.get("/:id", async (c) => {
  const id = c.req.param("id")
  const member = await getMember(c)
  const guest = await getGuest(c)

  // Try to get app by slug first (for system apps like "atlas", "peach"), then by UUID
  let app = validate(id)
    ? await getApp({ id, userId: member?.id, guestId: guest?.id })
    : await getApp({ slug: id })

  if (!app) {
    app = await getApp({ slug: "chrry" })
  }

  if (!app) {
    return c.json(
      { error: "App not found" },
      {
        status: 404,
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
  const baseIcon = app.images?.[0]?.url || `/images/apps/${app?.slug}.png`

  // Helper to resize images for exact dimensions (prevents blurriness on iPhone)
  const resizeIcon = (url: string, size: number) => {
    // Get API URL (use internal URL in production to avoid Cloudflare round-trip)
    const apiUrl =
      process.env.INTERNAL_API_URL ||
      process.env.API_URL ||
      "https://chrry.dev/api"

    // Use our resize API - centers image on canvas without upscaling
    return `${apiUrl}/resize?url=${encodeURIComponent(url)}&w=${size}&h=${size}&fit=contain&q=100`
  }

  const icon512 = app.images?.[0]?.url || resizeIcon(baseIcon, 512)
  const icon192 = app.images?.[1]?.url || resizeIcon(baseIcon, 192)
  const icon180 = app.images?.[2]?.url || resizeIcon(baseIcon, 180)

  // Build manifest
  const manifestData = {
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
        purpose: "any",
      },
    ],
    categories: app.tags?.length ? app.tags : ["productivity", "utilities"],
  }

  c.header("Content-Type", "application/manifest+json")
  c.header("Cache-Control", "public, max-age=3600, s-maxage=86400")

  return c.json(manifestData)
})
