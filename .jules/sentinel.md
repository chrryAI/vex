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

## 2026-02-14 - Missing Rate Limiting on Authentication Endpoints

**Vulnerability:** The `/signup` and `/signin` endpoints were completely unprotected against brute force and credential stuffing attacks, despite having `@arcjet/node` installed.

**Learning:**

- Always verify that security libraries (like Arcjet) are actually _applied_ to critical routes, not just installed.
- Arcjet can use `ip.src` characteristic for anonymous rate limiting without user context.

**Prevention:**

- Added strict IP-based rate limiting (10 req/min) to all password-based authentication routes using `checkAuthRateLimit`.

## 2026-05-24 - File Type Validation Bypass in MinIO Upload

**Vulnerability:** The `upload` function in `minio.ts` relied on inferred file types from `fetch` (via MIME type or extension) and blindly accepted them if they were in the supported list (which includes `text/html`). This allowed attackers to upload HTML files as "app images", creating a Stored XSS vector on the public S3 bucket.

**Learning:**

- **Implicit Trust:** Trusting detected MIME types without validating against the _expected_ type is dangerous.
- **Polyglot Risk:** Even if detection is accurate, a valid text file shouldn't be accepted when an image is required.
- **Default Behavior:** The `upload` function defaulted to accepting any supported type if strict validation wasn't enforced.

**Prevention:**

- **Strict Enforcement:** Enforce `options.type` in the upload function. If the caller expects an "image", reject everything else, even if it's a valid "text" file.
- **Explicit Intent:** Callers must explicitly specify the expected type (e.g., `type: "image"`) for sensitive uploads.

## 2026-06-15 - Insecure JWT Handling in WebSocket Auth

**Vulnerability:** The WebSocket authentication logic contained a fallback to `jwt.decode` (unsigned) if `NEXTAUTH_SECRET` was missing from the environment or if signature verification failed in non-production. This "fail-open" mechanism allowed attackers to forge tokens signed with any key and impersonate any user.

**Learning:**

- **Fail Securely:** Security mechanisms must fail closed (reject access) when configuration is missing, not open (allow access).
- **Silent Defaults:** Using dangerous fallbacks (like unsigned decoding) even with a warning is unsafe because logs are often ignored until an incident occurs.
- **Consistency:** If `NEXTAUTH_SECRET` is missing, ensure all parts of the app use the *same* fallback (e.g., a dev secret) or crash, rather than one part using a dev secret and another falling back to no security.

**Prevention:**

- **Enforce Verification:** Always use `jwt.verify()`. Never fall back to `jwt.decode()` for authentication purposes.
- **Unified Configuration:** Ensure secrets are handled consistently across HTTP and WebSocket handlers.
- **Reject Invalid:** If the secret is missing or the token signature is invalid, reject the connection immediately.
