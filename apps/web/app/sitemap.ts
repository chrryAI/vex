import { API_URL } from "chrry/utils"
import { MetadataRoute } from "next"
import { headers } from "next/headers"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    // Get the host from the request
    const headersList = await headers()
    const host = headersList.get("host") || "chrry.ai"
    const protocol = host.includes("localhost") ? "http://" : "https://"
    const fullUrl = `${protocol}${host}`

    // Fetch sitemap from API
    const apiUrl = `${API_URL}/sitemap?chrryUrl=${encodeURIComponent(fullUrl)}`
    console.log("Fetching sitemap from:", apiUrl)

    const response = await fetch(apiUrl, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        "Failed to fetch sitemap from API:",
        response.status,
        errorText,
      )
      return []
    }

    const xml = await response.text()
    console.log("Received XML length:", xml.length)

    // Parse XML to extract URLs and return as MetadataRoute.Sitemap format
    // Use regex with 's' flag to match across newlines
    const urlMatches = xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)
    const urls: MetadataRoute.Sitemap = []

    for (const match of urlMatches) {
      // Trim whitespace and newlines from URL
      const url = match[1]!.trim()
      urls.push({
        url,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      })
    }

    console.log("Extracted URLs:", urls.length)
    return urls
  } catch (error) {
    console.error("Error generating sitemap:", error)
    return []
  }
}
