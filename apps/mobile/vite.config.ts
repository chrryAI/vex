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
  },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "@capacitor-firebase/authentication",
      "firebase",
    ],
    alias: {
      stream: "stream-browserify",
    },
  },
  optimizeDeps: {
    include: ["@capacitor-firebase/authentication", "firebase"],
  },
})
