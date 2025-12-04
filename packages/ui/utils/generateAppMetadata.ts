import { Metadata } from "next"
import { appWithStore, storeWithApps, store } from "../types"
import { t as tFunc } from "./t"
import { locale } from "../locales"
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

  const baseUrl = whiteLabel?.store?.domain || currentDomain

  const cleanSlug = (slug: string) => slug.replace(/\/+$/, "")

  const slug = whiteLabel
    ? getAppSlug({
        targetApp: app,
        pathname,
        baseApp: whiteLabel,
        defaultSlug: "/",
      })
    : `/${storeSlug}/${app.slug}`

  const canonicalUrl = cleanSlug(baseUrl) + cleanSlug(slug)

  const t = (key: string) => {
    return tFunc(translations)(key)
  }

  const toRelative = (val: string) => {
    return val.replace(baseUrl, "")
  }
  return {
    title: `${t(app.name)} - ${t(app.title)} - ${storeName}`,
    description: description,
    manifest: `/manifest.webmanifest`,
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
        // Default locale points exactly to the canonical URL (no /en prefix)
        en: canonicalUrl,
        // Other locales live on the same canonical base host
        de: `${baseUrl}/de${slug}`,
        fr: `${baseUrl}/fr${slug}`,
        es: `${baseUrl}/es${slug}`,
        ja: `${baseUrl}/ja${slug}`,
        ko: `${baseUrl}/ko${slug}`,
        pt: `${baseUrl}/pt${slug}`,
        zh: `${baseUrl}/zh${slug}`,
      },
    },
  }
}
