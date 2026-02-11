## 2024-05-23 - Accessibility in Icon-Only Buttons

**Learning:** Found multiple icon-only buttons (ThemeSwitcher, DeleteThread) completely lacking accessible names. Screen readers would just announce "Button". This seems to be a pattern where visual-only designs neglect the `aria-label` or `title` fallback.
**Action:** Enforce a pattern where `IconButton` or similar wrappers _require_ a label, or add linting rules for `aria-label` on buttons without text children.

## 2026-01-21 - Accessible Checkbox Pattern

**Learning:** The `Checkbox` component was hiding the native input with `display: none`, removing it from the accessibility tree. This prevented screen readers from interacting with it and broke keyboard navigation.
**Action:** Replace wrapper `Div` with `Label` and use visually hidden (but accessible) styles for the native input. Ensure label and input are linked via `id` and `htmlFor`.

## 2026-02-04 - Accessible Timer Controls

**Learning:** Complex custom inputs like the "SwipeableTimeControl" (minutes/seconds adjuster) often use icon-only buttons for fine-tuning. These were completely invisible to screen readers, making the timer unusable for non-visual users.
**Action:** Always add explicit `aria-label`s to up/down chevron buttons in custom number inputs (e.g., "Increase minutes", "Decrease seconds").

## 2026-03-01 - Accessible Toggle Buttons (Bookmark)

**Learning:** The `Bookmark` component relied solely on visual icon changes (filled vs empty star) to indicate state. This is invisible to screen readers who just hear "button".
**Action:** Added `aria-pressed` for state and dynamic `aria-label` for action description ("Bookmark thread" vs "Remove bookmark"). This pattern should be applied to all toggle buttons (Like, Subscribe, etc.).

## 2026-03-03 - Focus Styles on Custom Checkboxes

**Learning:** Custom checkbox components that hide the native input often lose keyboard focus indicators. The `Checkbox` component had a hidden input but no visual feedback on the custom track when focused via keyboard.
**Action:** Use `onFocus`/`onBlur` state on the wrapper to apply focus ring styles to the custom visual element, ensuring keyboard users can see where they are.
