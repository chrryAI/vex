import { defaultLocale, LANGUAGES } from "chrry/locales"
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

// Validate and sanitize URL
function sanitizeUrl(url: string | null): string {
  if (!url) return "https://chrry.ai"

  try {
    const parsed = new URL(url)
    // Only allow HTTPS URLs from trusted domains
    if (parsed.protocol !== "https:") return "https://chrry.ai"

    const allowedDomains = ["chrry.ai", "vex.chrry.ai"]
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

  // Sanitize the URL to prevent XSS
  const baseUrl = sanitizeUrl(chrryUrl)
  const isVex = baseUrl === "https://vex.chrry.ai"

  const blogPosts = !isVex ? [] : getBlogPosts()

  const staticRoutes = [
    { url: baseUrl, lastModified: new Date(), priority: 1 },
    { url: `${baseUrl}/about`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/why`, lastModified: new Date(), priority: 0.8 },

    { url: `${baseUrl}/lifeOS`, lastModified: new Date(), priority: 0.9 },
    ...LANGUAGES.filter((language) => language.code !== defaultLocale).map(
      (language) => ({
        url: `${baseUrl}/${language.code}`,
        lastModified: new Date(),
        priority: 0.8,
      }),
    ),
    ...(isVex
      ? [{ url: `${baseUrl}/blog`, lastModified: new Date(), priority: 0.9 }]
      : []),
    ...LANGUAGES.filter((language) => language.code !== defaultLocale).map(
      (language) => ({
        url: `${baseUrl}/${language.code}/about`,
        lastModified: new Date(),
        priority: 0.8,
      }),
    ),
    ...LANGUAGES.filter((language) => language.code !== defaultLocale).map(
      (language) => ({
        url: `${baseUrl}/${language.code}/privacy`,
        lastModified: new Date(),
        priority: 0.8,
      }),
    ),
    ...LANGUAGES.filter((language) => language.code !== defaultLocale).map(
      (language) => ({
        url: `${baseUrl}/${language.code}/terms`,
        lastModified: new Date(),
        priority: 0.8,
      }),
    ),
    ...LANGUAGES.filter((language) => language.code !== defaultLocale).map(
      (language) => ({
        url: `${baseUrl}/${language.code}/why`,
        lastModified: new Date(),
        priority: 0.8,
      }),
    ),
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
