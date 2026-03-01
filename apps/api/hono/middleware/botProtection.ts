import type { Context, Next } from "hono"

// Suspicious paths commonly used by bots/scanners
const SUSPICIOUS_PATHS = [
  "/phpinfo.php",
  "/.git/",
  "/config/",
  "/wp-content/",
  "/wp-admin/",
  "/.env",
  "/admin/",
  "/rest/",
  "/metrics",
  "/.gitlab-ci.yml",
  "/.github/",
  "/root/",
  "/etc/",
  "/_profiler/",
  "/__debug",
  "/api/v1/",
  "/.gitignore",
  "/debug.log",
]

// Suspicious user agents
const BOT_USER_AGENTS = [
  "masscan",
  "nmap",
  "sqlmap",
  "nikto",
  "acunetix",
  "nessus",
  "openvas",
  "metasploit",
  "burpsuite",
  "zaproxy",
]

/**
 * Middleware to block common bot/scanner requests before processing
 * Prevents wasted resources on malicious requests
 */
export const botProtectionMiddleware = async (c: Context, next: Next) => {
  const pathname = c.req.path
  const userAgent = c.req.header("user-agent")?.toLowerCase() || ""

  // Block suspicious paths
  if (SUSPICIOUS_PATHS.some((path) => pathname.includes(path))) {
    return c.text("Not Found", 404)
  }

  // Block known bot user agents
  if (BOT_USER_AGENTS.some((bot) => userAgent.includes(bot))) {
    return c.text("Forbidden", 403)
  }

  await next()
}
