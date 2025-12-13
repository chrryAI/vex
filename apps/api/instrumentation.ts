// New Relic instrumentation - must be first import
export async function register() {
  const isProduction = process.env.NODE_ENV === "production"
  const isCI = process.env.CI === "true"

  // Initialize New Relic for production (works with Bun/Node)
  if (isProduction && !isCI && process.env.NEW_RELIC_LICENSE_KEY) {
    await import("newrelic")
    console.log("✅ New Relic APM initialized")
  }
}
