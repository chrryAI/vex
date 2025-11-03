/**
 * Generated from Moodify.module.scss
 * Auto-converted SCSS to Unified Styles
 *
 * Works on both web and native! 🎉
 */

export const MoodifyStyleDefs = {
  moodify: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    marginBottom: 12,
  },
  moodifyDrawerOpen: {
    left: 255,
  },
  moodifyChatOpen: {
    marginBottom: 0,
  },
  chatOpen: {
    paddingBottom: 10,
  },
  content: {
    padding: "15px 15px 10px 15px",
    backgroundColor: "var(--background-transparent)",
    border: "1px solid var(--shade-2-transparent)",
    borderRadius: 20,
    position: "relative",
  },
  chevronDown: {
    position: "absolute",
    bottom: -23,
    left: "50%",
    color: "var(--shade-3)",
    zIndex: 10000,
  },
  emojiContainer: {
    display: "flex",
    gap: 7,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  tryMoodTracker: {
    marginTop: -5,
    marginBottom: 5,
    fontSize: 11,
    textAlign: "center",
  },
  loadingMood: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  startChat: {
    marginTop: 7,
    display: "flex",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  startChatButton: {
    display: "flex",
    position: "relative",
    gap: 5,
    alignItems: "center",
    flexDirection: "row",
    padding: "5px 10px",
  },
  salutation: {
    textAlign: "center",
    marginBottom: 8,
    fontSize: 14,
  },
  mobile: {
    display: "inline",
  },
  desktop: {
    display: "none",
  },
  moodSelector: {
    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 24,
  },
  chatContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
  },
  loadingMessage: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },
  nextMessagesPage: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  chatBox: {
    backgroundColor: "var(--shade-1-transparent)",
    borderRadius: 0,
    maxWidth: 431,
    height: "calc(100vh - 80px)",
    width: "100%",
    margin: "0 auto",
    position: "relative",
    display: "flex",
    flexDirection: "column",
  },
  footer: {
    marginTop: "auto",
  },
  credits: {
    marginTop: 7,
    marginBottom: 0,
    paddingLeft: 20,
    fontSize: 11,
    color: "var(--shade-6)",
  },
  chartCandlestick: {
    position: "relative",
    top: 1,
    left: 3,
  },
  editButton: {
    fontSize: 11,
  },
  notification: {
    position: "absolute",
    top: -7,
    right: -7,
    fontSize: 16,
  },
  notificationIOS: {
    top: -8,
    right: -8,
    fontSize: 14,
  },
  subscribeButton: {
    base: {
      fontSize: 11,
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      position: "relative",
      top: 2,
    },
    active: {
      top: 3,
    },
  },
  buyCreditsButton: {
    fontSize: 11,
  },
  inputContainer: {
    marginTop: "auto",
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 0,
    padding: 10,
  },
  input: {
    flex: 1,
  },
  sendButton: {},
  messagesContainer: {
    lineHeight: 1.3,
    overflowY: "auto",
  },
  message: {
    paddingBottom: 10,
    padding: "15px 10px",
    fontSize: 14,
  },
  title: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    display: "flex",
  },
  time: {
    fontSize: 11,
    color: "var(--shade-4)",
    marginLeft: "auto",
    position: "relative",
    marginTop: -11,
  },
  editEmoji: {
    fontSize: 19,
  },
  closeChatButton: {
    marginLeft: "auto",
  },
  aiMessage: {
    backgroundColor: "rgba(234, 234, 234, 0.07)",
  },
  creditsCount: {
    display: "inline-flex",
    alignItems: "center",
    position: "relative",
    top: 2,
    gap: 1,
    color: "var(--accent-6)",
  },
  creditsCountOrange: {
    color: "var(--accent-1)",
  },
  creditsCountRed: {
    color: "var(--accent-0)",
  },
  messageUser: {
    gap: 6,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 5,
    padding: 10,
  },
  messageContent: {
    fontSize: 13,
    margin: 0,
    padding: 0,
  },
  user: {
    fontWeight: "bold",
  },
  headerTitle: {
    fontSize: 16,
    lineHeight: 1.3,
  },
} as const

import { createUnifiedStyles } from "chrry/styles/createUnifiedStyles"
import { useInteractiveStyles } from "chrry/styles/useInteractiveStyles"

export const MoodifyStyles = createUnifiedStyles(MoodifyStyleDefs)

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
export type MoodifyStylesHook = {
  [K in keyof typeof MoodifyStyleDefs]: (typeof MoodifyStyleDefs)[K] extends {
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
export const useMoodifyStyles = (): MoodifyStylesHook => {
  // Call all hooks upfront in a stable order (Rules of Hooks compliant)
  const styleResults: Partial<Record<keyof typeof MoodifyStyleDefs, any>> = {}

  // Use Object.keys to ensure consistent iteration order across environments
  const keys = Object.keys(MoodifyStyleDefs) as Array<
    keyof typeof MoodifyStyleDefs
  >

  for (const className of keys) {
    const styleDef = MoodifyStyleDefs[className]

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

  return styleResults as MoodifyStylesHook
}
