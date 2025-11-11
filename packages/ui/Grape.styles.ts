/**
 * Generated from Grape.module.scss
 * Auto-converted SCSS to Unified Styles
 *
 * Works on both web and native! 🎉
 */

export const GrapeStyleDefs = {
  icons: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    borderRadius: 40,
    border: "1px dashed var(--accent-1)",
    padding: 20,
    flex: 1,
    maxWidth: "100%",
  },
  title: {
    marginBottom: 8,
  },
} as const

import { createUnifiedStyles } from "chrry/styles/createUnifiedStyles"
import { createStyleHook } from "chrry/styles/createStyleHook"

export const GrapeStyles = createUnifiedStyles(GrapeStyleDefs)

// Type for the hook return value
type GrapeStylesHook = {
  [K in keyof typeof GrapeStyleDefs]: {
    className?: string
    style?: Record<string, any>
  }
}

// Create the style hook using the factory
export const useGrapeStyles = createStyleHook<GrapeStylesHook>(GrapeStyles)
