import { Hono } from "hono"
import { defaultLocale, locales, locale } from "chrry/locales"
import { getCachedTranslations, setCachedTranslations } from "@repo/db"
import { isDevelopment } from "chrry/utils"

export const translations = new Hono()

translations.get("/", async (c) => {
  console.log("🌍 Hono Translations API called")
  try {
    const locale = c.req.query("locale") || defaultLocale

    // Validate locale
    const validLocale = locales.includes(locale as locale)
      ? locale
      : defaultLocale

    console.log(`📝 Loading translations for locale: ${validLocale}`)

    // Try to get from Redis cache first (only in production)
    const cached = isDevelopment
      ? null
      : await getCachedTranslations(validLocale)

    if (cached) {
      return c.json(cached)
    }

    // Cache miss or development mode - load from file system and auto-cache
    let translations: Record<string, any> = {}
    try {
      const translationsModule = await import(
        `chrry/locales/${validLocale}.json`
      )
      translations = translationsModule.default || translationsModule

      // Store in Redis cache for future requests
      await setCachedTranslations(validLocale, translations)
    } catch (error) {
      // Sanitize locale for logging
      const safeLocale = String(validLocale).replace(/[^\w-]/g, "_")
      console.error("Failed to load locale: %s", safeLocale, error)

      try {
        const enModule = await import(`chrry/locales/en.json`)
        translations = enModule.default || enModule

        // Cache the fallback too
        await setCachedTranslations(validLocale, translations)
      } catch (fallbackError) {
        console.error("Failed to load fallback locale (en)", fallbackError)
        translations = {}
      }
    }

    return c.json(translations)
  } catch (error) {
    console.error("❌ Translations API error:", error)
    return c.json({ error: "Failed to load translations" }, 500)
  }
})
