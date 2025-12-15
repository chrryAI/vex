import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
import type { UserConfig } from "vite"
import { swVersionPlugin } from "./vite-plugin-sw-version"
import dotenv from "dotenv"

// Load environment variables from .env file
// dotenv.config({ path: path.resolve(__dirname, "../../.env") })

// https://vite.dev/config/
export default defineConfig(({ command, mode, isSsrBuild }) => {
  const config: UserConfig = {
    plugins: [
      react({
        jsxRuntime: "automatic",
        jsxImportSource: "react",
      }),
      swVersionPlugin(),
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
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: undefined,
          format: "es", // Force ES module format
          // Only add Node.js polyfills for SSR builds, not client builds
          banner: isSsrBuild
            ? "import { createRequire } from 'module';import { fileURLToPath } from 'url';import { dirname } from 'path';const require = createRequire(import.meta.url);const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);globalThis.require = require;globalThis.__dirname = __dirname;globalThis.__filename = __filename;"
            : undefined,
        },
      },
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
