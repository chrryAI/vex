import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import viteCompression from "vite-plugin-compression"

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",
    }),
    viteCompression({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ],
  server: {
    port: 5175,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      external: ["@codetrix-studio/capacitor-google-auth", "firebase"],
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      stream: "stream-browserify",
    },
  },
  optimizeDeps: {
    exclude: ["@codetrix-studio/capacitor-google-auth", "firebase"],
  },
})
