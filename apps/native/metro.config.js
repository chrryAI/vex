// Learn more https://docs.expo.dev/guides/monorepos
// Learn more https://docs.expo.io/guides/customizing-metro
/**
 * @type {import('expo/metro-config')}
 */
const { getDefaultConfig } = require("expo/metro-config")
const path = require("path")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "../..")

const config = getDefaultConfig(projectRoot)

// Monorepo support
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]
config.resolver.disableHierarchicalLookup = true

config.resolver.sourceExts.push("mjs")

// Platform-specific file resolution
// Prioritize .native.ts over .ts for React Native
config.resolver.sourceExts = [
  "native.tsx",
  "native.ts",
  "native.jsx",
  "native.js",
  ...config.resolver.sourceExts,
]

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
})

// Force transpilation of problematic node_modules packages
config.transformer.unstable_allowRequireContext = true
config.resolver.sourceExts.push("cjs")

// Disable React DevTools to prevent EventTarget class errors in Hermes
// Return a mock module that provides no-op functions
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-devtools-core' || moduleName.includes('react-devtools')) {
    return {
      type: 'sourceFile',
      filePath: require.resolve('./devtools-mock.js'),
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
