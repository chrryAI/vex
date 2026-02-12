## 2025-05-21 - CSRF Protection and SameSite Cookie Behavior

**Context:** Subdomains of the same registrable domain (e.g., `chrry.ai` and `api.chrry.ai`) are considered **same-site** by browsers. Therefore, `SameSite=Lax` cookies are sent between these subdomains and provide built-in CSRF protection. `SameSite=None` is only required for true **cross-site** scenarios (e.g., `example.com` ↔ `api.chrry.ai`).

**Vulnerability:** If the application were to use `SameSite=None` cookies unnecessarily, it would expose the API to CSRF attacks via cross-site forms (POST/multipart) from any origin, bypassing browser CSRF protections.

**Learning:**

- **Same-site (subdomains):** `chrry.ai` ↔ `api.chrry.ai` → Use `SameSite=Lax` (default protection)
- **Cross-site (different domains):** `example.com` ↔ `api.chrry.ai` → Requires `SameSite=None` + strict Origin/Referer validation

**Prevention:** When `SameSite=None` is necessary for cross-site integrations, implement CSRF middleware for state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`) with the following validation flow:

1. **If `Origin` header is present:** Validate against trusted origins list. Reject if untrusted.
2. **If `Origin` is missing, check `Referer` header:** Validate against trusted origins. Reject if untrusted.
3. **If neither header is present:** Either reject the request (strict mode) or require a valid CSRF token (token-based fallback).

**Trusted Origins:** Maintain an allowlist of trusted domains (e.g., `*.chrry.ai`, `*.chrry.dev`, `*.chrry.store`) and validate that the parsed hostname from `Origin` or `Referer` matches the trusted patterns.

**Note:** For same-site subdomain communication with `SameSite=Lax`, this middleware is not required as browsers provide built-in CSRF protection. This defense-in-depth approach is specifically for `SameSite=None` scenarios where cross-site requests are intentionally allowed.

## 2026-01-26 - SSRF Protection in Image Proxy

**Vulnerability:** The image resizing endpoint (`/resize`) accepted a `url` parameter and blindly fetched it using `fetch()`. This exposed the application to Server-Side Request Forgery (SSRF), allowing attackers to scan internal ports (e.g., `http://127.0.0.1:port`) or access cloud metadata services (e.g., `http://169.254.169.254`).

**Learning:**

- Standard `fetch` in Node/Bun does not block private IP addresses.
- Checking the URL string alone is insufficient due to DNS resolution (e.g., `local.test` -> `127.0.0.1`).
- To fix this robustly without a heavy library, we must resolve the DNS first and check the resolved IP against private ranges.

**Prevention:**

- Use a dedicated `validateUrl` helper that:
  1. Resolves the hostname to an IP.
  2. Checks the IP against RFC1918 (10.x, 172.16-31.x, 192.168.x) and reserved ranges (127.x, 169.254.x).
  3. Rejects the request if the IP is private (unless in `development` mode).
- Apply this validation _before_ fetching any user-provided URL.

## 2026-05-23 - Missing OAuth State Verification & Secure Cookie Handling

**Vulnerability:** The Google OAuth implementation was vulnerable to Login CSRF due to missing state verification. Additionally, manual cookie parsing using regex was prone to errors and bypasses. Using an untrusted redirect URL upon failure introduced an Open Redirect vulnerability.

**Learning:**

1.  **State Verification:** OAuth 2.0 `state` parameter must be bound to the user's browser session (e.g., via a secure, HttpOnly cookie) and verified in the callback.
2.  **Cookie Helpers:** Use framework-provided cookie helpers (e.g., `hono/cookie`) instead of manual header manipulation or regex parsing.
3.  **SameSite Policy:**
    - **GET Callbacks (e.g., Google):** Use `SameSite=Lax` as it provides CSRF protection for top-level navigations.
    - **POST Callbacks (e.g., Apple `form_post`):** Must use `SameSite=None` because the callback is a cross-site POST request, which `Lax` blocks.
4.  **Avoid Open Redirects:** When validation fails (e.g., state mismatch), do NOT redirect to a URL derived from the untrusted state. Use a hardcoded, safe URL (e.g., app root).

**Prevention:**

1.  **Generate State:** Create a cryptographically secure random state.
2.  **Store State:** Save the state in a `HttpOnly`, `Secure` cookie. Use `SameSite=Lax` for GET callbacks and `SameSite=None` for POST callbacks.
3.  **Verify State:** In the callback, use `getCookie` to retrieve and compare the stored state. Reject mismatch.
4.  **Clear State:** Delete the cookie after verification.
5.  **Safe Failure Redirect:** Redirect to a known safe URL upon verification failure.

## 2026-05-25 - Request Object Spread in Arcjet

**Vulnerability:** When creating an Arcjet-compatible request object, spreading a standard `Request` object (`...request`) results in missing properties (like `method`, `url`) because they are getters on the prototype, not enumerable own properties.

**Learning:** Standard `Request` objects behave differently than plain JS objects. Always extract properties explicitly (e.g., `method: request.method`) when converting or cloning them for libraries.

**Prevention:** Manually construct the compatible request object or use a utility that handles `Request` cloning properly.

## 2026-05-25 - Testing Rate Limits in CI

**Vulnerability:** New security code (like rate limiting) often requires "mocking the world" to verify in tests because real enforcement might be bypassed in test environments or depend on external services (like Arcjet).

**Learning:** "0.0% Coverage on New Code" errors in CI usually mean your tests are either not running (wrong runner, e.g., `bun:test` vs `vitest`) or bypassing the logic you added. Integration tests that mock the service boundary (e.g., mocking `checkAuthRateLimit` itself) are crucial for verifying that the *application* correctly handles the security rejection (429), even if the *library* logic is tested separately.

**Prevention:**
1. Use the project's standard test runner (Vitest here).
2. Write integration tests that mock the security check to return "fail/deny" to verify the app's response (429).
3. Write unit tests for the security library logic using mocks for external dependencies.
