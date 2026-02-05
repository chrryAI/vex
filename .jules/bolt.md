## 2024-05-22 - Optimize Image Loading

**Learning:** Replaced `fetch` + `blob` with `new Image()` + `decode()` for better performance on web. This avoids double memory usage and main thread blocking. Discovered that `img.decode()` failure logic needs to be handled carefully; swallowing the error matches original "silent fail" behavior but requires ensuring state is cleaned up (e.g. `setIsLoading(false)`).
**Action:** Always prefer browser native methods (`Image` constructor) over manual `fetch` for images unless custom headers are strictly required. Ensure `finally` blocks handle cleanup reliably. Also, verify `React` imports in JSX files when running tests in strict environments like `vitest`.
