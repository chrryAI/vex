import { NextRequest, NextResponse } from "next/server"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { checkRateLimit } from "../../../lib/rateLimiting"
import { getIp } from "../../../lib"

import { getLocationFromIP, GeoLocation } from "../../../lib/geoLocation"
import { updateGuest, updateUser } from "@repo/db"
import { getWeatherCacheTime, isDevelopment } from "chrry/utils"
import { log } from "console"

interface WeatherApiResponse {
  location: {
    name: string
    country: string
    localtime: string
  }
  current: {
    temp_c: number
    temp_f: number
    condition: {
      text: string
      code: string
    }
    humidity: number
    wind_kph: number
  }
}

export async function GET(request: NextRequest) {
  const member = await getMember(true)
  const guest = await getGuest(true)

  if (!member && !guest) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    )
  }

  // Development mode: Return simulated Tokyo weather
  if (isDevelopment) {
    const location = {
      name: "Tokyo",
      country: "Japan",
      city: "Tokyo",
      latitude: 35.6895,
      longitude: 139.6917,
      timezone: "Asia/Tokyo",
      localtime: new Date().toISOString(),
    }

    const current = {
      temp_c: 22,
      temp_f: 71.6,
      condition: {
        text: "Clear",
        code: "1000",
      },
      humidity: 65,
      wind_kph: 10,
      last_updated: new Date().toISOString(),
    }

    const weather = {
      location: location.name,
      country: location.country,
      temperature: `${current.temp_c}°C`,
      condition: current.condition.text,
      code: parseInt(current.condition.code),
      createdOn: new Date(),
      lastUpdated: new Date(),
    }
    const tokyoWeather = {
      location,
      current,
    }

    if (location) {
      if (member) {
        await updateUser({
          ...member,
          city: location.city,
          country: location.country,
          weather,
        })
      } else if (guest) {
        await updateGuest({
          ...guest,
          city: location.city,
          country: location.country,
          weather,
        })
      }
    }

    return NextResponse.json(tokyoWeather, {
      headers: {
        "Cache-Control": "public, max-age=1800",
        "X-Dev-Mode": "true",
      },
    })
  }

  // Rate limiting
  const { success } = await checkRateLimit(request, { member, guest })
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    )
  }

  if (!process.env.WEATHER_API_KEY) {
    return NextResponse.json(
      { error: "Service configuration error" },
      { status: 500 },
    )
  }

  try {
    // Priority 1: Use stored city from user/guest
    let weatherQuery: string | null = null

    if (member?.city && member?.country) {
      weatherQuery = `${member.city}, ${member.country}`
    } else if (guest?.city && guest?.country) {
      weatherQuery = `${guest.city}, ${guest.country}`
    }

    // Fallback: Use IP geolocation only if no stored city
    if (!weatherQuery) {
      const clientIp = getIp(request)
      if (!clientIp) {
        return NextResponse.json(
          { error: "Unable to determine location" },
          { status: 400 },
        )
      }

      const location: GeoLocation | null = await getLocationFromIP(clientIp)
      if (!location?.latitude || !location.longitude) {
        return NextResponse.json(
          { error: "Unable to resolve location" },
          { status: 502 },
        )
      }

      // Store the detected location for future use
      if (location) {
        if (member) {
          await updateUser({
            ...member,
            city: location.city,
            country: location.country,
          })
        } else if (guest) {
          await updateGuest({
            ...guest,
            city: location.city,
            country: location.country,
          })
        }
      }

      weatherQuery = `${location.latitude},${location.longitude}`
    }

    // Fetch weather using city name or coordinates
    const weatherUrl = new URL("https://api.weatherapi.com/v1/current.json")
    weatherUrl.searchParams.set("key", process.env.WEATHER_API_KEY)
    weatherUrl.searchParams.set("q", weatherQuery)
    weatherUrl.searchParams.set("aqi", "no")

    const response = await fetch(weatherUrl.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Weather API error ${response.status}` },
        { status: 502 },
      )
    }

    const weatherData: WeatherApiResponse = await response.json()

    const cacheTime = getWeatherCacheTime(weatherData)

    // Update weather on user/guest after successful fetch
    const weatherCache = {
      location: weatherData.location.name,
      country: weatherData.location.country,
      temperature: `${weatherData.current.temp_c}`,
      condition: weatherData.current.condition.text,
      code: parseInt(weatherData.current.condition.code),
      createdOn: new Date(),
      lastUpdated: new Date(),
    }

    if (member) {
      await updateUser({
        ...member,
        weather: weatherCache,
      })
    } else if (guest) {
      await updateGuest({
        ...guest,
        weather: weatherCache,
      })
    }

    return NextResponse.json(weatherData, {
      headers: {
        "Cache-Control": `public, max-age=${cacheTime}`,
      },
    })
  } catch (err) {
    console.error("Weather route error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
