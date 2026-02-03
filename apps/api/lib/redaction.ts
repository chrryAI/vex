import { simpleRedact } from "@chrryai/chrry/lib/redaction"
// @ts-ignore
import { OpenRedaction } from "@openredaction/openredaction"

let openRedaction: any = null

try {
  openRedaction = new OpenRedaction()
} catch (error) {
  console.error(
    "Failed to initialize OpenRedaction, falling back to simple redaction:",
    error,
  )
}

/**
 * Server-side redaction service using @openredaction/openredaction.
 * Falls back to simple regex-based redaction if the library fails or for initial pass.
 */
export async function redact(text: string): Promise<string> {
  if (!text) return text

  // Use heavy library if available
  if (openRedaction) {
    try {
      const result = openRedaction.detect(text)
      if (result && result.redacted) {
        // OpenRedaction returns things like [EMAIL_4106].
        // We might want to standardize this to [REDACTED] or keep it as is.
        // For consistency with simpleRedact, let's normalize common placeholders if we want,
        // but OpenRedaction's detailed placeholders are actually useful features.
        // However, to pass the "toMatch(/\[?REDACTED\]?/i)" test expectation which implies a unified look,
        // and because simpleRedact uses [REDACTED], we can keep OpenRedaction's output
        // BUT update the test to accept OpenRedaction's format OR standardize here.

        // Let's standardize to [REDACTED] for consistency across the platform
        return result.redacted.replace(
          /\[(EMAIL|PHONE|PERSON|CREDIT_CARD|SSN|IP|URL|DATE|ADDRESS)_[^\]]+\]/g,
          "[REDACTED]",
        )
      }
      return text
    } catch (error) {
      console.error(
        "OpenRedaction failed, falling back to simple redaction:",
        error,
      )
      return simpleRedact(text)
    }
  }

  // Fallback to simple redaction
  return simpleRedact(text)
}
