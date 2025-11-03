/**
 * Generated from EditTask.module.scss
 * Auto-converted SCSS to Unified Styles
 *
 * Works on both web and native! 🎉
 */

export const EditTaskStyleDefs = {
  editTask: {
    border: "none",
    padding: "13px 13px",
    display: "block",
    width: "100%",
    height: 50,
    marginBottom: 10,
  },
  fieldError: {
    color: "var(--accent-0)",
    fontSize: "0.8rem",
    margin: "-5px 0 10px 0",
  },
  editTaskButtons: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  cancelAndDeleteEditTaskButtons: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  taskLogForm: {
    marginTop: 20,
  },
  emojiContainer: {
    display: "flex",
    gap: 7,
    alignItems: "center",
    flexDirection: "row",
  },
  moodContainer: {
    flex: 1,
  },
  editTaskTitle: {
    fontSize: 22,
    margin: "0 0 10px 0",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  loadingTaskLogs: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  editTaskLogFormActions: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  mobile: {
    display: "inline",
  },
  desktop: {
    display: "none",
  },
  editEmoji: {
    fontSize: 24,
  },
  editTaskLogForm: {},
  deleteLogButton: {
    fontSize: 14,
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 2,
  },
  editButton: {
    position: "relative",
    left: 3,
    bottom: 3,
    fontSize: 14,
  },
  taskLogFormTip: {
    position: "relative",
    bottom: 7,
    fontSize: 14,
  },
  editTaskLogFormTextarea: {
    base: {
      borderRadius: 12,
      height: 80,
      fontFamily: "var(--font-sans)",
      marginBottom: 10,
      backgroundColor: "var(--shade-1-transparent)",
      border: "1px solid var(--accent-1)",
    },
    focus: {
      border: "1px solid var(--accent-1)",
    },
  },
  taskLogsTitle: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    margin: "20px 0 10px 0",
    fontSize: 16,
  },
  taskLogs: {
    marginTop: 5,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  loadMoreContainer: {
    marginTop: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    padding: "7px 12px",
    gap: 5,
  },
  cancelButton: {
    padding: "7px 12px",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 14,
  },
  taskLogTitle: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    position: "relative",
    bottom: 5,
  },
  taskLogTitleTime: {
    fontSize: 12,
    color: "var(--shade-6)",
    marginLeft: "auto",
  },
  editLogMoodButton: {
    fontSize: 13,
  },
} as const

import { createUnifiedStyles } from "chrry/styles/createUnifiedStyles"
import { useInteractiveStyles } from "chrry/styles/useInteractiveStyles"

export const EditTaskStyles = createUnifiedStyles(EditTaskStyleDefs)

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
export type EditTaskStylesHook = {
  [K in keyof typeof EditTaskStyleDefs]: (typeof EditTaskStyleDefs)[K] extends {
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
export const useEditTaskStyles = (): EditTaskStylesHook => {
  // Call all hooks upfront in a stable order (Rules of Hooks compliant)
  const styleResults: Partial<Record<keyof typeof EditTaskStyleDefs, any>> = {}

  // Use Object.keys to ensure consistent iteration order across environments
  const keys = Object.keys(EditTaskStyleDefs) as Array<
    keyof typeof EditTaskStyleDefs
  >

  for (const className of keys) {
    const styleDef = EditTaskStyleDefs[className]

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

  return styleResults as EditTaskStylesHook
}
