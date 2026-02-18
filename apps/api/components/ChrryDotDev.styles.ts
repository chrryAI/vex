/**
 * Generated from api.module.scss
 * Auto-converted SCSS to Unified Styles
 *
 * Works on both web and native! 🎉
 */

export const apiStyleDefs = {
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

import { createStyleHook } from "../../../packages/ui/styles/createStyleHook"
import { createUnifiedStyles } from "../../../packages/ui/styles/createUnifiedStyles"

export const apiStyles = createUnifiedStyles(apiStyleDefs)

// Type for the hook return value
type apiStylesHook = {
  [K in keyof typeof apiStyleDefs]: {
    className?: string
    style?: Record<string, any>
  }
}

// Create the style hook using the factory
export const useapiStyles = createStyleHook<apiStylesHook>(apiStyles)
