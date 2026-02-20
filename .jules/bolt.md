## 2024-05-22 - Optimize Image Loading

**Learning:** Replaced `fetch` + `blob` with `new Image()` + `decode()` for better performance on web. This avoids double memory usage and main thread blocking. Discovered that `img.decode()` failure logic needs to be handled carefully; swallowing the error matches original "silent fail" behavior but requires ensuring state is cleaned up (e.g. `setIsLoading(false)`).
**Action:** Always prefer browser native methods (`Image` constructor) over manual `fetch` for images unless custom headers are strictly required. Ensure `finally` blocks handle cleanup reliably. Also, verify `React` imports in JSX files when running tests in strict environments like `vitest`.

## 2026-02-06 - React Markdown & SSR Performance

**Learning:** `ReactMarkdown` creates new references for `remarkPlugins` and `components` if defined inline, causing unnecessary re-renders. Also, default `img` tags lack lazy loading.
**Action:** Move configuration objects and utility functions (like `timeAgo`) to module scope. Use `loading="lazy"` and `decoding="async"` for markdown images. Be careful with TS type imports (`import type { Components }`) to avoid runtime crashes in some bundlers.

## 2026-02-14 - TimeAgo Instantiation Bottleneck

**Learning:** `javascript-time-ago` instantiation (`new TimeAgo(locale)`) is relatively expensive and was happening on every render for every message timestamp.
**Action:** Use a module-level `Map` cache to reuse `TimeAgo` instances per locale. This avoids repeated constructor overhead (~33μs/call becomes negligible). Always look for object instantiations in render loops or frequently called utilities.
