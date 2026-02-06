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
