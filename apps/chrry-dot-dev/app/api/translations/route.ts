import { defaultLocale } from "chrry/locales"
import { NextResponse } from "next/server"
import { getCachedTranslations, setCachedTranslations } from "@repo/db"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const locale = url.searchParams.get("locale") || defaultLocale

  // Try to get from Redis cache first (only in production)
  const cached = await getCachedTranslations(locale)
  if (cached) {
    return NextResponse.json(cached)
  }

  // Cache miss or development mode - load from file system and auto-cache
  let translations: Record<string, any> = {}
  try {
    const translationsModule = await import(`chrry/locales/${locale}.json`)
    translations = translationsModule.default || translationsModule

    // Store in Redis cache for future requests
    await setCachedTranslations(locale, translations)
  } catch (error) {
    // Sanitize locale for logging
    const safeLocale = String(locale).replace(/[^\w-]/g, "_")
    console.error(`Failed to load locale: ${safeLocale}`, error)
    try {
      const enModule = await import(`chrry/locales/en.json`)
      translations = enModule.default || enModule

      // Cache the fallback too
      await setCachedTranslations(locale, translations)
    } catch (fallbackError) {
      console.error("Failed to load fallback locale (en)", fallbackError)
      translations = {}
    }
  }

  return NextResponse.json(translations)
}
