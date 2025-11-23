import { openDB, DBSchema, IDBPDatabase } from "idb"

interface CacheDB extends DBSchema {
  cache: {
    key: string
    value: {
      data: any
      timestamp: number
      ttl?: number
    }
  }
}

let dbInstance: IDBPDatabase<CacheDB> | null = null

const getDB = async () => {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<CacheDB>("vex-cache", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("cache")) {
        db.createObjectStore("cache")
      }
    },
  })

  return dbInstance
}

/**
 * Cache data to IndexedDB
 * @param key - Unique cache key (e.g., 'allApps', 'threads-app123')
 * @param data - Any JSON-serializable data
 * @param ttl - Optional time-to-live in milliseconds
 */
export const cacheData = async (
  key: string,
  data: any,
  ttl?: number,
): Promise<void> => {
  try {
    const db = await getDB()
    await db.put(
      "cache",
      {
        data,
        timestamp: Date.now(),
        ttl,
      },
      key,
    )
  } catch (error) {
    console.error("Failed to cache data:", error)
  }
}

/**
 * Get cached data from IndexedDB
 * @param key - Cache key
 * @returns Cached data or null if not found/expired
 */
export const getCachedData = async <T = any>(
  key: string,
): Promise<T | null> => {
  try {
    const db = await getDB()
    const cached = await db.get("cache", key)

    if (!cached) return null

    // Check if expired
    if (cached.ttl && Date.now() - cached.timestamp > cached.ttl) {
      await db.delete("cache", key)
      return null
    }

    return cached.data as T
  } catch (error) {
    console.error("Failed to get cached data:", error)
    return null
  }
}

/**
 * Delete cached data
 * @param key - Cache key
 */
export const deleteCachedData = async (key: string): Promise<void> => {
  try {
    const db = await getDB()
    await db.delete("cache", key)
  } catch (error) {
    console.error("Failed to delete cached data:", error)
  }
}

/**
 * Clear all cached data
 */
export const clearCache = async (): Promise<void> => {
  try {
    const db = await getDB()
    await db.clear("cache")
  } catch (error) {
    console.error("Failed to clear cache:", error)
  }
}

/**
 * Get all cache keys
 */
export const getAllCacheKeys = async (): Promise<string[]> => {
  try {
    const db = await getDB()
    return await db.getAllKeys("cache")
  } catch (error) {
    console.error("Failed to get cache keys:", error)
    return []
  }
}

/**
 * Get cache size estimate
 */
export const getCacheSize = async (): Promise<number> => {
  try {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      return estimate.usage || 0
    }
    return 0
  } catch (error) {
    console.error("Failed to get cache size:", error)
    return 0
  }
}
