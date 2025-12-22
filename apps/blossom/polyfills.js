/**
 * React Native Polyfills for Web APIs
 *
 * This file provides minimal polyfills for web-only APIs (document, window, etc.)
 * to prevent runtime errors when importing cross-platform components that
 * reference these APIs but may not actually use them in React Native.
 */

// Create a minimal document polyfill
if (typeof document === 'undefined') {
  global.document = {
    createElement: () => ({}),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    body: {
      appendChild: () => {},
      removeChild: () => {},
      style: {},
      scrollHeight: 0,
    },
    head: {
      appendChild: () => {},
    },
    documentElement: {
      scrollHeight: 0,
      style: {},
    },
    activeElement: null,
    title: '',
    startViewTransition: undefined,
  };
}

// Ensure window exists and has necessary properties
if (typeof window !== 'undefined') {
  if (!window.document) {
    window.document = global.document;
  }
}
