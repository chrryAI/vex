module.exports = function (api) {
  api.cache(true)
  return {
    presets: [["babel-preset-expo", { jsxRuntime: "automatic" }]],
    plugins: [
      ["@babel/plugin-transform-class-properties", { loose: true }],
      ["@babel/plugin-transform-private-methods", { loose: true }],
      "react-native-reanimated/plugin", // Must be last
    ],
  }
}
