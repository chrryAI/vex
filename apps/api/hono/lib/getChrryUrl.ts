import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"

/**
 * Get chrryUrl from request (Hono version)
 * Pure function - no Next.js dependencies
 */
export async function getChrryUrl(request: Request): Promise<string> {
  const url = new URL(request.url)

  // Check query parameter first
  const chrryUrlFromParams = url.searchParams.get("chrryUrl")
  if (chrryUrlFromParams) {
    return decodeURIComponent(chrryUrlFromParams)
  }

  // Check header
  const chrryUrlFromHeader = request.headers.get("x-chrry-url")
  if (chrryUrlFromHeader) {
    return decodeURIComponent(chrryUrlFromHeader)
  }

  // Fall back to hostname-based detection
  const hostname =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    url.hostname

  const siteConfig = getSiteConfig(hostname)
  return siteConfig.url
}
