/**
 * Cross-platform SWR Cache Provider - Native
 * Uses MMKV for persistent storage with TTL-based garbage collection
 */

import type { Cache } from "swr"

// TTL (1 hour)
const CACHE_TTL = 60 * 60 * 1000

// -----------------------------------------
// MMKV provider for Native
// -----------------------------------------

let MMKVStorage: any = null

try {
  MMKVStorage = require("react-native-mmkv").MMKV
} catch {
  console.warn("[SWR Cache] MMKV not available, using memory")
}

function createMMKVProvider(): Cache {
  if (!MMKVStorage) {
    // Fallback to memory
    const cache = new Map<string, any>()
    return cache as Cache
  }

  const mmkv = new MMKVStorage({ id: "swr-cache" })

  return {
    get: (key: string) => {
      const json = mmkv.getString(key)
      if (!json) return undefined

      try {
        const { value, ts } = JSON.parse(json)
        if (Date.now() - ts > CACHE_TTL) {
          mmkv.delete(key)
          return undefined
        }
        return value
      } catch {
        return undefined
      }
    },

    set: (key: string, value: any) => {
      mmkv.set(key, JSON.stringify({ value, ts: Date.now() }))
    },

    delete: (key: string) => {
      mmkv.delete(key)
    },

    keys: () => {
      return mmkv.getAllKeys()
    },
  } as Cache
}

// -----------------------------------------
// Memory fallback
// -----------------------------------------

function createMemoryProvider(): Cache {
  const cache = new Map<string, any>()
  return cache as Cache
}

// -----------------------------------------
// Main entry
// -----------------------------------------

export async function getCacheProvider(): Promise<Cache> {
  try {
    return createMMKVProvider()
  } catch (error) {
    console.warn("[SWR Cache] MMKV failed, using memory:", error)
    return createMemoryProvider()
  }
}

export default getCacheProvider
