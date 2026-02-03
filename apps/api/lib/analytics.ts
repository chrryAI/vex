import { isDevelopment } from "."
import { user, guest } from "@repo/db"

/**
 * Send a server-side event to Plausible Analytics
 * Non-blocking: fires and forgets
 */
export const serverPlausibleEvent = ({
  name,
  url,
  domain,
  props = {},
  u,
}: {
  name: string
  url?: string
  domain?: string
  props?: Record<string, any>
  u?: string
}) => {
  //   if (process.env.NODE_ENV !== "production") return

  // Default to the first white-label domain if not specified or unknown
  // Ideally, we passed the 'App-Id' or 'Origin' to resolve the domain
  const targetDomain = isDevelopment ? "local.chrry.ai" : domain || "chrry.dev"
  const PLAUSIBLE_HOST = process.env.PLAUSIBLE_HOST || "https://a.chrry.dev"

  // Construct the full URL for the event
  // If 'u' is provided (path), append it. Otherwise use the full 'url' if given.
  // Fallback to just the domain root.
  const pageUrl = url
    ? url
    : `https://${targetDomain}${u?.startsWith("/") ? u : `/${u || ""}`}`

  const payload = {
    name,
    url: pageUrl,
    domain: targetDomain,
    props,
  }

  // Fire and forget - don't await this
  fetch(`${PLAUSIBLE_HOST}/api/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Chrry-Server/1.0",
      "X-Forwarded-For": "127.0.0.1", // Server-side event
    },
    body: JSON.stringify(payload),
  })
    .catch((err) => {
      // Silently fail in production to avoid log spam, or log debug in dev
      if (isDevelopment) {
        console.warn(`🚨 ~ serverPlausibleEvent err:`, err)
      }
    })
    .then((res) => {
      if (isDevelopment) {
        console.log(`🤖 ~ Plausible event sent:`, res)
      }
    })
}

/**
 * Higher-order function to measure execution time of a promise
 * Logs a 'Function Duration' event to Plausible with the duration in ms
 */
export async function withDurationLogging<T>(
  name: string,
  fn: () => Promise<T>,
  props: Record<string, any> = {},
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = Math.round(performance.now() - start)

    serverPlausibleEvent({
      name: "Server Function Duration",
      u: "/api/server-timing",
      props: {
        function_name: name,
        duration_ms: duration,
        success: true,
        ...props,
      },
    })

    return result
  } catch (error) {
    const duration = Math.round(performance.now() - start)

    serverPlausibleEvent({
      name: "Server Function Duration",
      u: "/api/server-timing",
      props: {
        function_name: name,
        duration_ms: duration,
        success: false,
        error_type:
          error instanceof Error
            ? error.constructor?.name || "Error"
            : "UnknownError",
        error_message: isDevelopment
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
        ...props,
      },
    })
    throw error
  }
}

/**
 * Utility for tracking detailed performance metrics of a workflow
 * Accumulates durations of multiple steps and sends a single summary event
 */
export class PerformanceTracker {
  private start: number
  private steps: Record<string, number> = {}
  private workflowName: string

  constructor(workflowName: string) {
    this.workflowName = workflowName
    this.start = performance.now()
  }

  /**
   * Measure a specific step in the workflow
   */
  async track<T>(stepName: string, fn: () => Promise<T>): Promise<T> {
    const stepStart = performance.now()
    try {
      const result = await fn()
      this.steps[`${stepName}_ms`] = Math.round(performance.now() - stepStart)
      return result
    } catch (error) {
      this.steps[`${stepName}_ms`] = Math.round(performance.now() - stepStart)
      throw error
    }
  }

  /**
   * Submit the collected metrics to Plausible
   */
  submit(
    additionalProps: Record<string, any> = {},
    { user, guest }: { user?: user; guest?: guest } = {},
  ) {
    const totalDuration = Math.round(performance.now() - this.start)

    serverPlausibleEvent({
      name: "Performance Metric",
      u: "/api/performance",
      props: {
        workflow: this.workflowName,
        city: user?.city || guest?.city,
        country: user?.country || guest?.country,
        total_duration_ms: totalDuration,
        ...this.steps,
        ...additionalProps,
      },
    })
  }
}
