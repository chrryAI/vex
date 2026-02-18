import { getCities } from "@repo/db"
import { Hono } from "hono"
import countries from "i18n-iso-countries"
import { getGuest, getMember } from "../lib/auth"

export const cities = new Hono()

function getCountryCode(countryName: string): string {
  const code = countries.getAlpha2Code(countryName, "en")
  return code || countryName
}

// GET /cities - Get cities list
cities.get("/", async (c) => {
  const member = await getMember(c)
  const guest = member ? undefined : await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const search = c.req.query("search") || undefined
  const countryCode = c.req.query("country") || undefined

  // Convert stored country name to country code for compatibility
  const memberCountryCode = member?.country
    ? getCountryCode(member.country)
    : undefined
  const guestCountryCode = guest?.country
    ? getCountryCode(guest.country)
    : undefined

  const country =
    countryCode ||
    (() => {
      if (memberCountryCode) {
        return memberCountryCode
      }

      if (guestCountryCode) {
        return guestCountryCode
      }

      return "" // Default fallback
    })()

  const cityName = member?.city || guest?.city || undefined

  const cities = await getCities({
    search,
    country,
    name: cityName,
  })

  return c.json(cities)
})
