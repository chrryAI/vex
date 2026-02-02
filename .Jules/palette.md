## 2024-05-23 - Accessibility in Icon-Only Buttons

**Learning:** Found multiple icon-only buttons (ThemeSwitcher, DeleteThread) completely lacking accessible names. Screen readers would just announce "Button". This seems to be a pattern where visual-only designs neglect the `aria-label` or `title` fallback.
**Action:** Enforce a pattern where `IconButton` or similar wrappers _require_ a label, or add linting rules for `aria-label` on buttons without text children.
