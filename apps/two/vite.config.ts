import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { lobehubResolver } from "./vite-plugin-lobehub"

export default defineConfig({
  plugins: [lobehubResolver(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      ui: path.resolve(__dirname, "../../packages/ui"),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
    exclude: ["@lobehub/icons"],
  },
  build: {
    minify: true,
    sourcemap: true,
  },
  ssr: {
    // Don't externalize these packages in SSR - they need to be bundled
    noExternal: [
      "ui",
      "@lobehub/icons",
      "@lobehub/ui",
      "@lobehub/tts",
      // Bundle all lobehub packages to avoid directory import issues
      /^@lobehub\//,
    ],
  },
})
