import { randomBytes } from "crypto"

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
  const randomPart = randomBytes(Math.ceil(length / 2))
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
  const randomBytesArray = randomBytes(length)

  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars[randomBytesArray[i]! % chars.length]
  }

  return result
}
