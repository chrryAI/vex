/**
 * Generated from Chat.module.scss
 * Auto-converted SCSS to Unified Styles
 *
 * Works on both web and native! 🎉
 */

export const ChatStyleDefs = {
  drawerOpen: {},
  standalone: {
    bottom: 5,
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  focus: {
    borderColor: "var(--accent-5)",
    boxShadow: 5,
  },
  placeholderGlow: {
    opacity: 1,
    transform: 0,
  },
  videoContainer: {
    base: {
      position: "absolute",
      backgroundColor: "#000",
      padding: 2,
      width: 34,
      height: 34,
      display: "none",
      borderRadius: "50%",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "var(--shadow)",
      right: -2,
      border: "1px solid transparent",
    },
    hover: {
      borderColor: "var(--accent-1)",
    },
  },
  sendButton: {
    position: "relative",
    right: -2,
  },
  hourlyLimit: {
    fontSize: 12,
    color: "var(--shade-6)",
    display: "flex",
    alignItems: "center",
    gap: 5,
    position: "relative",
  },
  conversation: {
    display: "flex",
    flexDirection: "column",
    gap: 15,
  },
  statItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
    color: "var(--shade-8)",
    fontWeight: 500,
    fontFamily: "var(--font-mono)",
  },
  actions: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  chatContainerWrapper: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    gap: 12,
  },
  chatTextArea: {
    base: {
      width: "100%",
      display: "flex",
      height: "var(--textarea-height, auto)",
      overflowY: "hidden",
      paddingRight: 0,
      opacity: 0,
    },
    hover: {
      border: "none",
      outline: "none",
      backgroundColor: "transparent",
    },
  },
  top: {
    marginBottom: 10,
  },
  topInner: {
    backgroundColor: "var(--shade-1)",
    border: "1px solid var(--shade-2)",
    padding: 5,
    borderRadius: "var(--radius)",
  },
  collaborationStep3: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--shade-2-transparent)",
    border: "1px solid var(--shade-2)",
    padding: 5,
    borderRadius: "var(--radius)",
  },
  debateAgentButton: {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    gap: 5,
    bottom: -5,
    right: -5,
  },
  scrollDownButton: {
    marginLeft: "auto",
  },
  chatContainer: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    bottom: 5,
    maxWidth: 600,
    zIndex: 1000,
  },
  brandHelp: {
    textAlign: "center",
    fontSize: 18,
    lineHeight: 1.2,
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 0,
    marginBottom: 13,
  },
  shareTooltip: {
    alignItems: "center",
    justifyContent: "center",
    display: "flex",
    position: "relative",
    bottom: 5,
    backgroundColor: "var(--shade-2-transparent)",
    border: "1px solid var(--shade-2)",
    zIndex: 9999,
    borderRadius: "var(--radius)",
    padding: 10,
    marginBottom: 10,
  },
  generateImagesButtonContainer: {
    display: "none",
  },
  collaborateButton: {
    position: "relative",
  },
  collaborateButtonSparkles: {
    position: "absolute",
    top: 17,
    left: 22,
  },
  content: {
    textAlign: "center",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  creditInfoText: {
    display: "flex",
    alignItems: "center",
    gap: 3,
  },
  creditCost: {
    gap: 5,
    fontSize: 12,
    display: "none",
  },
  instructionsBottom: {
    display: "flex",
    fontSize: 13,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  loginButton: {
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  attachButtons: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  filePreviewArea: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: "var(--shade-1)",
    margin: "-3px -10px 0 -10px",
    position: "relative",
    left: 7,
    borderRadius: 16,
  },
  filePreview: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    backgroundColor: "var(--shade-0)",
    border: "1px solid var(--shade-2)",
    borderRadius: 12,
    fontSize: 14,
    color: "var(--accent-6)",
  },
  filePreviewImage: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: "var(--shade-2)",
  },
  filePreviewIcon: {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--shade-2)",
    borderRadius: 4,
    color: "var(--accent-5)",
  },
  filePreviewInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  filePreviewName: {
    fontWeight: 500,
    fontSize: 13,
    maxWidth: 80,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  filePreviewSize: {
    fontSize: 11,
    color: "var(--accent-4)",
  },
  filePreviewClear: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: "50%",
    color: "var(--accent-0)",
    border: "2px solid var(--shade-0)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  attachButtonSelected: {
    color: "var(--accent-4)",
    backgroundColor: "var(--shade-1)",
  },
  attachButtonDisabled: {
    color: "var(--shade-2)",
  },
  voiceButtonListening: {},
  quotaDisplay: {
    padding: "5px 0",
    fontSize: 13,
    position: "relative",
    left: 6,
  },
  quotaHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 500,
    marginBottom: 8,
    color: "var(--accent-6)",
  },
  quotaItems: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  quotaItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "var(--shade-6)",
  },
  quotaReset: {
    marginLeft: "auto",
    fontSize: 12,
    color: "var(--shade-5)",
  },
  capabilitiesLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 3,
  },
  creditInfo: {
    fontSize: 13,
    color: "var(--shade-7)",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "5px 10px",
    gap: 5,
    textAlign: "center",
    marginBottom: 8,
  },
  creditInfoStandalone: {},
  chatFooter: {
    position: "absolute",
    bottom: 3,
    padding: "5px 10px",
    left: 0,
    right: 0,
    display: "flex",
    alignItems: "flex-end",
  },
  voiceButton: {
    display: "flex",
  },
  chatFooterButtons: {
    display: "flex",
    alignItems: "flex-end",
    gap: 13,
    marginLeft: "auto",
    fontSize: 12,
  },
  chatFooterButtonsExtension: {
    gap: 8,
  },
  agentButtonModal: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  agentButtonModalActive: {
    backgroundColor: "var(--accent-6)",
  },
  agentButtonModalFavorite: {
    backgroundColor: "var(--accent-1)",
  },
  agentButtonModalInactive: {
    backgroundColor: "var(--shade-3)",
    color: "var(--shade-1)",
  },
  agentButtonModalCurrent: {
    backgroundColor: "var(--accent-4)",
  },
  agentButtonContainer: {
    display: "flex",
    alignItems: "center",
    gap: 15,
  },
  speechModalTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  speechModalTitleButton: {
    marginLeft: "auto",
  },
  title: {
    fontDisplay: "swap",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontSize: "clamp(1.2rem, 4vw, 1.625rem)",
    margin: "0 0 15px 0",
    gap: 5,
  },
  modalTitle: {
    margin: 0,
  },
  modalContent: {
    display: "flex",
    flexDirection: "column",
    gap: 13,
  },
  buttonContainer: {
    display: "flex",
    alignItems: "center",
    gap: 15,
    flex: 1,
    width: "100%",
  },
  stateLabel: {
    fontSize: 14,
    color: "var(--shade-7)",
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  stateLabelContainer: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginLeft: "auto",
  },
  suggestionsContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    alignItems: "center",
    gap: 13,
  },
  enableTasksButton: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  suggestions: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  suggestion: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    color: "var(--shade-6)",
    fontSize: 14,
    textAlign: "center",
  },
  suggestionSelected: {
    color: "var(--accent-6)",
  },
  suggestionsList: {
    opacity: 0,
  },
  suggestionItem: {
    opacity: 0,
  },
  imageGenerationButton: {
    position: "absolute",
    right: 8,
    top: 8,
  },
  agentModalDescription: {
    fontSize: 14,
    color: "var(--shade-7)",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
  },
  agentButton: {
    display: "flex",
    alignItems: "center",
    gap: 3,
  },
  agentName: {
    maxWidth: 75,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  agentModal: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-start",
    maxWidth: 599,
  },
  video: {
    display: "none",
  },
  videoContainerLoading: {
    display: "inline",
  },
} as const

import { createUnifiedStyles } from "chrry/styles/createUnifiedStyles"
import { useInteractiveStyles } from "chrry/styles/useInteractiveStyles"

export const ChatStyles = createUnifiedStyles(ChatStyleDefs)

// ---- Stronger types for style defs and hook results ----

// A minimal shape for a style object. You can expand this later to be more specific
// (e.g., union of CSS properties used across web/native).
type StyleObject = {
  [key: string]: string | number | boolean | StyleObject | undefined
}

// Interactive (hover/focus/etc.) style definition
type InteractiveStyleDef = {
  base: StyleObject
  hover?: StyleObject
  active?: StyleObject
  focus?: StyleObject
  disabled?: StyleObject
}

// Static style definition is simply a style object
type StaticStyleDef = StyleObject

// explicit static result shape for non-interactive classes
type StaticStyleResult = {
  style: StaticStyleDef
  handlers: Record<string, never>
  state: { isHovered: false; isPressed: false; isFocused: false }
}

// interactive style hook result (keeps your existing hook return type)
type InteractiveStyleResult = ReturnType<typeof useInteractiveStyles>

// Create a discriminated mapped type so each key gets the right result type
export type ChatStylesHook = {
  [K in keyof typeof ChatStyleDefs]: (typeof ChatStyleDefs)[K] extends {
    base: any
  }
    ? InteractiveStyleResult
    : StaticStyleResult
}

// Type guard to narrow a StyleDef to InteractiveStyleDef without using any casts
function isInteractiveStyleDef(def: unknown): def is InteractiveStyleDef {
  return (
    typeof def === "object" &&
    def !== null &&
    Object.prototype.hasOwnProperty.call(def, "base")
  )
}

// Create interactive style hooks (safe - calls hooks deterministically)
export const useChatStyles = (): ChatStylesHook => {
  // Call all hooks upfront in a stable order (Rules of Hooks compliant)
  const styleResults: Partial<Record<keyof typeof ChatStyleDefs, any>> = {}

  // Use Object.keys to ensure consistent iteration order across environments
  const keys = Object.keys(ChatStyleDefs) as Array<keyof typeof ChatStyleDefs>

  for (const className of keys) {
    const styleDef = ChatStyleDefs[className]

    if (isInteractiveStyleDef(styleDef)) {
      // styleDef is narrowed to InteractiveStyleDef here (no any cast needed)
      const {
        base = {},
        hover = {},
        active = {},
        focus = {},
        disabled = {},
      } = styleDef

      // Call useInteractiveStyles for interactive styles
      styleResults[className] = useInteractiveStyles({
        baseStyle: base,
        hoverStyle: hover,
        activeStyle: active,
        focusStyle: focus,
        disabledStyle: disabled,
      })
    } else {
      // Static styles - no hook needed
      // styleDef is narrowed to StaticStyleDef here
      styleResults[className] = {
        style: styleDef as StaticStyleDef,
        handlers: {},
        state: { isHovered: false, isPressed: false, isFocused: false },
      }
    }
  }

  return styleResults as ChatStylesHook
}
