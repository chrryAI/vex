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
    rollupOptions: {
      external: (id) => {
        // Mark Tauri APIs as external - they're provided by Tauri runtime
        return id.startsWith("@tauri-apps/")
      },
    },
  },
  optimizeDeps: {
    exclude: [
      // Tauri APIs are only available at runtime in Tauri environment
      "@tauri-apps/api",
      "@tauri-apps/api/window",
      "@tauri-apps/api/app",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@chrryai/chrry": path.resolve(__dirname, "../../packages/ui"),
    },
  },
})
