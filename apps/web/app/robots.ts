import { MetadataRoute } from "next"
import { headers } from "next/headers"

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers()
  const host = headersList.get("host") || "chrry.ai"

  // Determine the full URL based on the host
  const protocol = "https://"
  const fullUrl = `${protocol}${host}`

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/*"],
    },
    sitemap: `https://chrry.dev/api/sitemap?chrryUrl=${fullUrl}`,
  }
}
