import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",
    }),
  ],
  server: {
    port: 5175,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      external: ["@capacitor-firebase/authentication", "firebase"],
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      stream: "stream-browserify",
    },
  },
  optimizeDeps: {
    exclude: ["@capacitor-firebase/authentication", "firebase"],
  },
})
