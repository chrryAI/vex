import { NextRequest, NextResponse } from "next/server"
import { writeFile, readFile, rename, unlink } from "fs/promises"
import { join } from "path"
import { isDevelopment } from "chrry/utils"

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

export async function POST(request: NextRequest) {
  // Only allow in development
  if (!isDevelopment) {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 },
    )
  }

  try {
    const { key, defaultValue } = await request.json()

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 })
    }

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
        return NextResponse.json(
          { error: "Invalid JSON in main translation file" },
          { status: 500 },
        )
      }

      const mainTranslations = JSON.parse(mainFileContent)

      // Check if key already exists in main file
      if (mainTranslations[key]) {
        return NextResponse.json({ exists: true, skipped: true })
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
        return NextResponse.json({ exists: true, skipped: true })
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
        return NextResponse.json(
          { error: "Failed to generate valid JSON" },
          { status: 500 },
        )
      }

      // Write to en.new.json (only missing translations)
      await writeFile(tempPath, newContent, "utf-8")

      console.log(`✅ Added missing translation key to en.new.json: "${key}"`)

      return NextResponse.json({ success: true, key, added: true })
    })
  } catch (error) {
    console.error("Error appending translation:", error)
    return NextResponse.json(
      { error: "Failed to append translation" },
      { status: 500 },
    )
  }
}
