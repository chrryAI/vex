/**
 * Mock module for @lobehub/ui
 *
 * This provides empty/no-op implementations for all @lobehub/ui exports
 * to prevent errors when the library is imported but not actually used.
 */

import React from 'react';

// Create a no-op component
const NoOpComponent = () => null;

// Export common component names that might be imported
export const EmojiPicker = NoOpComponent;
export const Avatar = NoOpComponent;
export const Button = NoOpComponent;
export const Input = NoOpComponent;
export const Modal = NoOpComponent;
export const Tooltip = NoOpComponent;

// Export a default in case it's imported as default
export default {
  EmojiPicker: NoOpComponent,
  Avatar: NoOpComponent,
  Button: NoOpComponent,
  Input: NoOpComponent,
  Modal: NoOpComponent,
  Tooltip: NoOpComponent,
};
