import { Context, Next } from "hono"

// New Relic middleware for Hono (manual instrumentation)
// Since New Relic doesn't natively support Bun/Hono, we use custom instrumentation
export const newRelicMiddleware = (newrelic: any) => {
  if (!newrelic) {
    // If New Relic not initialized, return no-op middleware
    return async (c: Context, next: Next) => next()
  }

  return async (c: Context, next: Next) => {
    const method = c.req.method
    const path = new URL(c.req.url).pathname
    const transactionName = `${method} ${path}`

    // Use startSegment for custom instrumentation in Bun/Hono
    return newrelic.startSegment(
      transactionName,
      true, // record as web transaction
      async () => {
        const transaction = newrelic.getTransaction()

        if (transaction) {
          // Set transaction name
          transaction.nameState.setName("Hono", null, transactionName)

          // Add custom attributes
          transaction.addCustomAttribute("http.method", method)
          transaction.addCustomAttribute("http.url", path)
          transaction.addCustomAttribute(
            "http.host",
            c.req.header("host") || "unknown",
          )
          transaction.addCustomAttribute("framework", "hono")
          transaction.addCustomAttribute("runtime", "bun")
        }

        try {
          await next()

          // Record response status
          if (transaction) {
            transaction.addCustomAttribute("http.statusCode", c.res.status)
          }
        } catch (error) {
          // Report errors to New Relic
          if (newrelic.noticeError) {
            newrelic.noticeError(error)
          }
          throw error
        }
      },
    )
  }
}
