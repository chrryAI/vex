import { Hono } from "hono"
import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { getApp, getStore } from "@repo/db"
import { getSiteConfig, whiteLabels } from "@chrryai/chrry/utils/siteConfig"
import getAppSlug from "@chrryai/chrry/utils/getAppSlug"
import getWhiteLabelUtil from "@chrryai/chrry/utils/getWhiteLabel"
import { getAppAndStoreSlugs } from "@chrryai/chrry/utils/url"
import { appWithStore } from "@chrryai/chrry/types"

export const sitemap = new Hono()

function getBlogPosts() {
  // Relative to web app directory from apps/api root
  // CWD is apps/api
  const BLOG_DIR = path.join(process.cwd(), "../web/app/content/blog")

  if (!fs.existsSync(BLOG_DIR)) {
    return []
  }

  const files = fs.readdirSync(BLOG_DIR)

  return files
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const filePath = path.join(BLOG_DIR, file)
      const content = fs.readFileSync(filePath, "utf-8")
      const { data } = matter(content)
      return {
        slug: file.replace(".md", ""),
        title: data.title || "Untitled",
        date: data.date || new Date().toISOString().split("T")[0],
      }
    })
}

// Escape XML special characters to prevent XSS
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

// Simplified getApp logic for Hono context without Next.js headers() dependency
async function getChrryApp(c: any, chrryUrl: string) {
  const headersList = c.req.header()
  const appId = headersList["x-app-id"]
  const storeSlugCandidate = headersList["x-app-slug"]
  const path = headersList["x-pathname"]

  const siteConfig = getSiteConfig(chrryUrl)

  const storeFromHeader = storeSlugCandidate
    ? await getStore({
        slug: storeSlugCandidate,
        depth: 1,
      })
    : null

  const chrryStore = await getStore({
    domain: siteConfig.store,
    depth: 1,
  })

  let { appSlug, storeSlug } = getAppAndStoreSlugs(path || "/", {
    defaultAppSlug: siteConfig.slug,
    defaultStoreSlug: siteConfig.storeSlug,
  })

  const whiteLabel = whiteLabels.find(
    (label) => label.slug === appSlug && label.isStoreApp,
  )

  if (whiteLabel) {
    storeSlug = whiteLabel.storeSlug
  }

  const appInternal = appId
    ? await getApp({
        id: appId,
        depth: 1,
      })
    : storeFromHeader?.store?.appId
      ? await getApp({
          id: storeFromHeader.store.appId,
          depth: 1,
        })
      : await getApp({
          slug: appSlug,
          storeSlug: storeSlug,
          depth: 1,
        })

  const store = appInternal?.store || chrryStore

  const baseApp =
    store?.apps?.find(
      (app) =>
        app.slug === siteConfig.slug &&
        app.store?.slug === siteConfig.storeSlug,
    ) || store?.app

  const app =
    appInternal ||
    (await getApp({
      id: baseApp?.id,
      depth: 1,
    }))

  if (app?.store?.apps?.length) {
    const currentStoreApps = app.store?.apps || []
    const storeApps = [...currentStoreApps]

    const enrichedApps = await Promise.all(
      storeApps.map(async (app) => {
        if (!app) return null

        const isBaseApp = app?.id === app?.store?.appId
        let storeBaseApp: appWithStore | null = null
        if (isBaseApp) {
          storeBaseApp =
            (await getApp({
              id: app?.id,
              depth: 1,
            })) || null
        } else if (app?.store?.appId) {
          const baseAppData = await getApp({
            id: app?.store?.appId,
            depth: 0,
          })
          storeBaseApp = baseAppData ?? null
        }

        return {
          ...app,
          store: {
            ...app?.store,
            app: storeBaseApp,
          },
        } as appWithStore
      }),
    )

    const validApps = enrichedApps.filter(Boolean) as appWithStore[]
    app.store.apps = validApps
  }

  // Ensure siteApp is included
  const siteApp = await getApp({
    slug: siteConfig.slug,
    storeSlug: siteConfig.storeSlug,
  })

  if (
    app &&
    siteApp &&
    app.store?.apps &&
    !app.store?.apps?.some((a) => a.id === siteApp.id)
  ) {
    app.store.apps.push(siteApp)
  }

  return app
}

async function getWhiteLabel(app: appWithStore) {
  const { storeApp, whiteLabel } = getWhiteLabelUtil({ app })

  if (!storeApp) {
    // For simplicity, default to generic fallback if failing to resolve
    // In original code, getChrryUrl() checks headers. Here we might guess or pass it.
    // Assuming standard behavior.
    return null
  }

  // Fetch full store app
  if (storeApp?.id) {
    return await getApp({ id: storeApp.id, depth: 1 })
  }

  return null
}

sitemap.get("/", async (c) => {
  const url = new URL(c.req.url)
  const forwardedHost = c.req.header("X-Forwarded-Host")

  const chrryUrl =
    url.searchParams.get("chrryUrl") || forwardedHost || "https://chrry.ai"
  const siteconfig = getSiteConfig(chrryUrl || undefined)

  // Fetch app with simplified logic
  const app = await getChrryApp(c, chrryUrl)

  const whiteLabel = app ? await getWhiteLabel(app) : null

  let baseUrl = whiteLabel?.store?.domain || chrryUrl

  // Remove trailing slash to prevent double slashes in paths
  baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const isVex = baseUrl === "https://vex.chrry.ai"

  const blogPosts = !isVex ? [] : getBlogPosts()

  const staticRoutes = [
    { url: baseUrl, lastModified: new Date(), priority: 1 },
    { url: `${baseUrl}/about`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/why`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/calendar`, lastModified: new Date(), priority: 0.8 },

    ...(isVex
      ? [{ url: `${baseUrl}/blog`, lastModified: new Date(), priority: 0.9 }]
      : []),

    ...(app?.store?.slug && app.id === app.store.appId
      ? [
          {
            url: `${baseUrl}/${app.store?.slug}`,
            lastModified: new Date(),
            priority: 0.9,
          },
        ]
      : []),

    ...(
      app?.store?.apps
        ?.filter((app) => app.slug !== siteconfig.slug && app.store)
        .map((app) => {
          const baseApp = app?.store?.apps.find((a) => a.id === a.store?.appId)

          if (!app.store?.domain) {
            return null
          }
          const slug = getAppSlug({
            targetApp: app,
            pathname: app.store?.domain,
            baseApp,
          })

          if (!slug) {
            return null
          }
          return {
            url: `${baseUrl}${slug}`,
            lastModified: new Date(),
            priority: 0.9,
          }
        }) || []
    ).filter(Boolean),
  ]

  const blogRoutes = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    priority: 0.8,
  }))

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${[...staticRoutes, ...blogRoutes]
    .map(
      (route) =>
        route &&
        `
    <url>
      <loc>${escapeXml(route.url)}</loc>
      <lastmod>${route.lastModified.toISOString()}</lastmod>
      <priority>${route.priority}</priority>
    </url>`,
    )
    .join("")}
</urlset>`

  return c.text(sitemapXml, 200, {
    "Content-Type": "application/xml",
  })
})
