// Suppress ECONNRESET errors in development (from browser extensions/aborted requests)
if (process.env.NODE_ENV !== 'production') {
  const originalEmit = process.emit
  process.emit = function (event, ...args) {
    // Suppress ECONNRESET and EPIPE errors from aborted connections
    const error = args[0]
    if (error?.code === 'ECONNRESET' || error?.code === 'EPIPE') {
      return false
    }
    return originalEmit.apply(process, [event, ...args])
  }

  // Also suppress unhandled rejections for these errors
  process.on('unhandledRejection', (reason) => {
    if (reason?.code === 'ECONNRESET' || reason?.code === 'EPIPE') {
      return
    }
    console.error('Unhandled Rejection:', reason)
  })
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/db"],
  // Enable detailed logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  experimental: {
    optimizeCss: true,
    turbo: {
      rules: {
        "*.html": {
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
        source: '/api/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
    ]
  },
  webpack: (config, { isServer }) => {
    // Add path aliases to match tsconfig
    config.resolve.alias = {
      ...config.resolve.alias,
      "chrry": "@chrryai/chrry",
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
