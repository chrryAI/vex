## 2025-05-21 - CSRF Protection for SameSite=None
**Vulnerability:** The application uses `SameSite=None` cookies for authentication to support cross-subdomain access (e.g. `chrry.ai` to `api.chrry.ai`). This exposes the API to CSRF attacks via cross-site forms (POST/multipart).
**Learning:** When `SameSite=None` is required for architecture, standard browser CSRF protections (SameSite=Lax) are bypassed. Strict Origin/Referer validation is mandatory for all state-changing requests.
**Prevention:** Implemented a middleware that rejects `POST`, `PUT`, `PATCH`, `DELETE` requests if the `Origin` header is present but not in the trusted list.
