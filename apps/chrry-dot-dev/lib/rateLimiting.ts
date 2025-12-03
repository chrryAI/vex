import arcjet, { slidingWindow } from "@arcjet/next"
import { type user, type guest, type subscription, type app } from "@repo/db"
import { isDevelopment, isE2E, isOwner } from "chrry/utils"

// Create separate Arcjet instances for each tier
const ajAnonymous = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      interval: 60,
      max: 30,
    }),
  ],
})

const ajGuest = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      interval: 60,
      max: 100,
    }),
  ],
})

const ajFree = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      interval: 60,
      max: 300,
    }),
  ],
})

const ajPlus = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      interval: 60,
      max: 600,
    }),
  ],
})

const ajPro = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      interval: 60,
      max: 1200,
    }),
  ],
})

const ajAppOwner = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      interval: 60,
      max: 5000,
    }),
  ],
})

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

  const subscription = member?.subscription || guest?.subscription

  // Select the appropriate Arcjet instance based on tier
  let arcjetInstance
  let isAuthenticated = false

  if (subscription?.plan === "pro") {
    arcjetInstance = ajPro
    isAuthenticated = true
  } else if (subscription?.plan === "plus") {
    arcjetInstance = ajPlus
    isAuthenticated = true
  } else if (member) {
    arcjetInstance = ajFree
    isAuthenticated = true
  } else if (guest) {
    arcjetInstance = ajGuest
    isAuthenticated = true
  } else {
    arcjetInstance = ajAnonymous
    isAuthenticated = false
  }

  // Determine identifier
  const identifier = member?.id || guest?.id || "anonymous"

  // Protect with custom characteristic
  const decision = await arcjetInstance.protect(request, {
    userId: identifier,
  })

  // Get remaining requests from rate limit metadata
  let remaining = 0
  for (const result of decision.results) {
    if (result.reason.isRateLimit()) {
      remaining = result.reason.remaining
    }
  }

  return {
    success: !decision.isDenied(),
    isAuthenticated,
    remaining,
    errorMessage: isAuthenticated
      ? "Too many requests. Please wait a moment before trying again."
      : "Rate limit exceeded. Please sign up for higher limits.",
  }
}

// Title generation rate limiters (hourly)
const ajTitleAnonymous = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      interval: 3600, // 1 hour
      max: 3,
    }),
  ],
})

const ajTitleGuest = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      interval: 3600,
      max: 10,
    }),
  ],
})

const ajTitleFree = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      interval: 3600,
      max: 20,
    }),
  ],
})

const ajTitlePlus = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      interval: 3600,
      max: 50,
    }),
  ],
})

const ajTitlePro = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      interval: 3600,
      max: 150,
    }),
  ],
})

const ajTitleAppOwner = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      interval: 3600,
      max: 500,
    }),
  ],
})

// Per-thread limiters (24 hour window)
const ajPerThreadAnonymous = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["threadKey"],
      interval: 86400, // 24 hours
      max: 2,
    }),
  ],
})

const ajPerThreadGuest = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["threadKey"],
      interval: 86400,
      max: 5,
    }),
  ],
})

const ajPerThreadFree = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["threadKey"],
      interval: 86400,
      max: 10,
    }),
  ],
})

const ajPerThreadPlus = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["threadKey"],
      interval: 86400,
      max: 15,
    }),
  ],
})

const ajPerThreadPro = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["threadKey"],
      interval: 86400,
      max: 30,
    }),
  ],
})

const ajPerThreadAppOwner = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    slidingWindow({
      mode: "LIVE",
      characteristics: ["threadKey"],
      interval: 86400,
      max: 100,
    }),
  ],
})

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
  const isAppOwner =
    app && isOwner(app, { userId: member?.id, guestId: guest?.id })

  // Select instances based on tier
  let hourlyInstance, perThreadInstance
  let hourlyLimit, perThreadLimit

  if (isAppOwner) {
    hourlyInstance = ajTitleAppOwner
    perThreadInstance = ajPerThreadAppOwner
    hourlyLimit = 500
    perThreadLimit = 100
  } else if (subscription?.plan === "pro") {
    hourlyInstance = ajTitlePro
    perThreadInstance = ajPerThreadPro
    hourlyLimit = 150
    perThreadLimit = 30
  } else if (subscription?.plan === "plus") {
    hourlyInstance = ajTitlePlus
    perThreadInstance = ajPerThreadPlus
    hourlyLimit = 50
    perThreadLimit = 15
  } else if (member) {
    hourlyInstance = ajTitleFree
    perThreadInstance = ajPerThreadFree
    hourlyLimit = 20
    perThreadLimit = 10
  } else if (guest) {
    hourlyInstance = ajTitleGuest
    perThreadInstance = ajPerThreadGuest
    hourlyLimit = 10
    perThreadLimit = 5
  } else {
    hourlyInstance = ajTitleAnonymous
    perThreadInstance = ajPerThreadAnonymous
    hourlyLimit = 3
    perThreadLimit = 2
  }

  const identifier =
    member?.id ||
    guest?.id ||
    request.headers.get("x-forwarded-for") ||
    "127.0.0.1"
  const threadKey = `${identifier}:${threadId}`

  // Check both limits
  const [hourlyDecision, threadDecision] = await Promise.all([
    hourlyInstance.protect(request, { userId: identifier }),
    perThreadInstance.protect(request, { threadKey }),
  ])

  const success = !hourlyDecision.isDenied() && !threadDecision.isDenied()

  let remaining = 999
  let errorMessage = ""

  // Extract remaining counts
  for (const result of hourlyDecision.results) {
    if (result.reason.isRateLimit()) {
      remaining = Math.min(remaining, result.reason.remaining)
    }
  }

  for (const result of threadDecision.results) {
    if (result.reason.isRateLimit()) {
      remaining = Math.min(remaining, result.reason.remaining)
    }
  }

  // Generate error messages
  if (hourlyDecision.isDenied()) {
    errorMessage =
      subscription?.plan === "pro"
        ? `You've reached your hourly limit (${hourlyLimit}/hour). Try again later.`
        : subscription?.plan === "plus"
          ? `You've reached your hourly limit (${hourlyLimit}/hour). Try again later.`
          : member
            ? `You've reached your hourly limit (${hourlyLimit}/hour). Upgrade for more.`
            : `You've reached your hourly limit (${hourlyLimit}/hour). Sign up for more.`
  } else if (threadDecision.isDenied()) {
    errorMessage =
      subscription?.plan === "pro"
        ? `You've regenerated this title ${perThreadLimit} times today. Try tomorrow.`
        : subscription?.plan === "plus"
          ? `You've regenerated this title ${perThreadLimit} times today. Try tomorrow.`
          : member
            ? `You've regenerated this title ${perThreadLimit} times today. Try tomorrow.`
            : `You've regenerated this title ${perThreadLimit} times today. Sign up for more.`
  }

  return {
    success,
    remaining,
    errorMessage,
  }
}
