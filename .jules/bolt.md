## 2024-05-22 - Optimize Image Loading

**Learning:** Replaced `fetch` + `blob` with `new Image()` + `decode()` for better performance on web. This avoids double memory usage and main thread blocking. Discovered that `img.decode()` failure logic needs to be handled carefully; swallowing the error matches original "silent fail" behavior but requires ensuring state is cleaned up (e.g. `setIsLoading(false)`).
**Action:** Always prefer browser native methods (`Image` constructor) over manual `fetch` for images unless custom headers are strictly required. Ensure `finally` blocks handle cleanup reliably. Also, verify `React` imports in JSX files when running tests in strict environments like `vitest`.

## 2026-02-06 - React Markdown & SSR Performance

**Learning:** `ReactMarkdown` creates new references for `remarkPlugins` and `components` if defined inline, causing unnecessary re-renders. Also, default `img` tags lack lazy loading.
**Action:** Move configuration objects and utility functions (like `timeAgo`) to module scope. Use `loading="lazy"` and `decoding="async"` for markdown images. Be careful with TS type imports (`import type { Components }`) to avoid runtime crashes in some bundlers.

## 2026-02-14 - TimeAgo Instantiation Bottleneck

**Learning:** `javascript-time-ago` instantiation (`new TimeAgo(locale)`) is relatively expensive and was happening on every render for every message timestamp.
**Action:** Use a module-level `Map` cache to reuse `TimeAgo` instances per locale. This avoids repeated constructor overhead (~33μs/call becomes negligible). Always look for object instantiations in render loops or frequently called utilities.

## 2026-02-18 - Memoize Markdown Options

**Learning:** `markdown-to-jsx`'s `options` prop, if passed as an inline object, causes re-renders even if the parent component is memoized. Especially when `overrides` contains inline component definitions, it creates new function references on every render.
**Action:** Always wrap `options` object for `<Markdown>` in `useMemo` when using `markdown-to-jsx` or similar libraries, and ensure component overrides are stable (either defined outside or memoized).

## 2026-03-08 - Context Heavy Component Re-renders

**Learning:** Components that rely heavily on React context (like `useData`, `useAuth`, `useStyles`) can cause widespread unnecessary re-renders in a dashboard/widget setup (like `Weather`) if not wrapped in `React.memo`. While the context itself might change, memoization prevents re-renders when the parent component updates for unrelated reasons.
**Action:** Always wrap static or semi-static widget components (like `Weather`, `Clock`, etc.) in `React.memo` to prevent them from re-rendering when parent components update, especially if they are context-heavy. Always include comments explaining why a component is memoized.
