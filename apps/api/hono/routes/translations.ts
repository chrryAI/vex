import { defaultLocale, type locale, locales } from "@chrryai/chrry/locales"
import { isDevelopment } from "@chrryai/chrry/utils"
import { getCachedTranslations, setCachedTranslations } from "@repo/db"
import { Hono } from "hono"
import { captureException } from "../../lib/captureException"
// Static imports for all locales
import de from "../../locales/de.json"
import en from "../../locales/en.json"
import es from "../../locales/es.json"
import fr from "../../locales/fr.json"
import ja from "../../locales/ja.json"
import ko from "../../locales/ko.json"
import nl from "../../locales/nl.json"
import pt from "../../locales/pt.json"
import tr from "../../locales/tr.json"
import zh from "../../locales/zh.json"

// Translation map for quick lookup
const translationMap: Record<string, Record<string, any>> = {
  de,
  en,
  es,
  fr,
  ja,
  ko,
  nl,
  pt,
  tr,
  zh,
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

    if (!translations || Object.keys(translations).length === 0) {
      console.error(`❌ No translations found for locale: ${validLocale}`)
      return c.json({ error: "Translations not available" }, 500)
    }

    // Store in Redis cache for future requests (production only)
    if (!isDevelopment) {
      await setCachedTranslations(validLocale, translations)
    }

    return c.json(translations)
  } catch (error) {
    captureException(error)
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
    const { writeFile, readFile } = await import("node:fs/promises")
    const { join } = await import("node:path")

    // Paths to BOTH translation files (sync both locations)
    const uiEnJsonPath = join(process.cwd(), "../../packages/db/en.json")
    const apiEnJsonPath = join(process.cwd(), "locales/en.json")

    const tempPath = join(process.cwd(), "../../packages/db/en.new.json")

    // Use file lock to prevent concurrent writes
    return await withFileLock(tempPath, async () => {
      // Read UI en.json to check if key exists
      const uiFileContent = await readFile(uiEnJsonPath, "utf-8")

      // Validate JSON
      if (!validateJSON(uiFileContent)) {
        console.error("❌ Invalid JSON detected in packages/db/en.json")
        return c.json({ error: "Invalid JSON in main translation file" }, 500)
      }

      const uiTranslations = JSON.parse(uiFileContent)

      // Check if key already exists
      if (uiTranslations[key]) {
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
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .reduce(
          (acc, k) => {
            const value = newTranslations[k]
            if (value) acc[k] = value
            return acc
          },
          {} as Record<string, string>,
        )

      // Generate JSON content
      const newContent = `${JSON.stringify(sortedTranslations, null, 2)}\n`

      // Validate before writing
      if (!validateJSON(newContent)) {
        console.error("❌ Generated invalid JSON")
        return c.json({ error: "Failed to generate valid JSON" }, 500)
      }

      // Write to en.new.json (only missing translations)
      await writeFile(tempPath, newContent, "utf-8")

      // SYNC: Also update the API locale file
      try {
        const apiFileContent = await readFile(apiEnJsonPath, "utf-8")
        if (validateJSON(apiFileContent)) {
          const apiTranslations = JSON.parse(apiFileContent)

          // Add the new key
          apiTranslations[key] = defaultValue || key

          // Sort keys alphabetically
          const sortedApiTranslations = Object.keys(apiTranslations).reduce(
            (acc, k) => {
              const value = apiTranslations[k]
              if (value) acc[k] = value
              return acc
            },
            {} as Record<string, string>,
          )

          // Write back to API locale file
          const apiContent = `${JSON.stringify(sortedApiTranslations, null, 2)}\n`
          await writeFile(apiEnJsonPath, apiContent, "utf-8")

          console.log(
            `✅ Synced translation to apps/api/locales/en.json: "${key}"`,
          )
        }
      } catch (error) {
        console.warn("⚠️ Could not sync to API locale file:", error)
        // Don't fail the whole operation if API sync fails
      }

      console.log(`✅ Added missing translation key to en.new.json: "${key}"`)

      return c.json({ success: true, key, added: true })
    })
  } catch (error) {
    console.error("Error appending translation:", error)
    return c.json({ error: "Failed to append translation" }, 500)
  }
})
