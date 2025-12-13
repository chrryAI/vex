import { Context, Next } from "hono"

// New Relic middleware for Hono (manual instrumentation)
// Since New Relic doesn't natively support Bun/Hono, we manually track transactions
export const newRelicMiddleware = (newrelic: any) => {
  if (!newrelic) {
    // If New Relic not initialized, return no-op middleware
    return async (c: Context, next: Next) => next()
  }

  return async (c: Context, next: Next) => {
    // Start a web transaction
    return newrelic.startWebTransaction(c.req.url, async () => {
      const transaction = newrelic.getTransaction()

      if (transaction) {
        // Set transaction name to route pattern
        const method = c.req.method
        const path = new URL(c.req.url).pathname
        transaction.nameState.setName("Hono", null, `${method} ${path}`)

        // Add custom attributes
        transaction.addCustomAttribute("http.method", method)
        transaction.addCustomAttribute("http.url", path)
        transaction.addCustomAttribute("http.host", c.req.header("host"))
      }

      try {
        await next()

        // Record response status
        if (transaction) {
          transaction.addCustomAttribute("http.statusCode", c.res.status)
        }
      } catch (error) {
        // Report errors to New Relic
        if (transaction) {
          newrelic.noticeError(error)
        }
        throw error
      } finally {
        // End transaction
        if (transaction) {
          transaction.end()
        }
      }
    })
  }
}
