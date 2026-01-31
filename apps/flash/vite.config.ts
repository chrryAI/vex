import { defineConfig, type PluginOption, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
import type { UserConfig } from "vite"
import { swVersionPlugin } from "./vite-plugin-sw-version"
import { compression } from "vite-plugin-compression2"
import dotenv from "dotenv"

// Load environment variables from .env file
// dotenv.config({ path: path.resolve(__dirname, "../../.env") })

// Plugin to stub Tauri APIs in non-Tauri environments
function tauriStubPlugin(): PluginOption {
  return {
    name: "tauri-stub",
    enforce: "pre",
    resolveId(id) {
      if (id.startsWith("@tauri-apps/")) {
        return id // Mark as resolved
      }
    },
    load(id) {
      if (id.startsWith("@tauri-apps/")) {
        // Return empty stub that will fail gracefully
        return "export default {}; export const getCurrentWindow = () => ({});"
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), "")

  // Check E2E from both sources:
  // - loadEnv() reads .env files (local development)
  // - process.env reads runtime variables (CI/GitHub Actions)
  const isE2E = !!(
    env.VITE_TESTING_ENV === "e2e" ||
    env.TESTING_ENV === "e2e" ||
    process.env.VITE_TESTING_ENV === "e2e" ||
    process.env.TESTING_ENV === "e2e"
  )
  const config: UserConfig = {
    plugins: [
      tauriStubPlugin(), // Must be first to intercept Tauri imports
      react({
        jsxRuntime: "automatic",
        jsxImportSource: "react",
      }),
      swVersionPlugin(),
      // Generate gzip compressed files (client build only)
      ...(!isSsrBuild
        ? [
            compression({
              algorithm: "gzip",
              exclude: [/\.(br)$/, /\.(gz)$/],
              threshold: 1024,
              deleteOriginFile: false,
            }),
            // Generate brotli compressed files (better compression than gzip)
            compression({
              algorithm: "brotliCompress",
              exclude: [/\.(br)$/, /\.(gz)$/],
              threshold: 1024,
              deleteOriginFile: false,
            }),
          ]
        : []),
    ],
    publicDir: path.resolve(__dirname, "public"),
    resolve: {
      alias: {
        chrry: path.resolve(__dirname, "../../packages/ui"),
      },
    },
    define: {},
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
      external: ["i18n-iso-countries"], // Don't bundle - has dynamic requires
      noExternal: [/@lobehub\//, "@chrryai/chrry", "chrry"], // Force bundle @lobehub packages and chrry to fix directory imports
      resolve: {
        externalConditions: ["node", "import"],
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/server"],
      exclude: [
        // Tauri APIs are only available at runtime in Tauri environment
        "@tauri-apps/api",
        "@tauri-apps/api/window",
        "@tauri-apps/api/app",
      ],
    },
    build: {
      rollupOptions: {
        external: (id) => {
          // Mark Tauri APIs as external - they're provided by Tauri runtime
          // Only apply this for client builds, not SSR
          if (!isSsrBuild && id.startsWith("@tauri-apps/")) {
            return true
          }
          return false
        },
        output: {
          // Better chunk splitting for caching - only for client builds
          // Disable for SSR to avoid circular dependency issues
          manualChunks: isSsrBuild
            ? undefined
            : (id) => {
                // Vendor chunks
                if (id.includes("node_modules")) {
                  if (id.includes("react") || id.includes("react-dom")) {
                    return "react-vendor"
                  }
                  if (id.includes("framer-motion")) {
                    return "animation-vendor"
                  }
                  if (id.includes("@lobehub")) {
                    return "ui-vendor"
                  }
                  return "vendor"
                }
              },
          format: "es", // Force ES module format
          // Only add Node.js polyfills for SSR builds, not client builds
          banner: isSsrBuild
            ? "import { createRequire } from 'module';import { fileURLToPath } from 'url';import { dirname } from 'path';const require = createRequire(import.meta.url);const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);globalThis.require = require;globalThis.__dirname = __dirname;globalThis.__filename = __filename;"
            : undefined,
        },
      },
      // Enable minification (disable for E2E to see full React error messages)
      // CRITICAL: E2E must NEVER be minified, even with NODE_ENV=production
      minify: isE2E ? false : mode === "development" ? false : "terser",
      terserOptions: {
        compress: {
          drop_console: mode === "production", // Remove console.logs in production
          drop_debugger: true,
          pure_funcs: ["console.log", "console.info"], // Remove specific console methods
        },
      },
      // Enable source maps for Sentry
      // E2E/Dev: true (visible for debugging)
      // Production: "hidden" (upload to Sentry but don't expose to browser)
      sourcemap: isE2E || mode === "development" ? true : "hidden",
      // Increase chunk size warning limit (we're splitting chunks now)
      chunkSizeWarningLimit: 1000,
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
        ignoreDynamicRequires: true, // Ignore dynamic requires that can't be resolved
        defaultIsModuleExports: true,
      },
    },
  }

  return config
})
