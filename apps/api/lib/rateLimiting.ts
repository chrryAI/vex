import { isDevelopment, isE2E, isOwner } from "@chrryai/chrry/utils"
import type { app, guest, subscription, user } from "@repo/db"
import Redis from "ioredis"

// ─── Redis client (reuse existing VPS Redis) ─────────────────────────────────
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
})

redis.on("error", (err) => {
  // Fail open — don't block requests if Redis is temporarily unavailable
  console.error("⚠️ Rate limit Redis error (failing open):", err.message)
})

// ─── Sliding window rate limiter ──────────────────────────────────────────────
// Uses Redis sorted sets: key = "rl:{identifier}:{window}", member = timestamp
async function slidingWindowCheck(
  key: string,
  windowSeconds: number,
  max: number,
): Promise<{ success: boolean; remaining: number }> {
  try {
    const now = Date.now()
    const windowStart = now - windowSeconds * 1000
    const fullKey = `rl:${key}:${windowSeconds}`

    const [, , count] = await redis
      .pipeline()
      .zremrangebyscore(fullKey, "-inf", windowStart) // remove old entries
      .zadd(fullKey, now, `${now}-${Math.random()}`) // add current request
      .zcard(fullKey) // count requests in window
      .expire(fullKey, windowSeconds + 1) // auto-cleanup
      .exec()
      .then((res) => res ?? [])

    const currentCount = (count?.[1] as number) ?? 0
    const remaining = Math.max(0, max - currentCount)
    return { success: currentCount <= max, remaining }
  } catch {
    // Redis unavailable → fail open
    return { success: true, remaining: 999 }
  }
}

// ─── Rate limit tiers (requests per 60s) ─────────────────────────────────────
const LIMITS = {
  anonymous: 30,
  guest: 100,
  free: 300,
  plus: 600,
  pro: 1200,
  appOwner: 5000,
} as const

// ─── Title generation limits (requests per hour) ─────────────────────────────
const TITLE_LIMITS = {
  anonymous: 3,
  guest: 10,
  free: 20,
  plus: 50,
  pro: 150,
  appOwner: 500,
} as const

// ─── Per-thread limits (requests per 24h) ────────────────────────────────────
const THREAD_LIMITS = {
  anonymous: 2,
  guest: 5,
  free: 10,
  plus: 15,
  pro: 30,
  appOwner: 100,
} as const

// ─── Auth rate limit (5 attempts per minute per IP) ──────────────────────────
const AUTH_LIMIT = 5

type Tier = keyof typeof LIMITS

function getTier(
  member?: user & { subscription?: subscription },
  guest?: guest & { subscription?: subscription },
  isAppOwner?: boolean,
): Tier {
  if (isAppOwner) return "appOwner"
  const plan = member?.subscription?.plan || guest?.subscription?.plan
  if (plan === "pro") return "pro"
  if (plan === "plus") return "plus"
  if (member) return "free"
  if (guest) return "guest"
  return "anonymous"
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkRateLimit(
  _request: Request,
  {
    member,
    guest,
  }: {
    member?: user & { subscription?: subscription }
    guest?: guest & { subscription?: subscription }
    app?: app
  },
) {
  if (isDevelopment || isE2E) {
    return { success: true, remaining: 999, errorMessage: "" }
  }

  const tier = getTier(member, guest)
  const identifier = member?.id || guest?.id || "anonymous"
  const { success, remaining } = await slidingWindowCheck(
    `${tier}:${identifier}`,
    60,
    LIMITS[tier],
  )

  return {
    success,
    isAuthenticated: tier !== "anonymous",
    remaining,
    errorMessage: success
      ? ""
      : tier === "anonymous"
        ? "Rate limit exceeded. Please sign up for higher limits."
        : "Too many requests. Please wait a moment before trying again.",
  }
}

export async function checkGenerationRateLimit(
  request: Request,
  {
    member,
    threadId,
    guest,
    app,
  }: {
    member?: user & { subscription?: subscription }
    guest?: guest & { subscription?: subscription }
    threadId: string
    app?: app
  },
) {
  if (isDevelopment || isE2E) {
    return { success: true, remaining: 999, errorMessage: "" }
  }

  const isAppOwner =
    app && isOwner(app, { userId: member?.id, guestId: guest?.id })
  const tier = getTier(member, guest, !!isAppOwner)
  const identifier =
    member?.id ||
    guest?.id ||
    request.headers.get("x-forwarded-for") ||
    "127.0.0.1"
  const threadKey = `${identifier}:${threadId}`

  const hourlyLimit = TITLE_LIMITS[tier]
  const perThreadLimit = THREAD_LIMITS[tier]

  const [hourly, perThread] = await Promise.all([
    slidingWindowCheck(`title:${tier}:${identifier}`, 3600, hourlyLimit),
    slidingWindowCheck(`thread:${tier}:${threadKey}`, 86400, perThreadLimit),
  ])

  const success = hourly.success && perThread.success
  const remaining = Math.min(hourly.remaining, perThread.remaining)

  let errorMessage = ""
  if (!hourly.success) {
    errorMessage =
      tier === "anonymous" || tier === "guest"
        ? `You've reached your hourly limit (${hourlyLimit}/hour). Sign up for more.`
        : `You've reached your hourly limit (${hourlyLimit}/hour). Try again later.`
  } else if (!perThread.success) {
    errorMessage = `You've regenerated this title ${perThreadLimit} times today. Try tomorrow.`
  }

  return { success, remaining, errorMessage }
}

export async function checkAuthRateLimit(_request: Request, ip: string) {
  if (isDevelopment || isE2E) {
    return { success: true, remaining: 999, errorMessage: "" }
  }

  const { success, remaining } = await slidingWindowCheck(
    `auth:${ip}`,
    60,
    AUTH_LIMIT,
  )

  return {
    success,
    remaining,
    errorMessage: "Too many login attempts. Please try again later.",
  }
}
