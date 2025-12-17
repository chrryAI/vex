import { Hono } from "hono"
import { defaultLocale, locales, locale } from "@chrryai/chrry/locales"
import { getCachedTranslations, setCachedTranslations } from "@repo/db"
import { isDevelopment } from "@chrryai/chrry/utils"

// Static imports for all translation files (works in production)
import enTranslations from "@chrryai/chrry/locales/en.json"
import deTranslations from "@chrryai/chrry/locales/de.json"
import esTranslations from "@chrryai/chrry/locales/es.json"
import frTranslations from "@chrryai/chrry/locales/fr.json"
import jaTranslations from "@chrryai/chrry/locales/ja.json"
import koTranslations from "@chrryai/chrry/locales/ko.json"
import nlTranslations from "@chrryai/chrry/locales/nl.json"
import ptTranslations from "@chrryai/chrry/locales/pt.json"
import trTranslations from "@chrryai/chrry/locales/tr.json"
import zhTranslations from "@chrryai/chrry/locales/zh.json"

// Translation map for quick lookup
const translationMap: Record<string, Record<string, any>> = {
  en: enTranslations,
  de: deTranslations,
  es: esTranslations,
  fr: frTranslations,
  ja: jaTranslations,
  ko: koTranslations,
  nl: nlTranslations,
  pt: ptTranslations,
  tr: trTranslations,
  zh: zhTranslations,
}

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

    // Get translations from static import map
    const translations = translationMap[validLocale] || translationMap.en

    // Store in Redis cache for future requests (production only)
    if (!isDevelopment) {
      await setCachedTranslations(validLocale, translations)
    }

    return c.json(translations)
  } catch (error) {
    console.error("❌ Translations API error:", error)
    return c.json({ error: "Failed to load translations" }, 500)
  }
})

// Simple in-memory lock to prevent concurrent writes
const fileLocks = new Map<string, Promise<void>>()

async function withFileLock<T>(
  filePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  // Wait for any existing lock
  while (fileLocks.has(filePath)) {
    await fileLocks.get(filePath)
  }

  // Create new lock
  let releaseLock: () => void
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve
  })
  fileLocks.set(filePath, lockPromise)

  try {
    return await operation()
  } finally {
    // Release lock
    fileLocks.delete(filePath)
    releaseLock!()
  }
}

function validateJSON(content: string): boolean {
  try {
    const parsed = JSON.parse(content)
    return (
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    )
  } catch {
    return false
  }
}

// POST /translations/missing - Add missing translation key (development only)
translations.post("/missing", async (c) => {
  // Only allow in development
  if (!isDevelopment) {
    return c.json({ error: "Not available in production" }, 403)
  }

  try {
    const { key, defaultValue } = await c.req.json()

    if (!key || typeof key !== "string") {
      return c.json({ error: "Invalid key" }, 400)
    }

    // Dynamic imports for Node.js fs operations
    const { writeFile, readFile } = await import("fs/promises")
    const { join } = await import("path")

    // Path to en.json
    const enJsonPath = join(process.cwd(), "../../packages/ui/locales/en.json")

    const tempPath = join(
      process.cwd(),
      "../../packages/ui/locales/en.new.json",
    )

    // Use file lock to prevent concurrent writes
    return await withFileLock(tempPath, async () => {
      // Read main en.json to check if key exists
      const mainFileContent = await readFile(enJsonPath, "utf-8")

      // Validate main JSON
      if (!validateJSON(mainFileContent)) {
        console.error("❌ Invalid JSON detected in en.json")
        return c.json({ error: "Invalid JSON in main translation file" }, 500)
      }

      const mainTranslations = JSON.parse(mainFileContent)

      // Check if key already exists in main file
      if (mainTranslations[key]) {
        return c.json({ exists: true, skipped: true })
      }

      // Read or create en.new.json (only missing translations)
      let newTranslations: Record<string, string> = {}
      try {
        const newFileContent = await readFile(tempPath, "utf-8")
        if (validateJSON(newFileContent)) {
          newTranslations = JSON.parse(newFileContent)
        }
      } catch {
        // File doesn't exist yet, start fresh
        newTranslations = {}
      }

      // Check if key already exists in new file
      if (newTranslations[key]) {
        return c.json({ exists: true, skipped: true })
      }

      // Add new key with default value
      newTranslations[key] = defaultValue || key

      // Sort keys alphabetically
      const sortedTranslations = Object.keys(newTranslations)
        .sort()
        .reduce(
          (acc, k) => {
            const value = newTranslations[k]
            if (value) acc[k] = value
            return acc
          },
          {} as Record<string, string>,
        )

      // Generate JSON content
      const newContent = JSON.stringify(sortedTranslations, null, 2) + "\n"

      // Validate before writing
      if (!validateJSON(newContent)) {
        console.error("❌ Generated invalid JSON")
        return c.json({ error: "Failed to generate valid JSON" }, 500)
      }

      // Write to en.new.json (only missing translations)
      await writeFile(tempPath, newContent, "utf-8")

      console.log(`✅ Added missing translation key to en.new.json: "${key}"`)

      return c.json({ success: true, key, added: true })
    })
  } catch (error) {
    console.error("Error appending translation:", error)
    return c.json({ error: "Failed to append translation" }, 500)
  }
})
