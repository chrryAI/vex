import { randomBytes } from "node:crypto"

/**
 * Generate a cryptographically secure random ID
 * Uses crypto.randomBytes() instead of Math.random()
 *
 * @param prefix - Optional prefix for the ID (e.g., "bug_", "booking_")
 * @param length - Length of random part (default: 9)
 * @returns Secure random ID string
 */
export function generateSecureId(
  prefix: string = "",
  length: number = 9,
): string {
  const timestamp = Date.now()
  const randomPart = randomBytes(Math.ceil(length * 2))
    .toString("base64")
    .replace(/[+/=]/g, "") // Remove non-alphanumeric chars
    .slice(0, length)

  return `${prefix}${timestamp}_${randomPart}`
}

/**
 * Generate a cryptographically secure random code (alphanumeric only)
 * Useful for affiliate codes, invite codes, etc.
 *
 * @param length - Length of the code (default: 8)
 * @returns Secure random alphanumeric code
 */
export function generateSecureCode(length: number = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  const charsLength = chars.length
  const maxMultiple = 256 - (256 % charsLength)

  let result = ""
  // Pull bytes in chunks for efficiency
  let buf = Buffer.alloc(0)
  let i = 0
  while (result.length < length) {
    if (i >= buf.length) {
      // refill buffer with a small chunk
      buf = randomBytes(Math.max(16, length - result.length))
      i = 0
    }
    const byte = buf[i++]!
    if (byte >= maxMultiple) continue
    const index = byte % charsLength
    result += chars[index]!
  }

  return result
}
