import {
  generateAppMetadata,
  generateStoreMetadata,
  generateThreadMetadata,
  getThreadId,
} from "@chrryai/chrry/utils"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import { excludedSlugRoutes } from "@chrryai/chrry/utils/url"
import { getThread, getStore, getApp as getAppDb } from "@repo/db"
import { locale } from "@chrryai/chrry/locales"
import { ServerData } from "./server-loader"

interface MetadataResult {
  title?: string
  description?: string
  keywords?: string[]
  openGraph?: {
    title?: string
    description?: string
    url?: string
    siteName?: string
    images?: Array<{
      url: string
      width?: number
      height?: number
    }>
    locale?: string
    type?: string
  }
  twitter?: {
    title?: string
    description?: string
    card?: string
    site?: string
    creator?: string
    images?: Array<{
      url: string
      width?: number
      height?: number
    }>
  }
  robots?: {
    index?: boolean
    follow?: boolean
  }
  alternates?: {
    canonical?: string
    languages?: Record<string, string>
  }
}

const generateMeta = ({ locale }: { locale: locale }): MetadataResult => {
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
 * Generate metadata for SSR
 * This is called during server-side rendering to inject meta tags into HTML
 */
export async function generateServerMetadata(
  pathname: string,
  hostname: string,
  locale: locale,
  serverData: ServerData,
): Promise<MetadataResult> {
  const siteConfig = getSiteConfig(hostname)

  // Parse pathname segments
  const pathSegments = pathname.split("/").filter(Boolean)
  const segment =
    pathSegments.length === 1 && pathSegments[0] ? pathSegments[0] : null

  // Check if it's an excluded route
  if (segment && excludedSlugRoutes.includes(segment)) {
    return generateMeta({ locale })
  }

  // If we have thread data from server loader, use it
  if (serverData.thread?.thread) {
    return generateThreadMetadata({
      thread: serverData.thread.thread as any,
      locale,
      currentDomain: siteConfig.url,
      translations: serverData.translations || {},
    })
  }

  // Check for thread ID in pathname
  const threadId = getThreadId(pathname)
  if (threadId) {
    try {
      const thread = await getThread({ id: threadId })
      if (thread) {
        return generateThreadMetadata({
          thread: thread.thread as any,
          locale,
          currentDomain: siteConfig.url,
          translations: serverData.translations || {},
        })
      }
    } catch (error) {
      console.error("Error fetching thread for metadata:", error)
    }
  }

  // Check for store
  if (segment && !excludedSlugRoutes.includes(segment)) {
    try {
      const store = await getStore({ slug: segment })
      if (store) {
        const fullStore = await getAppDb({ id: store.app?.id, depth: 1 })
        if (fullStore?.store) {
          return generateStoreMetadata({
            store: fullStore.store,
            locale,
            currentDomain: siteConfig.url,
            translations: serverData.translations || {},
          })
        }
      }
    } catch (error) {
      console.error("Error fetching store for metadata:", error)
    }
  }

  // Use app data from server loader if available
  if (serverData.app) {
    return generateAppMetadata({
      app: serverData.app,
      store: serverData.app.store,
      locale,
      currentDomain: siteConfig.url,
      translations: serverData.translations || {},
      pathname,
    })
  }

  // Default metadata
  return generateMeta({ locale })
}

/**
 * Convert metadata object to HTML meta tags
 */
export function metadataToHtml(metadata: MetadataResult): string {
  const tags: string[] = []

  // Title
  if (metadata.title) {
    tags.push(`<title>${escapeHtml(metadata.title)}</title>`)
  }

  // Description
  if (metadata.description) {
    tags.push(
      `<meta name="description" content="${escapeHtml(metadata.description)}" />`,
    )
  }

  // Keywords
  if (metadata.keywords && metadata.keywords.length > 0) {
    tags.push(
      `<meta name="keywords" content="${escapeHtml(metadata.keywords.join(", "))}" />`,
    )
  }

  // Open Graph
  if (metadata.openGraph) {
    const og = metadata.openGraph
    if (og.title) {
      tags.push(
        `<meta property="og:title" content="${escapeHtml(og.title)}" />`,
      )
    }
    if (og.description) {
      tags.push(
        `<meta property="og:description" content="${escapeHtml(og.description)}" />`,
      )
    }
    if (og.url) {
      tags.push(`<meta property="og:url" content="${escapeHtml(og.url)}" />`)
    }
    if (og.siteName) {
      tags.push(
        `<meta property="og:site_name" content="${escapeHtml(og.siteName)}" />`,
      )
    }
    if (og.type) {
      tags.push(`<meta property="og:type" content="${escapeHtml(og.type)}" />`)
    }
    if (og.locale) {
      tags.push(
        `<meta property="og:locale" content="${escapeHtml(og.locale)}" />`,
      )
    }
    if (og.images && og.images.length > 0) {
      og.images.forEach((image) => {
        tags.push(
          `<meta property="og:image" content="${escapeHtml(image.url)}" />`,
        )
        if (image.width) {
          tags.push(
            `<meta property="og:image:width" content="${image.width}" />`,
          )
        }
        if (image.height) {
          tags.push(
            `<meta property="og:image:height" content="${image.height}" />`,
          )
        }
      })
    }
  }

  // Twitter
  if (metadata.twitter) {
    const twitter = metadata.twitter
    if (twitter.card) {
      tags.push(
        `<meta name="twitter:card" content="${escapeHtml(twitter.card)}" />`,
      )
    }
    if (twitter.title) {
      tags.push(
        `<meta name="twitter:title" content="${escapeHtml(twitter.title)}" />`,
      )
    }
    if (twitter.description) {
      tags.push(
        `<meta name="twitter:description" content="${escapeHtml(twitter.description)}" />`,
      )
    }
    if (twitter.site) {
      tags.push(
        `<meta name="twitter:site" content="${escapeHtml(twitter.site)}" />`,
      )
    }
    if (twitter.creator) {
      tags.push(
        `<meta name="twitter:creator" content="${escapeHtml(twitter.creator)}" />`,
      )
    }
    if (twitter.images && twitter.images.length > 0) {
      twitter.images.forEach((image) => {
        const imageUrl = typeof image === "string" ? image : image.url
        tags.push(
          `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
        )
      })
    }
  }

  // Robots
  if (metadata.robots) {
    const robotsContent = `${metadata.robots.index ? "index" : "noindex"}, ${metadata.robots.follow ? "follow" : "nofollow"}`
    tags.push(`<meta name="robots" content="${robotsContent}" />`)
  }

  // Canonical
  if (metadata.alternates?.canonical) {
    tags.push(
      `<link rel="canonical" href="${escapeHtml(metadata.alternates.canonical)}" />`,
    )
  }

  // Alternate languages
  if (metadata.alternates?.languages) {
    Object.entries(metadata.alternates.languages).forEach(([lang, url]) => {
      tags.push(
        `<link rel="alternate" hreflang="${escapeHtml(lang)}" href="${escapeHtml(url)}" />`,
      )
    })
  }

  return tags.join("\n  ")
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }
  return String(text).replace(/[&<>"']/g, (m) => map[m] || m)
}
