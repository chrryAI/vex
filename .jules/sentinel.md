## 2025-02-12 - CORS Origin Reflection via `.includes()`
**Vulnerability:** The CORS middleware used `origin.includes(".chrry.ai")` to validate origins. This allowed attackers to bypass CORS by registering domains like `evil.chrry.ai.attacker.com` or `attacker.com/foo.chrry.ai` (if origin path handling was loose).
**Learning:** Developers often use loose string matching (`includes`) for convenience when handling subdomains, forgetting that attackers can embed the target string elsewhere in the URL.
**Prevention:** Always use strict equality checks or robust regexes anchored to the start and end of the string (e.g., `^https://.*\.example\.com$`) or parse the URL and check `hostname.endsWith('.example.com')`.
