/**
 * Generated from Agent.module.scss
 * Auto-converted SCSS to Unified Styles
 *
 * Works on both web and native! 🎉
 */

export const AgentStyleDefs = {
  newAgent: {
    margin: "0 auto",
  },
  modalContent: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    fontSize: 14,
  },
  footer: {
    flexWrap: "wrap",
    display: "none",
    justifyContent: "center",
    gap: 10,
    paddingTop: 10,
  },
  tabButton: {},
  tabButtonCurrentTab: {
    fontSize: 13,
    margin: "0 5px",
  },
  placeholder: {
    flex: 1,
  },
  instructionsContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    alignItems: "center",
    gap: 13,
  },
  required: {
    fontSize: 14,
    color: "var(--accent-1)",
  },
  instructionsButtonContainer: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  select: {
    marginLeft: "auto",
    borderRadius: "var(--radius)",
  },
  range: {
    marginLeft: "auto",
  },
  tabContent: {
    display: "flex",
    flexDirection: "column",
  },
  colorOptions: {
    display: "flex",
    gap: 6,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 15,
    padding: "10px 0 13px 0",
    paddingTop: 0,
  },
  label: {
    fontSize: 15,
    color: "var(--shade-7)",
  },
  instructionsButton: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  instructionsButtonIcon: {
    gap: 0,
  },
  instructions: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  settingsButton: {},
  settingsButtonStandalone: {
    display: "none",
  },
  updateModalDescription: {
    width: "100%",
  },
  modal: {
    width: "100%",
    margin: "0 auto !important",
    maxWidth: 550,
  },
  titleContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  titleInput: {
    maxWidth: 180,
    border: "1px dashed var(--accent-1) !important",
  },
  errorMessage: {
    fontSize: 12,
    color: "var(--accent-1)",
  },
} as const

import { createUnifiedStyles } from "chrry/styles/createUnifiedStyles"
import { createStyleHook } from "chrry/styles/createStyleHook"

export const AgentStyles = createUnifiedStyles(AgentStyleDefs)

// Type for the hook return value
type AgentStylesHook = {
  [K in keyof typeof AgentStyleDefs]: {
    className?: string
    style?: Record<string, any>
  }
}

// Create the style hook using the factory
export const useAgentStyles = createStyleHook<AgentStylesHook>(AgentStyles)
