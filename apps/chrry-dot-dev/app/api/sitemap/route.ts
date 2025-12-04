import { locales } from "chrry/locales"
import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import matter from "gray-matter"
import getAppAction, { getWhiteLabel } from "../../actions/getApp"
import { getSiteConfig } from "chrry/utils/siteConfig"
import getAppSlug from "chrry/utils/getAppSlug"

export const dynamic = "force-dynamic"

function getBlogPosts() {
  // Relative to web app directory (apps/web/app/content/blog)
  // From: apps/chrry-dot-dev/app/api/sitemap
  // To:   apps/web/app/content/blog
  const BLOG_DIR = path.join(__dirname, "../../../../web/app/content/blog")

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

// Remove locale prefix from URL path
function clearLocale(url: string): string {
  try {
    const parsed = new URL(url)
    const pathSegments = parsed.pathname.split("/").filter(Boolean)

    // Check if first path segment is a locale
    if (pathSegments[0] && locales.includes(pathSegments[0] as any)) {
      // Remove locale from path
      pathSegments.shift()
      parsed.pathname =
        pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "/"
    }

    return parsed.toString()
  } catch {
    return url
  }
}

// Validate and sanitize URL
function sanitizeUrl(url: string | null): string {
  if (!url) return "https://chrry.ai"

  try {
    const parsed = new URL(url)
    // Allow HTTP for localhost, HTTPS for production
    const isLocalhost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
    if (!isLocalhost && parsed.protocol !== "https:") {
      return "https://chrry.ai"
    }

    const allowedDomains = [
      "chrry.ai",
      "vex.chrry.ai",
      "focus.chrry.ai",
      "atlas.chrry.ai",
      "istanbul.chrry.ai",
      "amsterdam.chrry.ai",
      "tokyo.chrry.ai",
      "newyork.chrry.ai",
      "localhost",
      "127.0.0.1",
    ]
    if (!allowedDomains.includes(parsed.hostname)) {
      return "https://chrry.ai"
    }

    return parsed.origin
  } catch {
    return "https://chrry.ai"
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  let chrryUrl = url.searchParams.get("chrryUrl") || "https://chrry.ai"
  console.log(`🚀 ~ GET ~ chrryUrl:`, chrryUrl)

  const siteconfig = getSiteConfig(chrryUrl || undefined)

  // Sanitize the URL to prevent XSS and strip locale

  const app = await getAppAction({ request })

  const whiteLabel = app ? await getWhiteLabel({ app }) : null

  let baseUrl = whiteLabel?.store?.domain || chrryUrl

  // Remove trailing slash to prevent double slashes in paths
  baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const isVex = baseUrl === "https://vex.chrry.ai"

  const blogPosts = !isVex ? [] : getBlogPosts()

  // Only include canonical (non-localized) URLs
  // Language variants are handled via <link rel="alternate"> in HTML
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

    ...(app?.store?.apps
      ? app?.store?.apps
          ?.filter((app) => app.slug !== siteconfig.slug && app.store)
          .map((app) => {
            const baseApp = app?.store?.apps.find(
              (a) => a.id === a.store?.appId,
            )

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
          })
      : []
    ).filter(Boolean),
  ]

  const blogRoutes = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    priority: 0.8,
  }))

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
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

  return new NextResponse(sitemap, {
    headers: {
      "Content-Type": "application/xml",
    },
  })
}
