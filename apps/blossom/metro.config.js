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
    // Deduplicate React to prevent "Cannot read property 'useState' of null" error
    // This ensures all packages use the same React instance from apps/blossom
    extraNodeModules: {
      react: path.resolve(projectRoot, 'node_modules/react'),
      'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
      'react/jsx-runtime': path.resolve(
        projectRoot,
        'node_modules/react/jsx-runtime.js',
      ),
      'react/jsx-dev-runtime': path.resolve(
        projectRoot,
        'node_modules/react/jsx-dev-runtime.js',
      ),
      i18next: path.resolve(projectRoot, 'node_modules/i18next'),
      'react-i18next': path.resolve(projectRoot, 'node_modules/react-i18next'),
      'react-native-toast-message': path.resolve(
        projectRoot,
        'node_modules/react-native-toast-message',
      ),
      'react-hook-form': path.resolve(
        projectRoot,
        'node_modules/react-hook-form',
      ),
      swr: path.resolve(projectRoot, 'node_modules/swr'),
      uuid: path.resolve(projectRoot, 'node_modules/uuid'),
      zod: path.resolve(projectRoot, 'node_modules/zod'),
      '@hookform/resolvers': path.resolve(
        projectRoot,
        'node_modules/@hookform/resolvers',
      ),
      invariant: path.resolve(projectRoot, 'node_modules/invariant'),
      'prop-types': path.resolve(projectRoot, 'node_modules/prop-types'),
      'react-native-get-random-values': path.resolve(
        projectRoot,
        'node_modules/react-native-get-random-values',
      ),
      'react-native-svg': path.resolve(
        projectRoot,
        'node_modules/react-native-svg',
      ),
      'lucide-react-native': path.resolve(
        projectRoot,
        'node_modules/lucide-react-native',
      ),
    },
    // Block problematic modules that use dynamic imports
    blockList: [
      // Block React from workspace root to force using local copy
      new RegExp(`${workspaceRoot}/node_modules/react/`),
      new RegExp(`${workspaceRoot}/node_modules/react-dom/`),
      // Block React from packages/ui to force using local copy
      /packages\/ui\/node_modules\/react\//,
      /packages\/ui\/node_modules\/react-dom\//,
      // Block swr from packages/ui to force using local copy
      /packages\/ui\/node_modules\/swr\//,
      // Block @lobehub/ui's EmojiPicker which uses dynamic imports
      /node_modules\/@lobehub\/ui\/.*\/EmojiPicker/,
      // Block @emoji-mart packages that use dynamic imports
      /node_modules\/@emoji-mart\/data/,
      /node_modules\/@emoji-mart\/react/,
      /node_modules\/goober/, // Block goober CSS-in-JS library
    ],
    resolveRequest: (context, moduleName, platform) => {
      // Block react-dom for React Native
      if (platform === 'ios' || platform === 'android') {
        if (moduleName === 'react-dom' || moduleName.startsWith('react-dom/')) {
          console.warn(
            `⚠️  Blocked react-dom import in React Native. Use .native.tsx files instead.`,
          );
          return {
            type: 'sourceFile',
            filePath: path.resolve(__dirname, 'react-dom-mock.js'),
          };
        }

        // Redirect react-hot-toast to platform-agnostic toast for native
        if (moduleName === 'react-hot-toast') {
          return {
            type: 'sourceFile',
            filePath: path.resolve(
              workspaceRoot,
              'packages/ui/platform/toast.native.ts',
            ),
          };
        }

        // Fix copy-anything module resolution (used by superjson)
        // The package uses "exports" field but Metro needs explicit path
        if (moduleName === 'copy-anything') {
          const copyAnythingPath = path.resolve(
            workspaceRoot,
            'node_modules/.pnpm/superjson@2.2.3/node_modules/copy-anything/dist/index.js',
          );
          return {
            type: 'sourceFile',
            filePath: copyAnythingPath,
          };
        }

        // Block web-only libraries for React Native
        const webOnlyLibraries = [
          'react-select',
          'react-dnd',
          'react-dnd-html5-backend',
          'react-audio-play',
          '@dnd-kit/core',
          '@dnd-kit/sortable',
          '@dnd-kit/utilities',
          'react-icons',
          'react-native-markdown-display',
        ];

        if (
          webOnlyLibraries.some(
            lib => moduleName === lib || moduleName.startsWith(lib + '/'),
          )
        ) {
          console.warn(
            `⚠️  Blocked web-only library "${moduleName}" in React Native build. Create a .native.tsx version of the component using this library.`,
          );
          return {
            type: 'sourceFile',
            filePath: path.resolve(__dirname, 'web-only-mock.js'),
          };
        }
      }

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

        // Force React resolution to the app's node_modules
        // Let Metro handle react-native resolution automatically (it knows to skip .flow files)
        if (moduleName === 'react') {
          return {
            type: 'sourceFile',
            filePath: path.resolve(projectRoot, 'node_modules/react/index.js'),
          };
        }
        if (moduleName === 'react/jsx-runtime') {
          return {
            type: 'sourceFile',
            filePath: path.resolve(
              projectRoot,
              'node_modules/react/jsx-runtime.js',
            ),
          };
        }
        if (moduleName === 'react/jsx-dev-runtime') {
          return {
            type: 'sourceFile',
            filePath: path.resolve(
              projectRoot,
              'node_modules/react/jsx-dev-runtime.js',
            ),
          };
        }
        // Don't force react-native resolution - let Metro handle it
        // (Metro knows to use the correct entry point and skip Flow files)
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
