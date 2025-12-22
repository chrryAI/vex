import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  build: {
    outDir: "dist",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@chrryai/chrry": path.resolve(__dirname, "../../packages/ui"),
    },
  },
})
