import { Metadata } from "next"
import { appWithStore, storeWithApps, store } from "../types"
import { t as tFunc } from "./t"
import { locale } from "../locales"
import { isProduction } from "./env"
import { whiteLabels } from "./siteConfig"
import { getAppAndStoreSlugs } from "./url"
import getAppSlug from "./getAppSlug"

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
  const title = app.name || app.title || "Chrry App"
  const description = app.description || `${title} - AI-powered agent on Chrry`

  const store = rest.store || app.store!

  const pathname =
    rest.pathname ||
    (typeof window !== "undefined" ? window.location.pathname : "")

  const API_URL = !isProduction
    ? "http://localhost:3001/api"
    : "https://chrry.dev/api"
  // images array: [512px, 192px, 180px, 128px, 32px]
  const ogImage = app.images?.[0]?.url || "/logo/logo-512-512.png"
  const icon512 = app.images?.[0]?.url || "/logo/logo-512-512.png"
  const icon192 = app.images?.[1]?.url || "/logo/logo-192-192.png"
  const icon180 = app.images?.[2]?.url || "/logo/logo-180-180.png"
  const icon32 = app.images?.[4]?.url || "/logo/logo-32-32.png"

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
  return {
    title: `${t(app.name)} - ${t(app.title)} - ${storeName}`,
    description: description,
    manifest: `/manifest.webmanifest`,
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
      title: app.name,
    },
    openGraph: {
      title: `${title} | ${storeName} | Chrry`,
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
      title: `${title} | ${storeName}`,
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
