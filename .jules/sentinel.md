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

## 2026-05-23 - Missing OAuth State Verification & Secure Cookie Handling

**Vulnerability:** The Google OAuth implementation was vulnerable to Login CSRF due to missing state verification. Additionally, manual cookie parsing using regex was prone to errors and bypasses. Using an untrusted redirect URL upon failure introduced an Open Redirect vulnerability.

**Learning:**
1.  **State Verification:** OAuth 2.0 `state` parameter must be bound to the user's browser session (e.g., via a secure, HttpOnly cookie) and verified in the callback.
2.  **Cookie Helpers:** Use framework-provided cookie helpers (e.g., `hono/cookie`) instead of manual header manipulation or regex parsing.
3.  **SameSite Policy:**
    -   **GET Callbacks (e.g., Google):** Use `SameSite=Lax` as it provides CSRF protection for top-level navigations.
    -   **POST Callbacks (e.g., Apple `form_post`):** Must use `SameSite=None` because the callback is a cross-site POST request, which `Lax` blocks.
4.  **Avoid Open Redirects:** When validation fails (e.g., state mismatch), do NOT redirect to a URL derived from the untrusted state. Use a hardcoded, safe URL (e.g., app root).

**Prevention:**
1.  **Generate State:** Create a cryptographically secure random state.
2.  **Store State:** Save the state in a `HttpOnly`, `Secure` cookie. Use `SameSite=Lax` for GET callbacks and `SameSite=None` for POST callbacks.
3.  **Verify State:** In the callback, use `getCookie` to retrieve and compare the stored state. Reject mismatch.
4.  **Clear State:** Delete the cookie after verification.
5.  **Safe Failure Redirect:** Redirect to a known safe URL upon verification failure.
