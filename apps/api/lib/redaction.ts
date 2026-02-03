import { simpleRedact } from "@chrryai/chrry/lib/redaction"
// @ts-ignore
import { OpenRedaction } from "@openredaction/openredaction"
import { captureException } from "@sentry/node"

let openRedaction: any = null

try {
  openRedaction = new OpenRedaction({
    // Whitelist our custom patterns so OpenRedaction ignores them
    whitelist: [
      /\[ARTICLE_\d+\]/g,
      /\[DOCUMENT_\d+\]/g,
      /\[FILE_\d+\]/g,
      /\[IMAGE_\d+\]/g,
    ],
    // Only redact truly sensitive stuff
    categories: ["financial", "government"],
    includeEmails: true,
    includePhones: true,
    includeNames: false, // Too aggressive
    includeAddresses: false, // Too aggressive
    redactionMode: "placeholder",
  })
} catch (error) {
  console.error(
    "Failed to initialize OpenRedaction, falling back to simple redaction:",
    error,
  )
}

export async function redact(text?: string | null): Promise<string | null> {
  if (!text) return text

  if (openRedaction) {
    try {
      const result = await openRedaction.detect(text)
      if (result?.redacted) {
        return result.redacted.replace(
          /\[(EMAIL|PHONE|CREDIT_CARD|SSN)_[^\]]+\]/g,
          "[REDACTED]",
        )
      }
      return text
    } catch (error) {
      captureException(error)
      console.error("OpenRedaction failed, falling back:", error)
      return simpleRedact(text)
    }
  }

  return simpleRedact(text)
}
