import { redis } from "./redis"

/**
 * Cache management for apps and stores
 * Uses Upstash Redis for fast, distributed caching
 */

// Disable cache in development for easier debugging
const CACHE_ENABLED =
  process.env.NODE_ENV === "production" ||
  process.env.ENABLE_CACHE === "true"

// Cache TTLs (in seconds)
const CACHE_TTL = {
  APP: 60 * 5, // 5 minutes
  APPS_LIST: 60 * 2, // 2 minutes (shorter for lists)
  STORE: 60 * 10, // 10 minutes
  STORES_LIST: 60 * 5, // 5 minutes
}

// Cache key generators
export const cacheKeys = {
  app: (id: string) => `app:${id}`,
  appBySlug: (slug: string) => `app:slug:${slug}`,
  apps: (userId?: string, storeId?: string) =>
    `apps:${userId || "all"}:${storeId || "all"}`,
  store: (id: string) => `store:${id}`,
  storeBySlug: (slug: string) => `store:slug:${slug}`,
  stores: (userId?: string, parentStoreId?: string) =>
    `stores:${userId || "all"}:${parentStoreId || "all"}`,
}

// Generic cache get/set
export async function getCache<T>(key: string): Promise<T | null> {
  if (!CACHE_ENABLED) {
    return null // Cache disabled
  }

  try {
    const cached = await redis.get<T>(key)
    if (cached) {
      console.log(`✅ Cache HIT: ${key}`)
    }
    return cached
  } catch (error) {
    console.error(`❌ Cache GET error for ${key}:`, error)
    return null
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  ttl: number,
): Promise<void> {
  if (!CACHE_ENABLED) {
    return // Cache disabled
  }

  try {
    await redis.setex(key, ttl, JSON.stringify(value))
    console.log(`✅ Cache SET: ${key} (TTL: ${ttl}s)`)
  } catch (error) {
    console.error(`❌ Cache SET error for ${key}:`, error)
  }
}

export async function deleteCache(key: string): Promise<void> {
  if (!CACHE_ENABLED) {
    return // Cache disabled
  }

  try {
    await redis.del(key)
    console.log(`🗑️ Cache DELETE: ${key}`)
  } catch (error) {
    console.error(`❌ Cache DELETE error for ${key}:`, error)
  }
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  if (!CACHE_ENABLED) {
    return // Cache disabled
  }

  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
      console.log(`🗑️ Cache DELETE pattern: ${pattern} (${keys.length} keys)`)
    }
  } catch (error) {
    console.error(`❌ Cache DELETE pattern error for ${pattern}:`, error)
  }
}

// App cache helpers
export async function getCachedApp(id: string) {
  return getCache(cacheKeys.app(id))
}

export async function setCachedApp(id: string, app: any) {
  await setCache(cacheKeys.app(id), app, CACHE_TTL.APP)
}

export async function getCachedAppBySlug(slug: string) {
  return getCache(cacheKeys.appBySlug(slug))
}

export async function setCachedAppBySlug(slug: string, app: any) {
  await setCache(cacheKeys.appBySlug(slug), app, CACHE_TTL.APP)
}

export async function invalidateApp(id: string, slug?: string) {
  await deleteCache(cacheKeys.app(id))
  if (slug) {
    await deleteCache(cacheKeys.appBySlug(slug))
  }
  // Invalidate all app lists
  await deleteCachePattern("apps:*")
}

// Store cache helpers
export async function getCachedStore(id: string) {
  return getCache(cacheKeys.store(id))
}

export async function setCachedStore(id: string, store: any) {
  await setCache(cacheKeys.store(id), store, CACHE_TTL.STORE)
}

export async function getCachedStoreBySlug(slug: string) {
  return getCache(cacheKeys.storeBySlug(slug))
}

export async function setCachedStoreBySlug(slug: string, store: any) {
  await setCache(cacheKeys.storeBySlug(slug), store, CACHE_TTL.STORE)
}

export async function invalidateStore(id: string, slug?: string) {
  await deleteCache(cacheKeys.store(id))
  if (slug) {
    await deleteCache(cacheKeys.storeBySlug(slug))
  }
  // Invalidate all store lists
  await deleteCachePattern("stores:*")
}

// List cache helpers
export async function getCachedApps(userId?: string, storeId?: string) {
  return getCache(cacheKeys.apps(userId, storeId))
}

export async function setCachedApps(
  apps: any,
  userId?: string,
  storeId?: string,
) {
  await setCache(cacheKeys.apps(userId, storeId), apps, CACHE_TTL.APPS_LIST)
}

export async function getCachedStores(userId?: string, parentStoreId?: string) {
  return getCache(cacheKeys.stores(userId, parentStoreId))
}

export async function setCachedStores(
  stores: any,
  userId?: string,
  parentStoreId?: string,
) {
  await setCache(
    cacheKeys.stores(userId, parentStoreId),
    stores,
    CACHE_TTL.STORES_LIST,
  )
}
