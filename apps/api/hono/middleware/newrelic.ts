import { Context, Next } from "hono"

// New Relic middleware for Hono (manual instrumentation)
// Since New Relic doesn't natively support Bun/Hono, we use custom instrumentation
export const newRelicMiddleware = (newrelic: any) => {
  // DISABLED: New Relic's startSegment API is not available in Bun runtime
  // Return no-op middleware to prevent crashes
  // TODO: Re-enable when New Relic adds proper Bun support
  return async (c: Context, next: Next) => next()

  /* Original implementation - disabled due to Bun incompatibility
  if (!newrelic) {
    return async (c: Context, next: Next) => next()
  }

  return async (c: Context, next: Next) => {
    const method = c.req.method
    const path = new URL(c.req.url).pathname
    const transactionName = `${method} ${path}`

    return newrelic.startSegment(
      transactionName,
      true,
      async () => {
        const transaction = newrelic.getTransaction()

        if (transaction) {
          transaction.nameState.setName("Hono", null, transactionName)
          transaction.addCustomAttribute("http.method", method)
          transaction.addCustomAttribute("http.url", path)
          transaction.addCustomAttribute("http.host", c.req.header("host") || "unknown")
          transaction.addCustomAttribute("framework", "hono")
          transaction.addCustomAttribute("runtime", "bun")
        }

        try {
          await next()
          if (transaction) {
            transaction.addCustomAttribute("http.statusCode", c.res.status)
          }
        } catch (error) {
          if (newrelic.noticeError) {
            newrelic.noticeError(error)
          }
          throw error
        }
      },
    )
  }
  */
}
