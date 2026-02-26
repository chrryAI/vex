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

## 2026-06-15 - Focus Visibility for Custom Controls

**Learning:** The custom `Checkbox` implementation visually hid the native input but did not replicate the focus state on the custom UI elements (track/thumb). This made keyboard navigation invisible, failing WCAG 2.4.7.
**Action:** When hiding native inputs for custom styling, always add a `:focus-visible` rule that targets the custom sibling element (e.g., `input:focus-visible + .track { outline: ... }`) to ensure keyboard users can see where they are.
## 2026-03-03 - Focus Styles on Custom Checkboxes

**Learning:** Custom checkbox components that hide the native input often lose keyboard focus indicators. The `Checkbox` component had a hidden input but no visual feedback on the custom track when focused via keyboard.
**Action:** Use `onFocus`/`onBlur` state on the wrapper to apply focus ring styles to the custom visual element, ensuring keyboard users can see where they are.

## 2026-06-25 - Accessible Loading States

**Learning:** The `Loading` component relied purely on a visual spinner (Lucide icon) without any semantic meaning for screen readers. This makes loading states invisible to non-visual users, causing confusion about whether content is ready.
**Action:** Always add `role="status"` and `aria-label="Loading"` (or a context-specific label) to loading indicators. For full-screen loaders, apply these to the wrapper; for inline icons, apply directly to the SVG component.
## 2026-05-23 - Accessibility of Date/Time Displays

**Learning:** Blog post dates were rendered as simple text (e.g., "2 days ago") or just text strings, making them less useful for assistive technologies and users wanting exact timestamps.
**Action:** Use the `<time>` element with `dateTime` attribute for machine-readable dates. Add a `title` attribute with the full localized date string to provide exact time on hover, enhancing the "relative time" display pattern. This pattern should be standard for all time-based displays (comments, logs, etc.).

## 2026-07-02 - Keyboard Accessibility for Pointer Controls

**Learning:** Components relying solely on `onPointerDown`/`onPointerUp` for "press and hold" interactions (like `SwipeableTimeControl`) are completely inaccessible to keyboard users who activate buttons with Enter/Space.
**Action:** Add an `onClick` handler that checks `e.detail === 0` (keyboard activation) to trigger a single step of the action, providing basic operability for keyboard users without conflicting with mouse/touch events.

## 2026-07-16 - Accessible Form Validation

**Learning:** The `Input`, `TextArea`, and `Select` primitives relied solely on external error messages or toasts for validation feedback, lacking semantic attributes (`aria-invalid`) to communicate error state to screen readers.
**Action:** Added `error`, `aria-invalid`, and `aria-describedby` props to base primitives. This ensures all form fields can easily expose their validation status and link to error messages, improving accessibility by default.

## 2026-02-26 - Accessible Multi-Select Lists

**Learning:** The `FocusButton` task list used buttons that toggled selection state visually (check vs circle) but lacked `aria-pressed` or `role="checkbox"`. This made the selection state invisible to screen readers.
**Action:** For custom multi-select lists implemented with buttons, always add `aria-pressed={isSelected}` to indicate the toggle state.
## 2026-02-26 - Cross-Platform Keyboard Shortcuts

**Learning:** Hardcoded keyboard shortcuts (like `⌘K`) exclude Windows/Linux users, causing confusion and potential accessibility issues. `PlatformProvider` offers robust OS detection.
**Action:** Use `usePlatform().os` to conditionally render shortcuts (e.g., `⌘K` vs `Ctrl+K`) and dynamically adjust layout (padding) to accommodate varying text lengths. This improves clarity and inclusivity.
