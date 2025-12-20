import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import path, { resolve } from "path"
import { mkdirSync, existsSync, writeFileSync } from "fs"
import * as esbuild from "esbuild"
import { viteStaticCopy } from "vite-plugin-static-copy"
import type { PluginOption } from "vite"
import { getSiteConfig } from "../../packages/ui/utils/siteConfig"

function chromeExtensionPlugin(): PluginOption {
  return {
    name: "chrome-extension",
    enforce: "post" as const,
    async writeBundle() {
      // Build background script separately
      await esbuild.build({
        entryPoints: {
          background: resolve(__dirname, "src/background.ts"),
        },
        bundle: true,
        format: "esm",
        outdir: "dist",
        target: "chrome58",
        minify: false,
        loader: {
          ".scss": "css",
          ".css": "css",
        },
      })
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const isFirefox =
    env.VITE_BROWSER === "firefox" || process.env.VITE_BROWSER === "firefox"
  const isProduction = command === "build"

  // Use MODE env var if set, otherwise use vite mode, otherwise default to vex
  const siteMode = process.env.MODE || mode || "vex"
  const siteConfig = getSiteConfig(siteMode)

  console.log("🔧 Build config:", {
    mode,
    isFirefox,
    isProduction,
    site: siteConfig.name,
    version: siteConfig.version,
    VITE_BROWSER: env.VITE_BROWSER || process.env.VITE_BROWSER,
  })

  const getHostPermissions = () => {
    // Always include both production and localhost
    // Extension will check at runtime which one is available
    const permissions = [
      `https://*.chrry.ai/*`,
      `https://chrry.dev/*`,
      mode === "development" && "http://localhost:5173/*",
      mode === "development" && "http://localhost:3001/*",
      // Add other dev URLs if needed
      // "http://localhost:3001/*"
    ]

    return permissions.filter(Boolean)
  }

  const getIconPath = (size: 16 | 32 | 48 | 128) =>
    siteConfig.slug === "chrry"
      ? `icons/blossom-icon-${size}.png`
      : `icons/${siteConfig.slug}-icon-${size}.png`

  // Manifest base
  const manifestBase = {
    manifest_version: 3,
    name: `${siteConfig.name} 🍒`,
    version: siteConfig.version || "1.7.57",
    description: siteConfig.description,
    permissions: isFirefox
      ? ["storage", "tabs", "contextMenus", "cookies"] // Firefox doesn't support sidePanel permission
      : ["storage", "sidePanel", "tabs", "contextMenus", "cookies"],
    host_permissions: getHostPermissions(),
    action: {
      default_title: siteConfig.name,
    },
    icons: {
      16: getIconPath(16),
      32: getIconPath(32),
      48: getIconPath(48),
      128: getIconPath(128),
    },
    background: isFirefox
      ? {
          scripts: ["background.js"],
        }
      : {
          service_worker: "background.js",
          type: "module",
        },
    ...(isFirefox
      ? {
          sidebar_action: {
            default_panel: "index.html",
            default_title: siteConfig.name,
            default_icon: {
              16: `icons/${siteConfig.slug}-icon-16.png`,
              32: `icons/${siteConfig.slug}-icon-32.png`,
              48: `icons/${siteConfig.slug}-icon-48.png`,
              128: `icons/${siteConfig.slug}-icon-128.png`,
            },
          },
        }
      : {
          side_panel: {
            default_path: "index.html",
          },
        }),
  }

  // Add browser_specific_settings for Firefox
  const manifest = isFirefox
    ? {
        ...manifestBase,
        browser_specific_settings: {
          gecko: {
            id: "iliyan@chrry.ai",
            strict_min_version: "109.0",
          },
        },
      }
    : manifestBase

  return {
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          {
            src: "public/icons", // copy from public/icons
            dest: "",
          },
        ],
      }),
      chromeExtensionPlugin(),
      {
        name: "replace-navigation-imports",
        enforce: "pre" as const,
        resolveId(source, importer) {
          // Intercept navigation.web imports and redirect to extension
          if (source.includes("navigation.web")) {
            return this.resolve(
              source.replace("navigation.web", "navigation.extension"),
              importer,
              { skipSelf: true },
            )
          }
          // Intercept next/navigation imports and redirect to stub
          if (source === "next/navigation") {
            return path.resolve(__dirname, "./src/stubs/next-navigation.ts")
          }
          return null
        },
      },
      {
        name: "write-manifest",
        enforce: "post" as const,
        closeBundle() {
          if (!existsSync("dist")) {
            mkdirSync("dist", { recursive: true })
          }
          console.log("📝 Writing manifest:", {
            isFirefox,
            hasServiceWorker: !!(manifest as any).background?.service_worker,
            hasScripts: !!(manifest as any).background?.scripts,
            hasExtensionId: !!(manifest as any).browser_specific_settings?.gecko
              ?.id,
          })
          writeFileSync(
            resolve(__dirname, "dist/manifest.json"),
            JSON.stringify(manifest, null, 2),
            "utf-8",
          )
        },
      },
    ],
    define: {
      // Vite requires string literals for replacement
      __DEV__: !isProduction,
      "import.meta.env.VITE_BROWSER": JSON.stringify(
        env.VITE_BROWSER || "chrome",
      ),
      "import.meta.env.VITE_IS_EXTENSION": JSON.stringify("true"),
      "import.meta.env.VITE_SITE_MODE": JSON.stringify(siteMode),
    },
    optimizeDeps: {
      exclude: ["next/navigation", "next/router"],
    },
    resolve: {
      alias: [
        { find: "@", replacement: path.resolve(__dirname, "./src") },
        // Map chrry/* to packages/ui/* (source, not dist)
        {
          find: /^chrry\/(.*)$/,
          replacement: path.resolve(__dirname, "../../packages/ui/$1"),
        },
        // Map chrry to source index, not package.json main
        {
          find: "chrry",
          replacement: path.resolve(__dirname, "../../packages/ui/index.ts"),
        },
        // Stub Next.js modules (extension doesn't use Next.js)
        {
          find: "next/navigation",
          replacement: path.resolve(
            __dirname,
            "./src/stubs/next-navigation.ts",
          ),
        },
        // Use extension-specific navigation (no Next.js hooks)
        {
          find: path.resolve(
            __dirname,
            "../../packages/ui/platform/navigation.web.ts",
          ),
          replacement: path.resolve(
            __dirname,
            "../../packages/ui/platform/navigation.extension.ts",
          ),
        },
        {
          find: path.resolve(
            __dirname,
            "../../packages/ui/platform/navigation.ts",
          ),
          replacement: path.resolve(__dirname, "./src/stubs/navigation.ts"),
        },
        {
          find: "chrry/platform/navigation.ts",
          replacement: path.resolve(__dirname, "./src/stubs/navigation.ts"),
        },
        {
          find: "chrry/platform/navigation",
          replacement: path.resolve(__dirname, "./src/stubs/navigation.ts"),
        },
      ],
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Don't auto-import globals to avoid @use conflicts
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html"),
        },
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name].[ext]",
          format: "es",
          dir: "dist",
          // Disable code-splitting for extensions - bundle everything together
          manualChunks: undefined,
          inlineDynamicImports: true,
        },
      },
      sourcemap: false, // Disabled for extensions - sourcemaps use eval() which violates CSP
      minify: isProduction ? "esbuild" : false,
      outDir: "dist",
      emptyOutDir: true,
    },
  }
})
