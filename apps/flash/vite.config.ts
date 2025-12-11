import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    "process.env.API_PORT": JSON.stringify(process.env.API_PORT || "3001"),
    "process.env.NEXT_PUBLIC_CI": JSON.stringify(
      process.env.NEXT_PUBLIC_CI || "false",
    ),
    "process.env.NEXT_PUBLIC_TESTING_ENV": JSON.stringify(
      process.env.NEXT_PUBLIC_TESTING_ENV || "false",
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
    noExternal: [/^@lobehub\//, "uuid"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
      ignoreDynamicRequires: true, // Ignore dynamic requires that can't be resolved
    },
  },
})
