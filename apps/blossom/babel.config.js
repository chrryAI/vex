module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Required for Zod v4's "export * as" syntax
    '@babel/plugin-transform-export-namespace-from',
    // Required for react-native-reanimated (must be listed last)
    'react-native-reanimated/plugin',
  ],
};
