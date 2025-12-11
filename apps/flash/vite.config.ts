import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",
      jsxImportSource: "react",
    }),
  ],
  publicDir: path.resolve(__dirname, "../web/public"),
  resolve: {
    alias: {
      chrry: path.resolve(__dirname, "../../packages/ui"),
    },
  },
  define: {
    // Make process.env available for compatibility with Next.js code
    "process.env.NEXT_PUBLIC_FE_PORT": JSON.stringify(
      process.env.NEXT_PUBLIC_FE_PORT || "3000",
    ),
    "process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    ),
    "process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID": JSON.stringify(
      process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    ),
    "process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID": JSON.stringify(
      process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    ),
    "process.env.NEXT_PUBLIC_SENTRY_DSN": JSON.stringify(
      process.env.NEXT_PUBLIC_SENTRY_DSN,
    ),
    "process.env.NEXT_PUBLIC_SITE_MODE": JSON.stringify(
      process.env.NEXT_PUBLIC_SITE_MODE || "chrryAI",
    ),
    "process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY": JSON.stringify(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    ),
    "process.env.API_PORT": JSON.stringify(process.env.API_PORT || "3001"),
    "process.env.NEXT_PUBLIC_CI": JSON.stringify(
      process.env.NEXT_PUBLIC_CI || "false",
    ),
    "process.env.NEXT_PUBLIC_TESTING_ENV": JSON.stringify(
      process.env.NEXT_PUBLIC_TESTING_ENV || "false",
    ),
    "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api",
    ),
    "process.env.NEXT_PUBLIC_WS_URL": JSON.stringify(
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5001",
    ),
    "process.env.NEXT_PUBLIC_NODE_ENV": JSON.stringify(
      process.env.NEXT_PUBLIC_NODE_ENV || "development",
    ),
    "process.env.TEST_MEMBER_FINGERPRINTS": JSON.stringify(
      process.env.TEST_MEMBER_FINGERPRINTS,
    ),
    "process.env.TEST_GUEST_FINGERPRINTS": JSON.stringify(
      process.env.TEST_GUEST_FINGERPRINTS,
    ),
    "process.env.MODE": JSON.stringify(process.env.MODE || "development"),
  },
  server: {
    proxy: {
      "/auth": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/auth/, "/api/auth"),
      },
    },
  },
  ssr: {
    external: ["i18n-iso-countries", "bcrypt"], // Don't bundle - has dynamic requires
    noExternal: [/@lobehub\//], // Force bundle @lobehub packages to fix directory imports
    resolve: {
      externalConditions: ["node", "import"],
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/server"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
        format: "es", // Force ES module format
      },
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
      ignoreDynamicRequires: true, // Ignore dynamic requires that can't be resolved
      defaultIsModuleExports: true,
    },
  },
})
