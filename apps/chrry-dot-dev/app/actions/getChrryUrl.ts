import { headers } from "next/headers"

export default async function getChrryUrl() {
  const headersList = await headers()
  const hostname = headersList.get("host") || ""
  const chrryUrlFromHeader = headersList.get("x-chrry-url")
  const protocol = headersList.get("x-forwarded-proto") || "https"

  let chrryUrl = chrryUrlFromHeader
    ? decodeURIComponent(chrryUrlFromHeader)
    : hostname.startsWith("http")
      ? hostname
      : `${protocol}://${hostname}`

  return chrryUrl
}
