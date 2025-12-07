// Suppress ECONNRESET errors in development (from browser extensions/aborted requests)
import EventEmitter from "events"

const isDevelopment = process.env.NODE_ENV === "development"

if (process.env.NODE_ENV !== "production") {
  const originalEmit = EventEmitter.prototype.emit

  EventEmitter.prototype.emit = function (event, ...args) {
    // Suppress ECONNRESET and EPIPE errors from aborted connections
    if (event === "error") {
      const error = args[0]
      if (
        error?.code === "ECONNRESET" ||
        error?.code === "EPIPE" ||
        error?.message?.includes("aborted")
      ) {
        // console.log(
        //   "⚠️ Suppressed connection error:",
        //   error?.code || error?.message,
        // )
        return false
      }
    }
    return originalEmit.apply(this, [event, ...args])
  }

  // Also catch uncaught exceptions
  process.on("uncaughtException", (error) => {
    if (
      error?.code === "ECONNRESET" ||
      error?.code === "EPIPE" ||
      error?.message?.includes("aborted")
    ) {
      console.log(
        "⚠️ Suppressed uncaught exception:",
        error?.code || error?.message,
      )
      return
    }
    console.error("Uncaught Exception:", error)
    process.exit(1)
  })

  // Also suppress unhandled rejections for these errors
  process.on("unhandledRejection", (reason) => {
    if (reason?.code === "ECONNRESET" || reason?.code === "EPIPE") {
      console.log("⚠️ Suppressed unhandled rejection:", reason?.code)
      return
    }
    console.error("Unhandled Rejection:", reason)
  })
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/db"],
  serverExternalPackages: ["newrelic"], // Exclude New Relic from bundling
  // Enable detailed logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  experimental: {
    serverComponentsHmrCache: !isDevelopment,
    optimizeCss: true,
    turbo: {
      rules: {
        "*.html": {
          loaders: ["raw-loader"],
          as: "*.js",
        },
        "*.md": {
          loaders: ["raw-loader"],
          as: "*.js",
        },
      },
    },
  },
  // Ensure API routes take priority over pages
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Content-Type",
            value: "application/json",
          },
        ],
      },
    ]
  },
  webpack: (config, { isServer }) => {
    // Add path aliases to match tsconfig
    config.resolve.alias = {
      ...config.resolve.alias,
      chrry: "@chrryai/chrry",
    }

    // Suppress OpenTelemetry warnings from Sentry instrumentation
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        diagnostics_channel: false,
        async_hooks: false,
        fs: false,
        net: false,
        tls: false,
      }
    }

    // Ignore OpenTelemetry warnings
    config.ignoreWarnings = [
      { module: /node_modules\/@opentelemetry/ },
      { module: /node_modules\/@sentry\/node/ },
    ]

    return config
  },
}

export default nextConfig
