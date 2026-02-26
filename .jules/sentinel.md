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

## 2026-05-25 - Request Object Spread in Arcjet

**Vulnerability:** When creating an Arcjet-compatible request object, spreading a standard `Request` object (`...request`) results in missing properties (like `method`, `url`) because they are getters on the prototype, not enumerable own properties.

**Learning:** Standard `Request` objects behave differently than plain JS objects. Always extract properties explicitly (e.g., `method: request.method`) when converting or cloning them for libraries.

**Prevention:** Manually construct the compatible request object or use a utility that handles `Request` cloning properly.

## 2026-05-25 - Testing Rate Limits in CI

**Vulnerability:** New security code (like rate limiting) often requires "mocking the world" to verify in tests because real enforcement might be bypassed in test environments or depend on external services (like Arcjet).

**Learning:** "0.0% Coverage on New Code" errors in CI usually mean your tests are either not running (wrong runner, e.g., `bun:test` vs `vitest`) or bypassing the logic you added. Integration tests that mock the service boundary (e.g., mocking `checkAuthRateLimit` itself) are crucial for verifying that the _application_ correctly handles the security rejection (429), even if the _library_ logic is tested separately.

**Prevention:**

1. Use the project's standard test runner (Vitest here).
2. Write integration tests that mock the security check to return "fail/deny" to verify the app's response (429).
3. Write unit tests for the security library logic using mocks for external dependencies.

## 2026-05-25 - SonarCloud Monorepo Coverage

**Vulnerability:** CI checks for code coverage were failing (0%) even with tests passing locally.

**Learning:** In a monorepo setup with workspaces (like Turbo/pnpm), coverage reports are generated in each package directory (e.g., `apps/api/coverage/lcov.info`). However, the SonarCloud action was configured to look only for `coverage/lcov.info` in the root.

**Prevention:** Updated `.github/workflows/sonarcloud.yml` to use the glob pattern `**/coverage/lcov.info` for `sonar.javascript.lcov.reportPaths`. This ensures SonarCloud picks up reports from all sub-projects.

## 2026-05-26 - Stored XSS via User Profile Image Upload

**Vulnerability:** The `PATCH /user/image` endpoint accepted a file upload without validating that the file type was actually an image. It passed the user-provided content type to the `upload` function. If a user provided a file with `type: text/html`, it bypassed the image processing logic in `minio.ts` and was uploaded as an HTML file. If this file is then accessed, it executes as HTML/JS (Stored XSS).

**Learning:**

- **Double Validation:** Relying solely on a utility function (like `upload`) to handle type validation is risky if the utility allows optional types.
- **Fail Fast:** Always validate input type (e.g., `startsWith("image/")`) as early as possible in the route handler.
- **Explicit Options:** When calling shared utilities, be explicit about expectations (e.g., `type: "image"`).

**Prevention:**

- Added `if (!image.type.startsWith("image/"))` validation in `apps/api/hono/routes/user.ts`.
- Added `type: "image"` to the `upload` function options in both `user.ts` and `image.ts` to enforce strict type checking in `minio.ts`.

## 2026-06-15 - Insecure JWT Handling in WebSocket Auth

**Vulnerability:** The WebSocket authentication logic contained a fallback to `jwt.decode` (unsigned) if `NEXTAUTH_SECRET` was missing from the environment or if signature verification failed in non-production. This "fail-open" mechanism allowed attackers to forge tokens signed with any key and impersonate any user.

**Learning:**

- **Fail Securely:** Security mechanisms must fail closed (reject access) when configuration is missing, not open (allow access).
- **Silent Defaults:** Using dangerous fallbacks (like unsigned decoding) even with a warning is unsafe because logs are often ignored until an incident occurs.
- **Consistency:** If `NEXTAUTH_SECRET` is missing, ensure all parts of the app use the _same_ fallback (e.g., a dev secret) or crash, rather than one part using a dev secret and another falling back to no security.

**Prevention:**

- **Enforce Verification:** Always use `jwt.verify()`. Never fall back to `jwt.decode()` for authentication purposes.
- **Unified Configuration:** Ensure secrets are handled consistently across HTTP and WebSocket handlers.
- **Reject Invalid:** If the secret is missing or the token signature is invalid, reject the connection immediately.

## 2026-06-15 - Race Condition in One-Time Code Exchange

**Vulnerability:** The `exchangeCodeForToken` function used a `SELECT` followed by an `UPDATE` to check and consume one-time auth codes. This introduced a race condition (TOCTOU) where two concurrent requests with the same code could both pass the check before either update completed, allowing the code to be used twice.

**Learning:**

- **Atomicity:** Critical state transitions (like marking a code as used) must be atomic. Separating read and write operations creates a window for race conditions.
- **Database Features:** Modern databases (like Postgres) support `UPDATE ... RETURNING`, allowing you to update and retrieve the result in a single atomic query.

**Prevention:**

- **Atomic Update:** Replaced the `SELECT`-then-`UPDATE` pattern with a single `db.update(...).where(...).returning()` query. This ensures that only one request can successfully "claim" and use the code.

## 2026-06-16 - Weak JWT Secret Default in Production

**Vulnerability:** The application was configured to fallback to `"development-secret"` if `NEXTAUTH_SECRET` was missing, even in production. This meant a misconfigured production deployment would be silently insecure, allowing attackers to forge tokens using the known default secret.

**Learning:**

- **Fail Securely:** Security-critical configuration (like secrets) must be enforced. Falling back to a weak default in production is a "fail-open" vulnerability.
- **Explicit Checks:** Checking `NODE_ENV === "production"` allows us to enforce stricter security rules in production while keeping development easy.

**Prevention:** Added a startup check in `apps/api/hono/routes/auth.ts` that throws an error if `NODE_ENV` is production and `NEXTAUTH_SECRET` is missing. This ensures the application fails to start rather than starting insecurely.

## 2026-06-20 - TOCTOU and Open Redirect in File Uploads

**Vulnerability:** The `minio.ts` upload utility validated URLs against private IPs *before* fetching them. However, it used standard `fetch`, which follows redirects automatically. This created two vulnerabilities:
1.  **Open Redirect SSRF:** An attacker could provide a URL that passes validation (e.g., `http://evil.com/image`) but redirects to a private IP (e.g., `http://169.254.169.254/metadata`), which `fetch` would follow without re-validation.
2.  **DNS Rebinding (TOCTOU):** For the initial request, the time between the DNS check and the actual `fetch` allowed an attacker to change the DNS record to a private IP.

**Learning:**
- **Fetch follows redirects:** Standard `fetch` behavior is dangerous for SSRF protection because it blindly trusts redirects.
- **Validation Persistence:** Validation must happen at *every step* of the HTTP chain (initial URL + every redirect).
- **DNS Pinning:** To prevent DNS rebinding, you must resolve the IP once and use that IP for the connection (setting the `Host` header manually).

**Prevention:**
- Implemented `safeFetch` utility that:
    1.  Handles redirects manually (`redirect: "manual"`).
    2.  Resolves and validates the IP for *every* URL in the chain.
    3.  Uses the resolved IP for the actual request (for HTTP) to pin the DNS.
    4.  Limits redirect depth to prevent loops.
- Replaced direct `fetch` usage in `minio.ts` with `safeFetch`.

## 2026-06-21 - False Positive SSRF Block for Data URLs

**Vulnerability:** The `safeFetch` utility correctly blocked SSRF attempts but also blocked legitimate `data:` URLs used for image uploads (constructed from `File` objects). This false positive broke upload functionality. Crucially, broken uploads prevented the downstream security sanitization (Sharp conversion), effectively leaving the system vulnerable to Stored XSS via SVG uploads if the upload mechanism were bypassed or fixed incorrectly.

**Learning:**
- **SSRF Scope:** `data:` URLs are inherently safe from SSRF as they do not trigger network requests. Applying network-layer SSRF protection to them is unnecessary and causes functional regressions.
- **Security Logic Dependency:** When security controls (like sanitization) depend on a functional pipeline (like upload), breaking the pipeline disables the control.

**Prevention:**
- Explicitly bypass `safeFetch` for `data:` URLs in `apps/api/lib/minio.ts` and use native `fetch`.
- Added regression tests to ensure `data:` URLs are handled correctly and `safeFetch` is bypassed only for them.
