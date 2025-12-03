import type { Plugin } from "vite"
import fs from "fs"
import path from "path"

/**
 * Vite plugin to resolve directory imports for @lobehub packages
 * These packages use directory imports which aren't supported in Node.js ESM
 */
export function lobehubResolver(): Plugin {
  return {
    name: "lobehub-resolver",
    enforce: "pre",
    resolveId(id, importer) {
      // Only handle @lobehub packages
      if (!id.startsWith("@lobehub/")) {
        return null
      }

      // Check if this is a directory import (no file extension)
      if (id.includes("/es/") && !id.endsWith(".js") && !id.endsWith(".mjs")) {
        // Try to resolve to index.js
        const possiblePaths = [
          `${id}/index.js`,
          `${id}/index.mjs`,
          `${id}.js`,
          `${id}.mjs`,
        ]

        // If we have an importer, resolve relative to it
        if (importer) {
          const importerDir = path.dirname(importer)

          for (const possiblePath of possiblePaths) {
            const resolved = path.resolve(importerDir, possiblePath)
            if (fs.existsSync(resolved)) {
              return resolved
            }
          }
        }

        // Try resolving from node_modules
        try {
          const resolved = require.resolve(possiblePaths[0])
          return resolved
        } catch {
          // If all else fails, append /index.js
          return `${id}/index.js`
        }
      }

      return null
    },
  }
}
