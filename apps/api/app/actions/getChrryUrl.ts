import { getSiteConfig } from "chrry/utils/siteConfig"
import { headers } from "next/headers"

export default async function getChrryUrl(request?: Request) {
  if (request?.url) {
    const url = new URL(request.url)

    // Detect domain for cookies from chrryUrl (for extensions), Referer, or Origin header
    const chrryUrlFromParams = url.searchParams.get("chrryUrl")

    if (chrryUrlFromParams) {
      return decodeURIComponent(chrryUrlFromParams)
    }
  }

  const headersList = await headers()

  const hostname =
    headersList.get("x-forwarded-host") || headersList.get("host") || ""

  const siteConfig = getSiteConfig(hostname)

  const chrryUrlFromHeader = headersList.get("x-chrry-url")

  let chrryUrl = chrryUrlFromHeader
    ? decodeURIComponent(chrryUrlFromHeader)
    : siteConfig.url

  return chrryUrl
}
