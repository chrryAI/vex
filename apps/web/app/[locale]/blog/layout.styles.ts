/**
 * Generated from layout.module.scss
 * Auto-converted SCSS to Unified Styles
 *
 * Works on both web and native! 🎉
 */

export const LayoutStyleDefs = {
  blogLayout: {
    maxWidth: "100%",
    paddingBottom: 30,
    borderRadius: 20,
  },
  left: {
    position: "absolute",
    left: 10,
    top: 10,
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexDirection: "row",
  },
} as const

import { createUnifiedStyles } from "chrry/styles/createUnifiedStyles"
import { createStyleHook } from "chrry/styles/createStyleHook"

export const LayoutStyles = createUnifiedStyles(LayoutStyleDefs)

// Type for the hook return value
type LayoutStylesHook = {
  [K in keyof typeof LayoutStyleDefs]: {
    className?: string
    style?: Record<string, any>
  }
}

// Create the style hook using the factory
export const useLayoutStyles = createStyleHook<LayoutStylesHook>(LayoutStyles)
