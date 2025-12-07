import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    "process.env.MODE": JSON.stringify(process.env.MODE || "development"),
  },
  ssr: {
    noExternal: [/^@lobehub\//, "uuid"],
  },
})
