## 2024-05-22 - Optimize Image Loading

**Learning:** Replaced `fetch` + `blob` with `new Image()` + `decode()` for better performance on web. This avoids double memory usage and main thread blocking. Discovered that `img.decode()` failure logic needs to be handled carefully; swallowing the error matches original "silent fail" behavior but requires ensuring state is cleaned up (e.g. `setIsLoading(false)`).
**Action:** Always prefer browser native methods (`Image` constructor) over manual `fetch` for images unless custom headers are strictly required. Ensure `finally` blocks handle cleanup reliably. Also, verify `React` imports in JSX files when running tests in strict environments like `vitest`.

## 2025-01-23 - Optimize Bundle Size with Lazy Loading

**Learning:** When using `React.lazy` to code-split components, heavy dependencies (like `react-markdown`) might still be bundled into the main `vendor` chunk if `manualChunks` configuration forces all `node_modules` into `vendor`.
**Action:** Always check `vite.config.ts` or webpack config for `manualChunks` or `splitChunks` rules. If a catch-all rule exists for `node_modules`, explicit exceptions must be added for dependencies of lazy-loaded components to ensure they are truly split into separate chunks.
