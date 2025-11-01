import { isDevelopment } from "chrry/utils"

/**
 * Scan file for malware using external ClamAV service
 */
export async function scanFileForMalware(
  buffer: Buffer,
): Promise<{ safe: boolean; threat?: string }> {
  const scannerUrl = process.env.MALWARE_SCANNER_URL

  if (!scannerUrl) {
    console.warn("⚠️ MALWARE_SCANNER_URL not set, skipping scan")
    return { safe: true }
  }

  try {
    const formData = new FormData()
    // Node.js FormData requires a Blob-like object with proper filename
    const blob = new Blob([buffer], { type: "application/octet-stream" })
    formData.append("file", blob, "file")

    console.log(`🔍 Scanning file at ${scannerUrl}/scan`)

    const response = await fetch(`${scannerUrl}/scan`, {
      method: "POST",
      body: formData,
      headers: {
        "X-API-Key": process.env.MALWARE_SCANNER_API_KEY || "",
      },
    })

    console.log(`📡 Scanner response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Scanner error response: ${errorText}`)
      throw new Error(`Scanner returned ${response.status}: ${errorText}`)
    }

    const result = await response.json()

    if (!result.safe) {
      console.warn("🚨 Malware detected:", result.threat)
    } else {
      console.log("✅ File passed malware scan")
    }

    return result
  } catch (error) {
    console.error("❌ Malware scan error:", error)
    console.error("❌ Error details:", {
      message: error instanceof Error ? error.message : String(error),
      scannerUrl,
      hasApiKey: !!process.env.MALWARE_SCANNER_API_KEY,
    })
    // Fail open in development, fail closed in production
    return { safe: isDevelopment }
  }
}

// Dangerous file extensions to block
const DANGEROUS_EXTENSIONS = [
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".scr",
  ".vbs",
  ".jar",
  ".app",
  ".deb",
  ".rpm",
]

const DANGEROUS_MIME_TYPES = [
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
  "application/x-bat",
]

/**
 * Validate file type for security
 */
export function validateFile(filename: string, mimeType: string): void {
  const ext = filename.toLowerCase().split(".").pop()

  if (ext && DANGEROUS_EXTENSIONS.some((d) => d.includes(ext))) {
    throw new Error(`Dangerous file type not allowed: .${ext}`)
  }

  if (DANGEROUS_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Dangerous MIME type not allowed: ${mimeType}`)
  }
}

/**
 * Sanitize text content before sending to AI
 * Removes potential prompt injection attempts
 */
export function sanitizeForAI(text: string): string {
  return (
    text
      // Remove prompt injection attempts
      .replace(/ignore\s+previous\s+instructions/gi, "[REDACTED]")
      .replace(/disregard\s+all\s+previous/gi, "[REDACTED]")
      .replace(/forget\s+everything/gi, "[REDACTED]")

      // Remove role markers that could confuse AI
      .replace(/system:|assistant:|user:/gi, "[REDACTED]")
      .replace(/\[INST\]|\[\/INST\]/g, "[REDACTED]")
      .replace(/<\|im_start\|>|<\|im_end\|>/g, "[REDACTED]")

      // Remove potential code execution
      .replace(/eval\(|exec\(|Function\(/gi, "[REDACTED]")

      // Limit length to prevent token overflow
      .slice(0, 50000) // Max 50k chars

      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  )
}

/**
 * Anonymize PII in text
 * Use this when sending data to external AI providers
 */
export function anonymizePII(text: string): string {
  return (
    text
      // Email addresses
      .replace(/\b[\w.%+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")

      // Phone numbers (various formats)
      .replace(
        /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
        "[PHONE]",
      )

      // Credit card numbers
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[CARD]")

      // SSN (US)
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")

      // IP addresses
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP]")
  )
}

/**
 * Check if provider requires PII anonymization
 */
export function shouldAnonymize(provider?: string): boolean {
  if (!provider) return false

  // Only anonymize for external providers
  const externalProviders = ["openai", "anthropic", "google", "perplexity"]
  return externalProviders.includes(provider.toLowerCase())
}

/**
 * Complete security check for file uploads
 */
export function secureFileContent(
  filename: string,
  mimeType: string,
  content: string,
  options: { anonymize?: boolean } = {},
): string {
  // 1. Validate file type
  validateFile(filename, mimeType)

  // 2. Sanitize content
  let secured = sanitizeForAI(content)

  // 3. Optionally anonymize PII
  if (options.anonymize) {
    secured = anonymizePII(secured)
  }

  return secured
}
