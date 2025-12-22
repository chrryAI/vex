/**
 * Mock module for lucide-react
 * Used by Metro bundler to prevent lucide-react (web-only) from being bundled in React Native
 * React Native should use lucide-react-native instead
 */

console.warn(
  '⚠️  lucide-react was imported in React Native. This should not happen. Use lucide-react-native or import from ./icons instead.',
);

// Export empty to prevent errors
export default {};
