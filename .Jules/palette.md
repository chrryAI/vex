## 2024-05-23 - Accessibility in Icon-Only Buttons

**Learning:** Found multiple icon-only buttons (ThemeSwitcher, DeleteThread) completely lacking accessible names. Screen readers would just announce "Button". This seems to be a pattern where visual-only designs neglect the `aria-label` or `title` fallback.
**Action:** Enforce a pattern where `IconButton` or similar wrappers _require_ a label, or add linting rules for `aria-label` on buttons without text children.

## 2026-01-21 - Accessible Checkbox Pattern

**Learning:** The `Checkbox` component was hiding the native input with `display: none`, removing it from the accessibility tree. This prevented screen readers from interacting with it and broke keyboard navigation.
**Action:** Replace wrapper `Div` with `Label` and use visually hidden (but accessible) styles for the native input. Ensure label and input are linked via `id` and `htmlFor`.
