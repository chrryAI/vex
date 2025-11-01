import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { type user, type guest, type subscription, type app } from "@repo/db"
import { isDevelopment, isE2E, isOwner } from "chrry/utils"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const RATE_LIMITS = {
  anonymous: {
    // Before session/guest creation - Very restrictive
    requests: 30,
    window: "1 m",
    titles: 3,
    perThread: 2,
  },
  guest: {
    // Auto-created guest with ID - Medium limits
    requests: 100,
    window: "1 m",
    titles: 10,
    perThread: 5,
  },
  free: {
    // Registered user (free tier) - Good limits
    requests: 300,
    window: "1 m",
    titles: 20,
    perThread: 10,
  },
  plus: {
    // Plus subscriber - High limits
    requests: 600,
    window: "1 m",
    titles: 50,
    perThread: 15,
  },
  pro: {
    // Pro subscriber - Highest limits
    requests: 1200,
    window: "1 m",
    titles: 150,
    perThread: 30,
  },
  appOwner: {
    // App owner with own API keys - Very high limits
    requests: 5000,
    window: "1 m",
    titles: 500,
    perThread: 100,
  },
}

export async function checkRateLimit(
  request: Request,
  {
    member,
    guest,
    app,
  }: {
    member?: user & { subscription?: subscription }
    guest?: guest & { subscription?: subscription }
    app?: app
  },
) {
  if (isDevelopment || isE2E) {
    return {
      success: true,
      remaining: 999,
      errorMessage: "",
    }
  }

  const isKnown = member || guest ? true : false
  let identifier = ""

  if (member) {
    // Use member ID for authenticated users
    identifier = member.id
  } else if (guest) {
    // Use guest ID instead of IP for better tracking
    identifier = guest.id
  } else {
    // Fallback to IP for completely anonymous requests
    identifier = request.headers.get("x-forwarded-for") || "anonymous"
  }

  const subscription = member?.subscription || guest?.subscription

  const rateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      subscription?.plan === "pro"
        ? RATE_LIMITS.pro.requests
        : subscription?.plan === "plus"
          ? RATE_LIMITS.plus.requests
          : member
            ? RATE_LIMITS.free.requests // Registered user
            : guest
              ? RATE_LIMITS.guest.requests // Auto-created guest
              : RATE_LIMITS.anonymous.requests, // No session yet
      "1 m",
    ),
  })

  const { success } = await rateLimit.limit(identifier)

  return {
    success,
    isAuthenticated: isKnown,
    errorMessage: isKnown
      ? "Too many requests. Please wait a moment before trying again."
      : "Rate limit exceeded. Please sign up for higher limits.",
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
    return {
      success: true,
      remaining: 999,
      errorMessage: "",
    }
  }

  const subscription = member?.subscription || guest?.subscription

  // Rate limits for title generation
  const titleLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      subscription?.plan === "pro"
        ? RATE_LIMITS.pro.titles
        : subscription?.plan === "plus"
          ? RATE_LIMITS.plus.titles
          : member
            ? RATE_LIMITS.free.titles // Registered user
            : guest
              ? RATE_LIMITS.guest.titles // Auto-created guest
              : RATE_LIMITS.anonymous.titles, // No session yet
      "1 h",
    ),
  })

  // Check if user is app owner (using their own API keys)
  const isAppOwner =
    app && isOwner(app, { userId: member?.id, guestId: guest?.id })

  // Per-thread limit to prevent obsessive regeneration
  const perThreadLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      isAppOwner
        ? RATE_LIMITS.appOwner.perThread // App owner with own keys
        : subscription?.plan === "pro"
          ? RATE_LIMITS.pro.perThread
          : subscription?.plan === "plus"
            ? RATE_LIMITS.plus.perThread
            : member
              ? RATE_LIMITS.free.perThread // Registered user
              : guest
                ? RATE_LIMITS.guest.perThread // Auto-created guest
                : RATE_LIMITS.anonymous.perThread, // No session yet
      "24 h",
    ),
  })

  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1"
  const identifier = member ? member.id : ip
  const rateLimit = titleLimit

  // Check both hourly and per-thread limits
  const [hourlyResult, threadResult] = await Promise.all([
    rateLimit.limit(identifier),
    perThreadLimit.limit(`${identifier}:${threadId}`),
  ])

  const success = hourlyResult.success && threadResult.success
  const remaining = Math.min(hourlyResult.remaining, threadResult.remaining)

  return {
    success,
    remaining,
    errorMessage: !hourlyResult.success
      ? subscription?.plan === "pro"
        ? "You've reached your hourly limit (150/hour). Try again later."
        : subscription?.plan === "plus"
          ? "You've reached your hourly limit (50/hour). Try again later."
          : member
            ? "You've reached your hourly limit (15/hour). Upgrade for more."
            : "You've reached your hourly limit (5/hour). Sign up for more."
      : !threadResult.success
        ? subscription?.plan === "pro"
          ? "You've regenerated this title 20 times today. Try tomorrow."
          : subscription?.plan === "plus"
            ? "You've regenerated this title 10 times today. Try tomorrow."
            : member
              ? "You've regenerated this title 5 times today. Try tomorrow."
              : "You've regenerated this title 3 times today. Sign up for more."
        : "",
  }
}
