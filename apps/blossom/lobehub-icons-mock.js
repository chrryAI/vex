/**
 * Mock module for @lobehub/icons
 * Used by Metro bundler to prevent @lobehub/icons from being bundled in React Native
 * The actual icons are provided by BrandIcons.native.tsx
 */

// Export empty objects for all the icons that might be imported
// This prevents Metro from trying to bundle the actual @lobehub/icons package
export const DeepSeek = () => null;
export const OpenAI = () => null;
export const Claude = () => null;
export const Gemini = () => null;
export const Flux = () => null;
export const Perplexity = () => null;

// Export any other icons that might be used
export default {};
