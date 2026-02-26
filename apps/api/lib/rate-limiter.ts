// Production-grade rate limiter utilities: in-memory global limiter + exponential backoff

import { captureException } from "./captureException"

// Simple in-memory global concurrency + queue limiter
type Task<T> = {
  fn: () => Promise<T>
  resolve: (v: T) => void
  reject: (e: any) => void
}

export type LimiterOptions = {
  maxConcurrent?: number // hard cap on concurrent provider calls
  maxQueue?: number // max waiting queue length before fast 429
}

class SimpleGlobalLimiter {
  private maxConcurrent: number
  private maxQueue: number
  private inFlight = 0
  private queue: Task<any>[] = []

  constructor(opts?: LimiterOptions) {
    this.maxConcurrent = Math.max(1, opts?.maxConcurrent ?? 6)
    this.maxQueue = Math.max(0, opts?.maxQueue ?? 200)
  }

  // Quick check to decide if we should reject immediately
  shouldReject(): boolean {
    return this.queue.length >= this.maxQueue
  }

  // Schedule a task to run when capacity is available
  schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: Task<T> = { fn, resolve, reject }
      this.queue.push(task)
      this.drain()
    })
  }

  private drain() {
    while (this.inFlight < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!
      this.inFlight++
      task
        .fn()
        .then((res) => task.resolve(res))
        .catch((err) => task.reject(err))
        .finally(() => {
          this.inFlight--
          // Use microtask to avoid deep recursion
          queueMicrotask(() => this.drain())
        })
    }
  }
}

const limiterRegistry = new Map<string, SimpleGlobalLimiter>()

export function getLimiter(
  key: string,
  opts?: LimiterOptions,
): SimpleGlobalLimiter {
  let lim = limiterRegistry.get(key)
  if (!lim) {
    lim = new SimpleGlobalLimiter(opts)
    limiterRegistry.set(key, lim)
  }
  return lim
}

// Exponential backoff fetch wrapper
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 1,
): Promise<Response> {
  let lastError: any = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after")
        const delay = retryAfter
          ? Number.parseInt(retryAfter, 10) * 1000
          : 2 ** attempt * 1000

        console.warn(
          `⚠️ Rate limited (attempt ${attempt}/${maxRetries}), retrying after ${delay}ms`,
        )

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        } else {
          throw new Error(`Rate limit exceeded after ${maxRetries} attempts`)
        }
      }

      // Success or other non-rate-limit error
      return response
    } catch (error) {
      captureException(error)
      console.error(
        `❌ Network error (attempt ${attempt}/${maxRetries}):`,
        error,
      )
      lastError = error

      if (attempt < maxRetries) {
        const delay = 2 ** attempt * 1000
        console.warn(`⚠️ Retrying after ${delay}ms`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error(`Failed after ${maxRetries} attempts`)
}
