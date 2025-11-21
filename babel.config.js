module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: [
    // Required for Zod v4's "export * as" syntax
    "@babel/plugin-transform-export-namespace-from",
  ],
}
