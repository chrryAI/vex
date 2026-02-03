## 2025-02-12 - CORS Origin Reflection via `.includes()`

**Vulnerability:** The CORS middleware used `origin.includes(".chrry.ai")` to validate origins. This allowed attackers to bypass CORS by registering domains like `evil.chrry.ai.attacker.com` or `attacker.com/foo.chrry.ai` (if origin path handling was loose).
**Learning:** Developers often use loose string matching (`includes`) for convenience when handling subdomains, forgetting that attackers can embed the target string elsewhere in the URL.
**Prevention:** Always use strict equality checks or robust regexes anchored to the start and end of the string (e.g., `^https://.*\.example\.com$`) or parse the URL and check `hostname.endsWith('.example.com')`.

## 2026-01-21 - Critical PII and Password Hash Leak in Public API

**Vulnerability:** The `GET /users` endpoint was returning full user objects directly from the database layer (`getUsers` -> `getUser`), exposing `password` hashes, `email` addresses, `apiKey`s, and `ip` addresses to any authenticated user.
**Learning:** The database abstraction layer (`@repo/db`) helper `getUser` selects all columns by default and does not strip sensitive fields. API routes were relying on this return type without sanitization.
**Prevention:**
1.  Always use Data Transfer Objects (DTOs) or explicit response shaping in API routes.
2.  Never return raw database objects to the client.
3.  Implement a `toSafeUser` or `sanitizeUser` utility that is enforced at the API boundary or within the DB layer for public-facing queries.
