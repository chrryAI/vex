import { Hono } from "hono"
import { getApp } from "../lib/auth"

const app = new Hono()

/**
 * Serve favicon based on app context
 * Matches Flash app's white-label detection logic
 */
app.get("/favicon.ico", async (c) => {
  try {
    // Get app context (handles white-label resolution)
    const appContext = await getApp({ c })

    // Match Flash app's iconSlug logic
    const storeSlug = appContext?.store?.slug
    const appSlug = appContext?.slug

    // Special case: compass → atlas
    const iconSlug = storeSlug === "compass" ? "atlas" : appSlug || "chrry"

    const baseIcon = `/images/apps/${iconSlug}.png`

    // Serve 32x32 favicon (96px at 3x density for Retina)
    // Use resize endpoint for consistent quality
    const faviconUrl = `/api/resize?url=${encodeURIComponent(baseIcon)}&w=96&h=96&fit=contain&q=100&fmt=png`

    return c.redirect(faviconUrl)
  } catch (error) {
    console.error("[favicon] Error:", error)
    // Fallback to default chrry icon
    const fallbackUrl = `/api/resize?url=${encodeURIComponent("/images/apps/chrry.png")}&w=96&h=96&fit=contain&q=100&fmt=png`
    return c.redirect(fallbackUrl)
  }
})

export default app
