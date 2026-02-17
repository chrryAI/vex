import { createRequire } from "module"
import path from "path"
import { fileURLToPath } from "url"
import { defineConfig } from "vitest/config"

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    alias: {
      // Resolve to absolute path of browser build to bypass exports check and force browser version
      uuid: path.resolve(
        path.dirname(require.resolve("uuid/package.json")),
        "dist/esm-browser/index.js",
      ),
    },
    deps: {
      interopDefault: true,
    },
    coverage: {
      reporter: ["text", "json", "html", "lcov"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
