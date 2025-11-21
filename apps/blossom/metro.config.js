const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration for monorepo
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */

// Get the workspace root (two levels up from apps/blossom)
const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;

const config = {
  watchFolders: [workspaceRoot],
  transformer: {
    // Enable inline source maps for better error reporting
    inlineRequires: false,
  },
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    // Block problematic modules that use dynamic imports
    blockList: [
      // Block @lobehub/ui's EmojiPicker which uses dynamic imports
      /node_modules\/@lobehub\/ui\/.*\/EmojiPicker/,
      // Block @emoji-mart packages that use dynamic imports
      /node_modules\/@emoji-mart\/data/,
      /node_modules\/@emoji-mart\/react/,
      /node_modules\/goober/, // Block goober CSS-in-JS library
    ],
    resolveRequest: (context, moduleName, platform) => {
      // Block @lobehub/ui imports completely (has dynamic imports)
      if (
        moduleName === '@lobehub/ui' ||
        moduleName.startsWith('@lobehub/ui/')
      ) {
        // Return a resolved module pointing to an empty mock file
        return {
          type: 'sourceFile',
          filePath: path.resolve(__dirname, 'lobehub-ui-mock.js'),
        };
      }
      // Block @lobehub/icons for React Native (it depends on @lobehub/ui)
      // Web will still use it via index.web.tsx
      if (platform === 'ios' || platform === 'android') {
        if (
          moduleName === '@lobehub/icons' ||
          moduleName.startsWith('@lobehub/icons/')
        ) {
          // Return empty mock to prevent bundling
          return {
            type: 'sourceFile',
            filePath: path.resolve(__dirname, 'lobehub-icons-mock.js'),
          };
        }
        // Block lucide-react (web-only) for React Native
        // React Native should use lucide-react-native instead
        if (
          moduleName === 'lucide-react' ||
          moduleName.startsWith('lucide-react/')
        ) {
          console.warn(
            `⚠️  Blocked lucide-react import in React Native. Use lucide-react-native instead.`,
          );
          return {
            type: 'sourceFile',
            filePath: path.resolve(__dirname, 'lucide-react-mock.js'),
          };
        }
      }
      // Let Metro handle all other requests
      // Block goober (used by motion) for React Native builds
      if (platform === 'ios' || platform === 'android') {
        if (moduleName === 'goober' || moduleName.startsWith('goober/')) {
          return {
            type: 'sourceFile',
            filePath: path.resolve(__dirname, 'goober-mock.js'),
          };
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
