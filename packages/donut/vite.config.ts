import react from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      chrry: path.resolve(__dirname, "../../packages/ui"),
      "@chrryai/chrry": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
  ssr: {
    noExternal: ["@chrryai/chrry", "chrry"],
  },
})
