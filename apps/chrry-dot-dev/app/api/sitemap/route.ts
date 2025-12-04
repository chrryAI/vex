import { defaultLocale, LANGUAGES, locales } from "chrry/locales"
import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import matter from "gray-matter"

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
  let chrryUrl = url.searchParams.get("chrryUrl")

  // Sanitize the URL to prevent XSS and strip locale
  const baseUrl = clearLocale(sanitizeUrl(chrryUrl))
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
    { url: `${baseUrl}/lifeOS`, lastModified: new Date(), priority: 0.9 },
    ...(isVex
      ? [{ url: `${baseUrl}/blog`, lastModified: new Date(), priority: 0.9 }]
      : []),
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
      (route) => `
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
