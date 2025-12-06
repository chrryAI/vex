// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

if (
  process.env.NEXT_PUBLIC_SENTRY === "true" &&
  process.env.NEXT_PUBLIC_SENTRY_DSN
) {
  Sentry.init({
    beforeSend(event, hint) {
      // Ignore Applebot DOM errors
      if (event.request?.headers?.["User-Agent"]?.includes("Applebot")) {
        return null
      }
      return event
    },
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Use custom tunnel to bypass ad blockers
    tunnel: "https://g.chrry.dev/api/submit/",

    // Add optional integrations for additional features
    integrations: [Sentry.replayIntegration()],

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    // Define how likely Replay events are sampled.
    // This sets the sample rate to be 10%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: 0,

    // Define how likely Replay events are sampled when an error occurs.
    replaysOnErrorSampleRate: 0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  })

  // Patch console.error to send errors to Sentry
  // if (
  //   typeof window !== "undefined" &&
  //   !(window as any).__sentryConsoleErrorPatched
  // ) {
  //   const originalConsoleError = console.error
  //   console.error = function (...args) {
  //     // Example: Ignore errors from browser extensions or known noisy sources
  //     if (
  //       typeof args[0] === "string" &&
  //       (args[0].includes("ResizeObserver") ||
  //         args[0].includes("Blocked a frame with origin") ||
  //         args[0].includes("SomeOtherNoisyError"))
  //     ) {
  //       // Don't send to Sentry
  //       return originalConsoleError.apply(console, args)
  //     }

  //     if (args[0] instanceof Error) {
  //       Sentry.captureException(args[0])
  //     } else if (typeof args[0] === "string") {
  //       Sentry.captureMessage(args[0], "error")
  //     }
  //     originalConsoleError.apply(console, args)
  //   }
  //   ;(window as any).__sentryConsoleErrorPatched = true
  // }
}

// Note: captureRouterTransitionStart was removed in Sentry v8
// Router transitions are now automatically tracked by Sentry
