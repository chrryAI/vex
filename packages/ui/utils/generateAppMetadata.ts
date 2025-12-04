import { Metadata } from "next"
import { appWithStore, storeWithApps, store } from "../types"
import { t as tFunc } from "./t"
import { locale, locales } from "../locales"
import { isProduction } from "./env"
import { whiteLabels } from "./siteConfig"
import { getAppAndStoreSlugs } from "./url"
import getAppSlug from "./getAppSlug"
import { getImageSrc } from "../lib"

/**
 * Generate dynamic metadata for an app page
 *
 * @example
 * ```typescript
 * export async function generateMetadata({ params }) {
 *   const app = await getApp({ slug: params.slug })
 *   const store = await getStore({ slug: params.id })
 *   return generateAppMetadata({ app, store, locale: params.locale })
 * }
 * ```
 */
export function generateAppMetadata({
  app,
  locale = "en",
  currentDomain,
  translations,
  whiteLabel,
  ...rest
}: {
  app: appWithStore
  store?: storeWithApps
  locale?: locale | string
  currentDomain: string
  translations: Record<string, any>
  pathname?: string
  whiteLabel?: appWithStore
}): Metadata {
  const title = app.name || app.title || "Chrry"
  const description = app.description || `${title} - Blossom`

  const store = rest.store || app.store!

  const pathname =
    rest.pathname ||
    (typeof window !== "undefined" ? window.location.pathname : "")

  const ogImage = app.images?.[0]?.url || "/logo/logo-512-512.png"

  const storeSlug = store.slug || "chrry"
  const storeName = store.name || "Blossom"
  // Prefer a dedicated white-label base URL for this storeSlug if configured
  const cleanSlug = (slug: string) => slug.replace(/\/+$/, "")

  const clearLocale = (url: string) => {
    // Handle full URLs (with protocol and domain) vs paths
    const hasProtocol = url.includes("://")

    if (hasProtocol) {
      // Extract protocol
      const protocol = url.startsWith("https://") ? "https://" : "http://"
      // Remove protocol to get domain + path
      const withoutProtocol = url.replace(protocol, "")
      // Split by first slash to separate domain from path
      const firstSlashIndex = withoutProtocol.indexOf("/")

      if (firstSlashIndex === -1) {
        // No path, just domain
        return url
      }

      const domain = withoutProtocol.substring(0, firstSlashIndex)
      const path = withoutProtocol.substring(firstSlashIndex + 1) // Remove leading slash

      if (!path) {
        // Empty path
        return `${protocol}${domain}`
      }

      // Check if path starts with a locale
      const pathSegments = path.split("/")
      if (pathSegments[0] && locales.includes(pathSegments[0] as locale)) {
        // Remove locale from path
        const remaining = pathSegments.slice(1).join("/")
        return `${protocol}${domain}${remaining ? `/${remaining}` : ""}`
      }

      return url
    } else {
      // Handle relative paths
      const cleanUrl = url.startsWith("/") ? url.slice(1) : url
      const parts = cleanUrl.split("/")

      // Check if first part is a locale
      if (locales.includes(parts[0] as locale)) {
        // Remove locale and return remaining path
        const remaining = parts.slice(1).join("/")
        return remaining ? `/${remaining}` : ""
      }

      return url
    }
  }

  const toRelative = (val: string) => {
    return val.replace(baseUrl, "")
  }
  const baseUrl = clearLocale(
    cleanSlug(whiteLabel?.store?.domain || currentDomain),
  )

  // Ensure slug always starts with /
  const rawSlug = whiteLabel
    ? getAppSlug({
        targetApp: app,
        pathname,
        baseApp: whiteLabel,
        defaultSlug: "/",
      })
    : `/${storeSlug}/${app.slug}`

  const slug = clearLocale(
    cleanSlug(rawSlug.startsWith("/") ? rawSlug : `/${rawSlug}`),
  )

  const canonicalUrl = baseUrl + slug

  const t = (key: string) => {
    return tFunc(translations)(key)
  }

  return {
    title: `${t(app.name)} - ${t(app.title)}`,
    description: description,
    manifest: `/manifest.webmanifest?appId=${app.id}`,
    icons: [16, 48, 128, 180, 192, 512].map((size) => ({
      url: toRelative(
        getImageSrc({ app, size, BASE_URL: baseUrl }).src ||
          "/images/pacman/space-invader.png",
      ),
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any maskable",
    })),
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: app.name,
    },
    openGraph: {
      title: `${title} - ${storeName}`,
      description: description,
      images: [
        {
          url: ogImage,
          width: 512,
          height: 512,
          alt: title,
        },
      ],
      locale: locale,
      type: "website",
      url: canonicalUrl,
    },
    twitter: {
      card: "summary",
      title: `${title} - ${storeName}`,
      description: description,
      images: [ogImage],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        "x-default": canonicalUrl, // Default fallback for unmatched locales
        en: canonicalUrl, // English uses canonical URL (no /en prefix due to localePrefix: "as-needed")
        de: `${baseUrl}/de${slug}`,
        fr: `${baseUrl}/fr${slug}`,
        es: `${baseUrl}/es${slug}`,
        ja: `${baseUrl}/ja${slug}`,
        ko: `${baseUrl}/ko${slug}`,
        pt: `${baseUrl}/pt${slug}`,
        zh: `${baseUrl}/zh${slug}`,
        nl: `${baseUrl}/nl${slug}`,
        tr: `${baseUrl}/tr${slug}`,
      },
    },
  }
}
