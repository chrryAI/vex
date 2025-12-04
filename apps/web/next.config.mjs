import withPWA from "next-pwa"
import { withSentryConfig } from "@sentry/nextjs"
import withNextIntl from "next-intl/plugin"

const isDevelopment = process.env.NODE_ENV === "development"

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@chrryai/chrry"],
  compress: true,
  async redirects() {
    return [
      // Redirect askvex.com to vex.chrry.ai (preserve all paths)
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "askvex.com",
          },
        ],
        destination: "https://vex.chrry.ai/:path*",
        permanent: true, // 301 redirect
      },
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.askvex.com",
          },
        ],
        destination: "https://vex.chrry.ai/:path*",
        permanent: true,
      },
    ]
  },
  serverExternalPackages: [
    "@dnd-kit/core",
    "@dnd-kit/sortable",
    "@dnd-kit/utilities",
  ],
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ["lucide-react"], // Tree-shake icons only, chrry has client boundaries
  },
  turbopack: {
    resolveAlias: {
      // Block react-native packages from being bundled in turbopack
      // Turbopack doesn't accept 'false', so we use a mock file
      "react-native": "./react-native-mock.js",
      "react-native-mmkv": "./react-native-mock.js",
      "react-native-nitro-modules": "./react-native-mock.js",
    },
    rules: {
      "*.html": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },
  productionBrowserSourceMaps: false, // Temporarily enable for debugging
  generateBuildId: async () => {
    return process.env.GIT_SHA || Date.now().toString()
  },
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    }

    // Add path aliases to match tsconfig
    config.resolve.alias = {
      ...config.resolve.alias,
      chrry: "@chrryai/chrry",
    }

    // Silence package warnings (they're wrapped in try-catch)
    // Exclude React Native packages from both client and server bundles
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-native": false, // Block react-native completely on web
      "react-native-mmkv": false,
      "solito/router": false,
      "react-native-gesture-handler": false,
      "react-native-reanimated": false,
      "react-native-toast-message": false,
      "react-native-markdown-display": false,
      "react-native-draglist": false,
      "@invertase/react-native-apple-authentication": false,
      "@react-native-google-signin/google-signin": false,
      "@react-native-community/netinfo": false,
      "rn-emoji-keyboard": false,
      "expo-keep-awake": false,
    }

    // Ignore missing module warnings for optional dependencies
    config.ignoreWarnings = [
      { module: /react-native-mmkv/ },
      { module: /solito\/router/ },
    ]

    // Optimize CSS chunk splitting to reduce preload warnings
    if (!isServer && config.optimization) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          styles: {
            name: "styles",
            test: /\.(css|scss)$/,
            chunks: "all",
            enforce: true,
          },
        },
      }
    }

    // Exclude @dnd-kit packages from edge runtime (middleware)
    // These packages use React hooks that aren't available in edge runtime
    if (isServer && config.name === "edge-server") {
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push(
          "@dnd-kit/core",
          "@dnd-kit/sortable",
          "@dnd-kit/utilities",
        )
      }
    }

    return config
  },
}

// PWA configuration with development-aware caching
const withPwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // Only add caching in production
  runtimeCaching:
    process.env.NODE_ENV === "production"
      ? [
          {
            urlPattern: /^https?.*\/api\/.*$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 16,
                maxAgeSeconds: 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https?.*\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "pages-cache",
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ]
      : [], // Empty array in development
})

// Conditionally apply Sentry based on environment
const finalConfig = process.env.CI
  ? withNextIntl("./i18n/request.ts")(withPwaConfig(nextConfig))
  : withSentryConfig(
      withNextIntl("./i18n/request.ts")(withPwaConfig(nextConfig)),
      {
        org: "askvex",
        project: "askvex",
        sentryUrl: "https://a.chrry.dev",
        silent: !process.env.CI,
        widenClientFileUpload: true,
        tunnelRoute: "/monitoring",
        disableLogger: true,
        automaticVercelMonitors: true,
        sourcemaps: {
          disable: true,
        },
      },
    )

export default {
  ...finalConfig,
  compiler: {
    // ssr: !isDevelopment,
    // removeConsole: false,
    removeConsole:
      process.env.TESTING_ENV === "e2e"
        ? false
        : process.env.NODE_ENV === "production",
  },
}
