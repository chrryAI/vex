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

## 2024-03-22 - Optimize App Wide Image Rendering

**Learning:** `Img` component in `@chrryai/chrry` (specifically `packages/ui/Img.tsx`) is heavily utilized in grids, lists, and chat contexts. Since its props are mostly primitive types or stable references (src, alt, width, height), lacking `React.memo()` meant it was subjected to unnecessary re-renders whenever complex parent components updated their own internal states.
**Action:** Wrapped `Img` in `React.memo()`. Always verify that low-level, frequently rendered UI primitives like Images, Buttons, and Icons are memoized to protect them from parent re-renders.
