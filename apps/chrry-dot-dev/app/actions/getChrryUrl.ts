import { headers } from "next/headers"

export default async function getChrryUrl(request?: Request) {
  if (request?.url.includes("localhost")) {
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

  const chrryUrlFromHeader = headersList.get("x-chrry-url")
  const protocol = headersList.get("x-forwarded-proto") || "https"

  let chrryUrl = chrryUrlFromHeader
    ? decodeURIComponent(chrryUrlFromHeader)
    : hostname.startsWith("http")
      ? hostname
      : `${protocol}://${hostname}`

  return chrryUrl
}
