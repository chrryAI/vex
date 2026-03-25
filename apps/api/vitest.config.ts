import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    env: {
      DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json", "clover"],
    },
  },
})
