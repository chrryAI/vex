import { Hono } from "hono"
import { getThread, getStore, getApp as getAppDb } from "@repo/db"
import type { locale } from "@chrryai/chrry/locales"
import {
  generateStoreMetadata,
  generateThreadMetadata,
  getThreadId,
} from "@chrryai/chrry/utils"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import { getTranslations } from "@chrryai/chrry/lib"
import { excludedSlugRoutes } from "@chrryai/chrry/utils/url"

const app = new Hono()

// Helper function to generate default metadata
const generateMeta = () => {
  return {
    title: "Chrry - Your personal AI assistant",
    description:
      "Chat with AI, analyze files, and boost productivity in any language",
    openGraph: {
      title: "Chrry - Your personal AI assistant",
      description:
        "Chat with AI, analyze files, and boost productivity in any language",
    },
  }
}

/**
 * GET /api/metadata
 * Query params:
 * - pathname: current page path
 * - locale: user locale (default: en)
 * - hostname: current hostname
 */
app.get("/", async (c) => {
  try {
    const pathname = c.req.query("pathname") || "/"
    const localeParam = (c.req.query("locale") || "en") as locale
    const hostname = c.req.query("hostname") || c.req.header("host") || ""

    const siteConfig = getSiteConfig(hostname)

    // Parse pathname segments
    const pathSegments = pathname.split("/").filter(Boolean)
    const segment =
      pathSegments.length === 1 && pathSegments[0] ? pathSegments[0] : null

    // Check if it's an excluded route (like /settings, /about, etc.)
    if (segment && excludedSlugRoutes.includes(segment)) {
      return c.json(generateMeta())
    }

    // Check for store
    const store =
      segment && !excludedSlugRoutes.includes(segment)
        ? await getStore({ slug: segment })
        : null

    // Check for thread
    const threadId = getThreadId(pathname)
    const thread = threadId ? await getThread({ id: threadId }) : undefined

    // Get translations
    const translations = await getTranslations({ locale: localeParam })

    // Generate thread metadata if thread exists
    if (thread) {
      const metadata = generateThreadMetadata({
        thread: thread as any,
        locale: localeParam,
        currentDomain: siteConfig.url,
        translations,
      })
      return c.json(metadata)
    }

    // Generate store metadata if store exists
    if (store) {
      const fullStore = await getAppDb({ id: store.app?.id, depth: 1 })
      if (fullStore?.store) {
        const metadata = generateStoreMetadata({
          store: fullStore.store,
          locale: localeParam,
          currentDomain: siteConfig.url,
          translations,
        })
        return c.json(metadata)
      }
    }

    // Default: return basic metadata
    return c.json(generateMeta())
  } catch (error) {
    console.error("Error generating metadata:", error)
    return c.json(
      {
        error: "Failed to generate metadata",
        title: "Chrry",
        description: "Your personal AI assistant",
      },
      500,
    )
  }
})

export { app as metadata }
