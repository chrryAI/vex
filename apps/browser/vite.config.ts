import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import electron from "vite-plugin-electron"
import path from "path"

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: "src/main/index.ts",
        vite: {
          build: {
            outDir: "dist/main",
            lib: {
              entry: "src/main/index.ts",
              formats: ["es"],
            },
            rollupOptions: {
              external: ["electron"],
            },
          },
        },
      },
      {
        entry: "src/preload/index.ts",
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: "dist/preload",
            lib: {
              entry: "src/preload/index.ts",
              formats: ["cjs"],
              fileName: () => "index.cjs",
            },
            rollupOptions: {
              external: ["electron"],
              output: {
                format: "cjs",
              },
            },
          },
        },
      },
    ]),
  ],
  server: {
    port: 5174,
  },
  build: {
    outDir: "dist/renderer",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
