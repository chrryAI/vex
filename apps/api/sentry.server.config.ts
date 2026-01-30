// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/node"

// Patch console.error to send errors to Sentry (server-side)
if (process.env.VITE_SENTRY === "true" && process.env.SENTRY_DSN) {
  Sentry.init({
    beforeSend(event, _hint) {
      // Ignore Applebot DOM errors
      if (event.request?.headers?.["User-Agent"]?.includes("Applebot")) {
        return null
      }
      return event
    },
    dsn: process.env.SENTRY_DSN,

    // Set environment for GlitchTip filtering (e2e, development, production)
    environment:
      process.env.VITE_TESTING_ENV || process.env.NODE_ENV || "development",

    // Use custom tunnel to bypass ad blockers
    tunnel: "https://g.chrry.dev/api/submit/",

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  })
}
