/**
 * Mock for react-dom in React Native
 * This prevents react-dom from being bundled in React Native apps
 * Components should use .native.tsx versions instead
 */

console.warn(
  '⚠️  react-dom is not available in React Native. Use .native.tsx component versions instead.',
);

// Export empty functions to prevent crashes
export const createPortal = () => {
  throw new Error(
    'createPortal is not available in React Native. Use Modal.native.tsx instead.',
  );
};

export const render = () => {
  throw new Error('render is not available in React Native');
};

export const hydrate = () => {
  throw new Error('hydrate is not available in React Native');
};

export default {
  createPortal,
  render,
  hydrate,
};
