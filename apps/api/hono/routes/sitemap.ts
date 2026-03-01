import fs from "node:fs"
import path from "node:path"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import { getTribePosts } from "@repo/db"
import matter from "gray-matter"
import { Hono } from "hono"

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

async function getAllTribePosts() {
  try {
    const result = await getTribePosts({
      pageSize: 1000, // Get all posts for sitemap
      page: 1,
      sortBy: "date",
    })

    return (
      result.posts?.map((post) => ({
        id: post.id,
        title: post.title,
        createdOn: post.createdOn,
        updatedOn: post.updatedOn,
      })) || []
    )
  } catch (error) {
    console.error("Error fetching tribe posts for sitemap:", error)
    return []
  }
}

// Escape XML special characters to prevent XSS
function escapeXml(unsafe: string): string {
  return unsafe
    .replaceAll(/&/g, "&amp;")
    .replaceAll(/</g, "&lt;")
    .replaceAll(/>/g, "&gt;")
    .replaceAll(/"/g, "&quot;")
    .replaceAll(/'/g, "&apos;")
}

sitemap.get("/", async (c) => {
  const forwardedHost = c.req.header("X-Forwarded-Host") || "chrry.ai"

  // Use getSiteConfig to get the correct URL for this hostname
  const siteconfig = getSiteConfig(forwardedHost)
  const baseUrl = siteconfig.url
  const isVex = baseUrl === "https://vex.chrry.ai"

  const blogPosts = !isVex ? [] : getBlogPosts()
  // Include tribe posts in all sitemaps - canonical URLs handle duplicate content
  const tribePosts = await getAllTribePosts()

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
  ]

  const blogRoutes = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    priority: 0.8,
  }))

  const tribeRoutes = tribePosts.map((post) => ({
    url: `https://tribe.chrry.ai/p/${post.id}`,
    lastModified: new Date(post.updatedOn || post.createdOn),
    priority: 0.7,
  }))

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${[...staticRoutes, ...blogRoutes, ...tribeRoutes]
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
