/**
 * Generated from ChrryDotDev.module.scss
 * Auto-converted SCSS to Unified Styles
 *
 * Works on both web and native! 🎉
 */

export const ChrryDotDevStyleDefs = {
  container: {
    maxWidth: 600,
    margin: "0 auto",
    flexDirection: "column",
    display: "flex",
    padding: "5px 10px 20px 10px",
  },
  logo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    flexWrap: "wrap",
  },
  description: {
    display: "flex",
    marginTop: 0,
  },
  links: {
    marginTop: 10,
    display: "flex",
    gap: 25,
    marginBottom: 20,
  },
  link: {
    display: "inline-flex",
  },
  features: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  feature: {
    display: "flex",
    gap: 10,
  },
  vex: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
    width: "100%",
    flexWrap: "wrap",
  },
  featureTitle: {
    margin: 0,
    marginBottom: 5,
    display: "flex",
    gap: 3,
  },
} as const

import { createUnifiedStyles } from "./styles/createUnifiedStyles"
import { createStyleHook } from "./styles/createStyleHook"

export const ChrryDotDevStyles = createUnifiedStyles(ChrryDotDevStyleDefs)

// Type for the hook return value
type ChrryDotDevStylesHook = {
  [K in keyof typeof ChrryDotDevStyleDefs]: {
    className?: string
    style?: Record<string, any>
  }
}

// Create the style hook using the factory
export const useChrryDotDevStyles =
  createStyleHook<ChrryDotDevStylesHook>(ChrryDotDevStyles)
