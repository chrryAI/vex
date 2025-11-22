// Mock for web-only libraries in React Native
// This file is used to prevent web-only libraries from being bundled in native builds

module.exports = new Proxy(
  {},
  {
    get: function (target, prop) {
      if (prop === '__esModule') return true;
      if (prop === 'default')
        return function () {
          return null;
        };
      return function () {
        return null;
      };
    },
  },
);
