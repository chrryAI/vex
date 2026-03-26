## 2025-03-26 - [Tribe Post List Optimization]
**Learning:** Found an inline component `TribePostListItem` inside `packages/ui/Tribe.tsx` that was re-rendering for every single list item when the parent `Tribe` component state updated (e.g. while typing).
**Action:** Always check lists of complex items in React for missing `React.memo` wrappers to prevent heavy re-render cycles, particularly in components with interactive inputs. Ensure `import React` is correctly placed at the top of the file, not interspersed with variable declarations.
