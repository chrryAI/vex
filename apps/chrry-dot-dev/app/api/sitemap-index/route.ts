import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// All your subdomains
const SUBDOMAINS = [
  "https://chrry.ai",
  "https://vex.chrry.ai",
  "https://focus.chrry.ai",
  "https://atlas.chrry.ai",
  "https://istanbul.chrry.ai",
  "https://amsterdam.chrry.ai",
  "https://tokyo.chrry.ai",
  "https://newyork.chrry.ai",
]

export async function GET() {
  const lastmod = new Date().toISOString()

  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${SUBDOMAINS.map(
    (domain) => `
  <sitemap>
    <loc>${domain}/api/sitemap?chrryUrl=${encodeURIComponent(domain)}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
  ).join("")}
</sitemapindex>`

  return new NextResponse(sitemapIndex, {
    headers: {
      "Content-Type": "application/xml",
    },
  })
}
