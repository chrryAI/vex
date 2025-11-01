import { getApp, getStore } from "@repo/db"
import Home from "chrry/Home"
import Store from "chrry/Store"
import React from "react"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import { validate } from "uuid"
import { headers } from "next/headers"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}): Promise<Metadata> {
  const { id, locale } = await params
  const member = await getMember()
  const guest = await getGuest()

  // Get the current domain from request headers
  const headersList = await headers()
  const host = headersList.get("host") || "chrry.ai"
  const protocol = host.includes("localhost") ? "http" : "https"
  const currentDomain = `${protocol}://${host}`

  // Check if it's a store first
  const store = !validate(id)
    ? await getStore({ slug: id, userId: member?.id, guestId: guest?.id })
    : null

  if (store) {
    const title = `${store.store.title || store.store.name} | Vex`
    const description =
      store.store.description || `${store.store.name} - AI-powered apps on Vex`

    // Use current domain as canonical (where the request came from)
    const canonicalUrl = `${currentDomain}/${store.store.slug}`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        locale: locale,
        type: "website",
        url: canonicalUrl,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
      alternates: {
        canonical: canonicalUrl,
        languages: {
          en: `${currentDomain}/en/${id}`,
          de: `${currentDomain}/de/${id}`,
          fr: `${currentDomain}/fr/${id}`,
          es: `${currentDomain}/es/${id}`,
          ja: `${currentDomain}/ja/${id}`,
          ko: `${currentDomain}/ko/${id}`,
          pt: `${currentDomain}/pt/${id}`,
          zh: `${currentDomain}/zh/${id}`,
        },
      },
    }
  }

  // Otherwise, try to load as an app
  const app = validate(id)
    ? await getApp({ id, userId: member?.id, guestId: guest?.id })
    : await getApp({ slug: id, userId: member?.id, guestId: guest?.id })

  if (!app) {
    return {
      description: "The requested app could not be found.",
    }
  }

  const title = app.name || app.title || "Vex App"
  const description = app.description || `${title} - AI-powered agent on Vex`

  // images array: [512px, 192px, 180px, 128px, 32px]
  const ogImage = app.images?.[0]?.url || "/logo/logo-512-512.png"
  const icon512 = app.images?.[0]?.url || "/logo/logo-512-512.png"
  const icon192 = app.images?.[1]?.url || "/logo/logo-192-192.png"
  const icon180 = app.images?.[2]?.url || "/logo/logo-180-180.png"
  const icon32 = app.images?.[4]?.url || "/logo/logo-32-32.png"
  const themeColor = app.themeColor || "#f87171"

  return {
    title: `${title} | Vex`,
    description: description,
    manifest: `/api/manifest/${id}`,
    themeColor: themeColor,
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
      title: `${title} | Vex`,
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
    },
    twitter: {
      card: "summary",
      title: `${title} | Vex`,
      description: description,
      images: [ogImage],
    },
    alternates: {
      canonical: `/${id}`,
      languages: {
        en: `/en/${id}`,
        de: `/de/${id}`,
        fr: `/fr/${id}`,
        es: `/es/${id}`,
        ja: `/ja/${id}`,
        ko: `/ko/${id}`,
        pt: `/pt/${id}`,
        zh: `/zh/${id}`,
      },
    },
  }
}

export default async function AppPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const member = await getMember()
  const guest = await getGuest()

  // Check if it's a store first
  const store = !validate(id)
    ? await getStore({ slug: id, userId: member?.id, guestId: guest?.id })
    : await getStore({ id, userId: member?.id, guestId: guest?.id })

  if (store) {
    return <Store slug={store.store.slug} />
  }

  // Otherwise, try to load as an app
  const app = validate(id)
    ? await getApp({ id, userId: member?.id, guestId: guest?.id })
    : await getApp({ slug: id, userId: member?.id, guestId: guest?.id })

  if (!app) {
    return notFound()
  }

  return <Home />
}
