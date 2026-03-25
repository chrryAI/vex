/**
 * Generate a cryptographically secure random float between 0 and 1
 * Uses window.crypto.getRandomValues()
 * Falls back to Math.random() if window or crypto is not available (e.g., SSR)
 */
export function secureRandom(): number {
  if (typeof window === "undefined" || !window.crypto) {
    return Math.random()
  }
  const array = new Uint32Array(1)
  window.crypto.getRandomValues(array)
  // Divide by 2^32 to get a float in [0, 1)
  return array[0]! / (0xffffffff + 1)
}
