/**
 * Generated from Grape.module.scss
 * Auto-converted SCSS to Unified Styles
 *
 * Works on both web and native! 🎉
 */

export const GrapeStyleDefs = {
  grapeModal: {
    fontSize: 14,
  },
  icons: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    marginTop: 10,
  },
  icon: {
    borderRadius: 40,
    outline: 1,
    padding: 20,
    maxWidth: "100%",
    flex: 1,
  },
  iconSelected: {
    outline: 2,
  },
  title: {
    marginBottom: 5,
  },
  actions: {
    marginTop: 20,
    paddingTop: 10,
  },
  adConsent: {
    display: "flex",
    gap: 16,
  },
  adConsentAdConsent: {
    flex: 1,
  },
} as const

import { createUnifiedStyles } from "./styles/createUnifiedStyles"
import { createStyleHook } from "./styles/createStyleHook"

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
