// New Relic instrumentation - must be first import
export async function register() {
  const isProduction = process.env.NODE_ENV === "production"
  const isCI = process.env.NEXT_PUBLIC_CI || process.env.CI
  if (process.env.NEXT_RUNTIME === "nodejs" && isProduction && !isCI) {
    await import("newrelic")
  }
}
