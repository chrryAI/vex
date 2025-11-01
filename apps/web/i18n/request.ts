import { getRequestConfig } from "next-intl/server"
import { locales, defaultLocale, type locale } from "chrry/locales"

export default getRequestConfig(async ({ requestLocale }) => {
  // Get the locale from the request headers
  const locale = (await requestLocale) as locale

  // Ensure we have a valid locale
  const safeLocale = locale && locales.includes(locale) ? locale : defaultLocale

  try {
    // Try to load messages for the requested locale
    const messages = {}
    return {
      locale: safeLocale,
      messages,
    }
  } catch (error) {
    // If not the default locale, try to fall back to default
    if (safeLocale !== defaultLocale) {
      const fallbackMessages = {}
      return {
        locale: safeLocale,
        messages: fallbackMessages,
      }
    }

    // Return minimal messages if all else fails
    return {
      locale: safeLocale,
      messages: {},
    }
  }
})
