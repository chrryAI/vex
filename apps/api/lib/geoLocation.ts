// lib/geoLocation.ts
import { WebServiceClient } from "@maxmind/geoip2-node"
import { captureException } from "./captureException"

export type GeoLocation = {
  ip: string
  city: string | null
  subdivision: string | null
  country: string | null
  postal: string | null
  latitude: number | null
  longitude: number | null
  accuracyRadius: number | null
  isp: string | null
  organization: string | null
  domain: string | null
  connectionType: string | null
  network: string | null
  asn: number | null
  asOrg: string | null
}

const geoCache = new Map<string, GeoLocation>()

export const getLocationFromIP = async (ip: string) => {
  if (!process.env.MAXMIND_ACCOUNT_ID || !process.env.MAXMIND_LICENSE_KEY) {
    console.warn(
      "MAXMIND_ACCOUNT_ID or MAXMIND_LICENSE_KEY not set, skipping geo location",
    )
    return null
  }

  const client = new WebServiceClient(
    process.env.MAXMIND_ACCOUNT_ID!,
    process.env.MAXMIND_LICENSE_KEY!,
    { host: "geolite.info" }, // or "geoip.maxmind.com" for paid DB
  )

  if (!ip) return null

  // Check cache first
  if (geoCache.has(ip)) {
    return geoCache.get(ip)!
  }

  try {
    const response = await client.city(ip)
    const result = {
      ip,
      city: response.city?.names?.en || null,
      subdivision: response.subdivisions?.[0]?.names?.en || null,
      country: response.country?.names?.en || null,
      postal: response.postal?.code || null,
      latitude: response.location?.latitude || null,
      longitude: response.location?.longitude || null,
      accuracyRadius: response.location?.accuracyRadius || null,
      isp: response.traits?.isp || null,
      organization: response.traits?.organization || null,
      domain: response.traits?.domain || null,
      connectionType: response.traits?.connectionType || null,
      network: response.traits?.network || null,
      asn: response.traits?.autonomousSystemNumber || null,
      asOrg: response.traits?.autonomousSystemOrganization || null,
    }

    // Cache result for future requests
    geoCache.set(ip, result)

    return result
  } catch (error) {
    captureException(error)
    console.error("MaxMind web service error:", error)
    return null
  }
}
