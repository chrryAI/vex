import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["**/*.ts", "**/*.tsx"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/*.d.ts",
        "**/.next/**",
        "**/coverage/**",
      ],
    },
  },
})
