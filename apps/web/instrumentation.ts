// New Relic instrumentation - must be first import
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("newrelic")
  }
}
