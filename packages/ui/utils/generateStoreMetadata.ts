import { Metadata } from "next"
import { storeWithApps } from "../types"
import { t as tFunc } from "./t"
import { locale } from "../locales"
import { API_URL } from "."
import { whiteLabels } from "./siteConfig"

/**
 * Generate dynamic metadata for a store page
 *
 * @example
 * ```typescript
 * export async function generateMetadata({ params }) {
 *   const store = await getStore({ slug: params.id })
 *   return generateStoreMetadata({ store, locale: params.locale })
 * }
 * ```
 */
export function generateStoreMetadata({
  store,
  locale = "en",
  currentDomain,
  translations,
}: {
  store: storeWithApps
  locale?: locale | string
  currentDomain: string
  translations: Record<string, any>
}): Metadata {
  const title = store.name || "Chrry Store"
  const description = store.description || `${title} - AI-powered apps on Chrry`

  // Use store images or fallback to main app images
  const storeImages = store.images || store.app?.images || []
  const ogImage = storeImages[0]?.url || "/logo/logo-512-512.png"
  const icon512 = storeImages[0]?.url || "/logo/logo-512-512.png"
  const icon192 = storeImages[1]?.url || "/logo/logo-192-192.png"
  const icon180 = storeImages[2]?.url || "/logo/logo-180-180.png"
  const icon32 = storeImages[4]?.url || "/logo/logo-32-32.png"

  const storeSlug = store.slug || "chrry"
  const storeName = store.name || "Chrry"
  // Prefer a dedicated white-label base URL for this storeSlug if configured
  // (e.g. books.chrry.ai for the "books" store) to avoid cross-domain duplicates.
  const whiteLabel = whiteLabels.find(
    (label) => label.storeSlug === storeSlug && label.isStoreApp,
  )
  const baseUrl = whiteLabel?.url || currentDomain
  const canonicalUrl = `${baseUrl}/${storeSlug}`

  const t = (key: string) => {
    return tFunc(translations)(key)
  }

  return {
    title: `${t(storeName)} - Chrry`,
    description: description,
    manifest: `${API_URL}/manifest/${store?.app?.id}`,
    icons: [
      ...(icon32
        ? [{ rel: "icon", url: icon32, sizes: "32x32", type: "image/png" }]
        : []),
      ...(icon192
        ? [{ rel: "icon", url: icon192, sizes: "192x192", type: "image/png" }]
        : []),
      ...(icon512
        ? [{ rel: "icon", url: icon512, sizes: "512x512", type: "image/png" }]
        : []),
      ...(icon180
        ? [
            {
              rel: "apple-touch-icon",
              url: icon180,
              sizes: "180x180",
              type: "image/png",
            },
          ]
        : []),
    ],
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: storeName,
    },
    openGraph: {
      title: `${title} | Chrry`,
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
      title: `${title}`,
      description: description,
      images: [ogImage],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        // Default locale points exactly to the canonical URL (no /en prefix)
        en: canonicalUrl,
        // Other locales live on the same canonical base host
        de: `${baseUrl}/de/${storeSlug}`,
        fr: `${baseUrl}/fr/${storeSlug}`,
        es: `${baseUrl}/es/${storeSlug}`,
        ja: `${baseUrl}/ja/${storeSlug}`,
        ko: `${baseUrl}/ko/${storeSlug}`,
        pt: `${baseUrl}/pt/${storeSlug}`,
        zh: `${baseUrl}/zh/${storeSlug}`,
      },
    },
  }
}
