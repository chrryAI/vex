import { Hono } from "hono"
import { getMember, getGuest } from "../lib/auth"
import { checkRateLimit } from "../../lib/rateLimiting"
import { getIp } from "../../lib"
import { getLocationFromIP, type GeoLocation } from "../../lib/geoLocation"
import { updateGuest, updateUser, redis as dbRedis } from "@repo/db"
import { getWeatherCacheTime, isDevelopment } from "@chrryai/chrry/utils"
import { isE2E } from "@chrryai/chrry/utils/siteConfig"

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

export const weather = new Hono()

// GET /weather - Get weather for user's location
weather.get("/", async (c) => {
  const member = await getMember(c, { full: true, skipCache: true })
  const guest = await getGuest(c, { skipCache: true })

  const redis =
    isDevelopment || isE2E
      ? {
          get: async (key: string) => {
            return null
          },
          setex: async (key: string, ttl: number, value: string) => {},
          del: async (key: string) => {},
          ttl: async (key: string) => {},
          exists: async (key: string) => {},
        }
      : dbRedis

  const skipCache = c.req.query("skipCache") === "true"

  if (!member && !guest) {
    return c.json({ error: "Authentication required" }, 401)
  }

  const memberOrGuestCity =
    member?.city || guest?.city || (isDevelopment ? "Tokyo" : "")

  const memberOrGuestCountry =
    member?.country || guest?.country || (isDevelopment ? "Japan" : "")
  // Development mode: Return simulated Tokyo weather
  if (isDevelopment || isE2E) {
    const location = {
      name: memberOrGuestCity,
      country: memberOrGuestCountry,
      city: memberOrGuestCity,
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

    const weatherCache = {
      location: location.name,
      country: location.country,
      temperature: `${current.temp_c}°C`,
      condition: current.condition.text,
      code: Number.parseInt(current.condition.code),
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
          weather: weatherCache,
        })
      } else if (guest) {
        await updateGuest({
          ...guest,
          city: location.city,
          country: location.country,
          weather: weatherCache,
        })
      }
    }

    return c.json(tokyoWeather)
  }

  // Rate limiting

  let location: GeoLocation | null = null
  const { success } = await checkRateLimit(c.req.raw, { member, guest })
  if (!success) {
    return c.json(
      { error: "Rate limit exceeded. Please try again later." },
      429,
      {
        "Retry-After": "60",
      },
    )
  }

  if (!process.env.WEATHER_API_KEY) {
    return c.json({ error: "Service configuration error" }, 500)
  }

  try {
    // Priority 1: Use stored city from user/guest
    let weatherQuery: string | null = null

    if (memberOrGuestCity && memberOrGuestCountry) {
      weatherQuery = `${memberOrGuestCity}, ${memberOrGuestCountry}`
    }

    // Fallback: Use IP geolocation only if no stored city
    if (!weatherQuery) {
      const clientIp = getIp(c.req.raw)
      if (!clientIp) {
        return c.json({ error: "Unable to determine location" }, 400)
      }

      location = await getLocationFromIP(clientIp)
      if (!location?.latitude || !location.longitude) {
        return c.json({ error: "Unable to resolve location" }, 502)
      }

      // Store the detected location for future use

      weatherQuery = `${location.latitude},${location.longitude}`
    }

    // Fetch weather using city name or coordinates
    const weatherUrl = new URL("https://api.weatherapi.com/v1/current.json")
    weatherUrl.searchParams.set("key", process.env.WEATHER_API_KEY)
    weatherUrl.searchParams.set("q", weatherQuery)
    weatherUrl.searchParams.set("aqi", "no")

    // Check Redis cache first
    const cacheKey = `weather:${weatherQuery}`

    let weatherData: WeatherApiResponse | null = null

    if (!skipCache && !isDevelopment) {
      const cachedWeather = await redis.get(cacheKey)
      if (cachedWeather) {
        console.log(`✅ Weather cache hit for: ${weatherQuery}`)
        weatherData = JSON.parse(cachedWeather)
      }
    }

    // Fetch fresh weather if not cached
    if (!weatherData) {
      console.log(`🌤️ Fetching fresh weather for: ${weatherQuery}`)
      const response = await fetch(weatherUrl.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        return c.json({ error: `Weather API error ${response.status}` }, 502)
      }

      weatherData = await response.json()

      const cacheTime = getWeatherCacheTime(weatherData)

      // Store in Redis cache with TTL
      if (!isDevelopment) {
        await redis.setex(cacheKey, cacheTime, JSON.stringify(weatherData))
      }
      console.log(`💾 Cached weather for ${weatherQuery} (TTL: ${cacheTime}s)`)
    }

    if (!weatherData) {
      return c.json({ error: "Weather data not found" }, 502)
    }
    // Update weather on user/guest (runs for both cached and fresh data)
    const weatherCache = {
      location: weatherData.location.name,
      country: weatherData.location.country,
      temperature: `${weatherData.current.temp_c}`,
      condition: weatherData.current.condition.text,
      code: Number.parseInt(weatherData.current.condition.code),
      createdOn: new Date(),
      lastUpdated: new Date(),
    }

    const locationUpdate = {
      city: weatherData.location.name,
      country: weatherData.location.country,
    }

    if (member) {
      await updateUser({
        ...member,
        city: locationUpdate.city,
        country: locationUpdate.country,
        weather: weatherCache,
      })
      // Invalidate guest cache after updating
      await redis.del(`user:${member.id}`)
    } else if (guest) {
      await updateGuest({
        ...guest,
        city: locationUpdate.city,
        country: locationUpdate.country,
        weather: weatherCache,
      })
      // Invalidate guest cache after updating
      await redis.del(`guest:${guest.fingerprint}`)
    }

    return c.json(weatherData)
  } catch (err) {
    console.error("Weather route error:", err)
    return c.json({ error: "Internal server error" }, 500)
  }
})
