/**
 * Cross-platform SWR Cache Provider - Web
 * Uses Dexie (IndexedDB) with TTL-based garbage collection
 */

import type { Cache } from "swr"
import Dexie from "dexie"

// TTL (1 hour)
const CACHE_TTL = 60 * 60 * 1000

// -----------------------------------------
// Dexie DB for Web
// -----------------------------------------

class SWRDexieDB extends Dexie {
  cache!: Dexie.Table<{ key: string; value: any; ts: number }, string>

  constructor() {
    super("swr-dexie-cache")
    this.version(1).stores({
      cache: "key, ts",
    })
  }
}

const db = new SWRDexieDB()

function createDexieProvider(): Cache {
  // In-memory cache synchronized with IndexedDB
  const memCache = new Map<string, any>()

  // Initialize from IndexedDB
  db.cache
    .toArray()
    .then((items) => {
      const now = Date.now()
      items.forEach((item) => {
        // Only load non-expired items
        if (now - item.ts <= CACHE_TTL) {
          memCache.set(item.key, item.value)
        } else {
          // Clean up expired items
          db.cache.delete(item.key).catch(console.error)
        }
      })
    })
    .catch((error) => {
      console.warn("[SWR Cache] Failed to initialize from IndexedDB:", error)
    })

  return {
    get: (key: string) => {
      return memCache.get(key)
    },

    set: (key: string, value: any) => {
      memCache.set(key, value)
      // Persist to IndexedDB asynchronously
      db.cache.put({ key, value, ts: Date.now() }).catch((error) => {
        console.error("[SWR Cache] Failed to persist to IndexedDB:", error)
      })
    },

    delete: (key: string) => {
      memCache.delete(key)
      // Delete from IndexedDB asynchronously
      db.cache.delete(key).catch((error) => {
        console.error("[SWR Cache] Failed to delete from IndexedDB:", error)
      })
    },

    keys: () => {
      return memCache.keys()
    },
  }
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

export function getCacheProvider(): Cache {
  if (typeof indexedDB !== "undefined") {
    try {
      return createDexieProvider()
    } catch (error) {
      console.warn("[SWR Cache] Dexie failed, using memory:", error)
      return createMemoryProvider()
    }
  }

  return createMemoryProvider()
}

export default getCacheProvider
