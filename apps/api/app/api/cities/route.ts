"use server"

import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { getCities } from "@repo/db"
import countries from "i18n-iso-countries"

function getCountryCode(countryName: string): string {
  const code = countries.getAlpha2Code(countryName, "en")
  return code || countryName
}

export async function GET(request: NextRequest) {
  const member = await getMember()
  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const search = request.nextUrl.searchParams.get("search") || undefined

  // Convert stored country name to country code for compatibility
  const memberCountryCode = member?.country
    ? getCountryCode(member.country)
    : undefined
  const guestCountryCode = guest?.country
    ? getCountryCode(guest.country)
    : undefined

  const country = (() => {
    if (memberCountryCode) {
      return memberCountryCode
    }

    if (guestCountryCode) {
      return guestCountryCode
    }

    return "US" // Default fallback
  })()

  const cityName = member?.city || guest?.city || undefined

  const cities = await getCities({
    search,
    country,
    name: cityName,
  })

  return NextResponse.json(cities)
}
