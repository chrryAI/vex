// New Relic instrumentation - must be first import
export async function register() {
  const isProduction = process.env.NODE_ENV === "production"
  if (process.env.NEXT_RUNTIME === "nodejs" && isProduction) {
    await import("newrelic")
  }
}
