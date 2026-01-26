import { Hono } from "hono"
import { sign, verify } from "jsonwebtoken"
import { compare, hash } from "bcrypt"
import { getUser, createUser, getStore } from "@repo/db"
import { v4 as uuidv4 } from "uuid"
import { API_URL, isValidUsername } from "@chrryai/chrry/utils"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import { randomBytes } from "crypto"
import { db, authExchangeCodes } from "@repo/db"
import { eq, and, gt } from "drizzle-orm"

const authRoutes = new Hono()

const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID

const GOOGLE_WEB_CLIENT_SECRET = process.env.GOOGLE_WEB_CLIENT_SECRET

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID

const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET

// JWT secret (reuse existing env var)
const JWT_SECRET = process.env.NEXTAUTH_SECRET || "development-secret"
const JWT_EXPIRY = "30d"

/**
 * Helper: Generate JWT token
 */
function generateToken(userId: string, email: string) {
  return sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

/**
 * Helper: Verify JWT token
 */
function verifyToken(token: string) {
  try {
    return verify(token, JWT_SECRET) as { userId: string; email: string }
  } catch {
    return null
  }
}

/**
 * Helper: Generate one-time exchange code
 * Returns a secure random code that expires in 5 minutes
 */
async function generateExchangeCode(token: string): Promise<string> {
  // Generate cryptographically secure random code
  const code = randomBytes(32).toString("base64url")

  // Store in database with 5-minute expiry
  const expiresOn = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  await db.insert(authExchangeCodes).values({
    code,
    token,
    expiresOn,
  })

  return code
}

/**
 * Helper: Exchange code for token (one-time use)
 */
async function exchangeCodeForToken(code: string): Promise<string | null> {
  const now = new Date()

  // Find unused, non-expired code
  const [result] = await db
    .select()
    .from(authExchangeCodes)
    .where(
      and(
        eq(authExchangeCodes.code, code),
        eq(authExchangeCodes.used, false),
        gt(authExchangeCodes.expiresOn, now),
      ),
    )
    .limit(1)

  if (!result) {
    return null // Code not found, already used, or expired
  }

  // Mark as used (one-time use)
  await db
    .update(authExchangeCodes)
    .set({ used: true })
    .where(eq(authExchangeCodes.id, result.id))

  return result.token
}

async function generateUniqueUsername(
  fullName: string | null | undefined,
): Promise<string> {
  if (!fullName) return uuidv4()

  // Extract first name and clean it
  const firstNameRaw = fullName.split(" ")[0]
  if (!firstNameRaw) return uuidv4()

  const firstName = firstNameRaw.toLowerCase().replaceAll(/[^a-z0-9]/g, "")

  // Early validation check
  if (!firstName || !isValidUsername(firstName)) return uuidv4()

  // Check if username exists (checks both users and stores)
  const exists = async (username: string): Promise<boolean> => {
    const existingUser = await getUser({ userName: username })
    if (existingUser) return true

    const existingStore = await getStore({ slug: username })
    if (existingStore?.store) return true

    return false
  }

  // Try the first name first
  let username = firstName
  if (!(await exists(username))) {
    return username // Available!
  }

  // If taken, try with numbers
  let counter = 1
  while (counter <= 999) {
    username = `${firstName}${counter}`

    if (!(await exists(username)) && isValidUsername(username)) {
      return username // Found available username
    }

    counter++
  }

  // Fallback to UUID if we've tried too many variations
  return uuidv4()
}

/**
 * POST /api/auth/signup/password
 * Register new user with email/password
 */
authRoutes.post("/signup/password", async (c) => {
  try {
    const { email, password, name } = await c.req.json()

    if (!email || !password) {
      return c.json({ error: "Email and password required" }, 400)
    }

    // Check if user exists
    const existingUser = await getUser({
      email,
    })

    if (existingUser) {
      return c.json({ error: "User already exists" }, 400)
    }

    // Hash password
    const passwordHash = await hash(password, 10)

    // Create user
    const newUser = await createUser({
      email,
      password: passwordHash,
      name,
      userName: await generateUniqueUsername(name),
    })

    if (!newUser) {
      return c.json({ error: "User creation failed" }, 500)
    }

    // Generate token
    const token = generateToken(newUser.id, newUser.email)

    // Determine cookie domain from request headers (for cross-subdomain auth)
    const ALLOWED_DOMAINS = [".chrry.ai", ".chrry.dev", ".chrry.store"]
    let cookieDomain = ""

    const forwardedHost =
      c.req.header("X-Forwarded-Host") || c.req.header("Host")
    if (forwardedHost) {
      const domainParts = forwardedHost.split(".")
      if (domainParts.length >= 2) {
        const rootDomain = domainParts.slice(-2).join(".")
        const isAllowed = ALLOWED_DOMAINS.some(
          (allowed) =>
            allowed === `.${rootDomain}` || rootDomain === "localhost",
        )
        if (isAllowed) {
          cookieDomain = `; Domain=.${rootDomain}`
        }
      }
    }

    // Set HTTP-only cookie with cross-domain support
    const isDev = process.env.NODE_ENV === "development"
    const secureFlag = isDev ? "" : "; Secure"
    const sameSite = isDev ? "Lax" : "None" // None required for cross-domain in production

    c.header(
      "Set-Cookie",
      `token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=${sameSite}${cookieDomain}${secureFlag}`,
    )

    return c.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
      token,
    })
  } catch (error) {
    console.error("Signup error:", error)
    return c.json({ error: "Signup failed" }, 500)
  }
})

/**
 * POST /api/auth/signin/password
 * Sign in with email/password
 */
authRoutes.post("/signin/password", async (c) => {
  try {
    const { email, password, callbackUrl } = await c.req.json()
    console.log(`🔐 Signin attempt for:`, email)

    if (!email || !password) {
      console.log(`❌ Missing credentials`)
      return c.json({ error: "Email and password required" }, 400)
    }

    // Find user
    const user = await getUser({
      email,
    })

    if (!user || !user.password) {
      console.log(`❌ User not found or no password:`, email)
      return c.json({ error: "Invalid credentials" }, 401)
    }

    // Verify password
    const valid = await compare(password, user.password)

    if (!valid) {
      console.log(`❌ Invalid password for:`, email)
      return c.json({ error: "Invalid credentials" }, 401)
    }

    console.log(`✅ Password valid for:`, email)

    // Generate token
    const token = generateToken(user.id, user.email)
    console.log(`🎫 Generated token for:`, user.id)

    // Determine cookie domain from request headers (for cross-subdomain auth)
    const ALLOWED_DOMAINS = [".chrry.ai", ".chrry.dev", ".chrry.store"]
    let cookieDomain = ""

    const forwardedHost =
      c.req.header("X-Forwarded-Host") || c.req.header("Host")
    if (forwardedHost) {
      const domainParts = forwardedHost.split(".")
      if (domainParts.length >= 2) {
        const rootDomain = domainParts.slice(-2).join(".")
        const isAllowed = ALLOWED_DOMAINS.some(
          (allowed) =>
            allowed === `.${rootDomain}` || rootDomain === "localhost",
        )
        if (isAllowed) {
          cookieDomain = `; Domain=.${rootDomain}`
        }
      }
    }

    // Set HTTP-only cookie with cross-domain support
    const isDev = process.env.NODE_ENV === "development"
    const secureFlag = isDev ? "" : "; Secure"
    const sameSite = isDev ? "Lax" : "None" // None required for cross-domain in production

    const cookieValue = `token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=${sameSite}${cookieDomain}${secureFlag}`
    console.log(`🍪 Setting cookie:`, cookieValue.substring(0, 80) + "...")

    c.header("Set-Cookie", cookieValue)

    const authCode = await generateExchangeCode(token)

    const response = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      token: authCode,
      // If callbackUrl provided, include it with token param (like Google OAuth)
      ...(callbackUrl && {
        callbackUrl: `${callbackUrl}${callbackUrl.includes("?") ? "&" : "?"}auth_token=${authCode}`,
      }),
    }

    console.log(`📤 Returning response for:`, user.id)
    return c.json(response)
  } catch (error) {
    console.error("❌ Signin error:", error)
    return c.json({ error: "Signin failed" }, 500)
  }
})

/**
 * GET /api/auth/session
 * Get current user session
 */
authRoutes.get("/session", async (c) => {
  try {
    // Get token from cookie or Authorization header
    const cookieHeader = c.req.header("cookie")
    const authHeader = c.req.header("authorization")

    let token: string | null | undefined = undefined

    if (cookieHeader) {
      const match = cookieHeader.match(/token=([^;]+)/)
      token = match ? match[1] : null
    } else if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7)
    }

    if (!token) {
      return c.json({ user: null })
    }

    // Verify token
    const payload = verifyToken(token)

    if (!payload) {
      return c.json({ user: null })
    }

    // Get user from database
    const user = await getUser({
      id: payload.userId,
    })

    if (!user) {
      return c.json({ user: null })
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    })
  } catch (error) {
    console.error("Session error:", error)
    return c.json({ user: null })
  }
})

/**
 * POST /api/auth/signout
 * Sign out user
 */
authRoutes.post("/signout", async (c) => {
  // Clear token cookie (with and without HttpOnly for compatibility)
  const isDev = process.env.NODE_ENV === "development"

  c.header(
    "Set-Cookie",
    `token=; ${isDev ? "" : "HttpOnly; "}Path=/; Max-Age=0; SameSite=Lax`,
  )

  return c.json({ success: true })
})

/**
 * POST /api/auth/native/google
 * Verify Google ID token from Capacitor native plugin
 */
authRoutes.post("/native/google", async (c) => {
  try {
    const { idToken } = await c.req.json()

    if (!idToken) {
      return c.json({ error: "ID token required" }, 400)
    }

    if (!GOOGLE_WEB_CLIENT_ID) {
      return c.json({ error: "Google OAuth not configured" }, 500)
    }

    const { OAuth2Client } = await import("google-auth-library")
    const client = new OAuth2Client(GOOGLE_WEB_CLIENT_ID)

    // In development, allow bypassing verification for testing
    const isDevelopment = process.env.NODE_ENV === "development"

    let payload: any

    if (isDevelopment) {
      console.log("🔍 Development mode: Skipping Google token verification")
      try {
        const jwt = (await import("jsonwebtoken")).default
        payload = jwt.decode(idToken) as any
        console.log("🔍 Decoded email:", payload?.email)
      } catch (e) {
        console.error("Failed to decode token:", e)
        return c.json({ error: "Invalid Google ID token" }, 401)
      }
    } else {
      // Production: Verify token properly
      const ticket = await client.verifyIdToken({
        idToken,
        audience: [
          GOOGLE_WEB_CLIENT_ID,
          process.env.GOOGLE_IOS_CLIENT_ID ||
            "230848351758-64o69nn4a4mknvnol73bfl3e4vb46ljt.apps.googleusercontent.com",
        ],
      })
      payload = ticket.getPayload()
    }

    if (!payload || !payload.email) {
      return c.json({ error: "Invalid token payload" }, 400)
    }

    const { email, name, picture } = payload

    // Find or create user
    let user = await getUser({ email })

    if (!user) {
      // Create new user
      user = await createUser({
        email,
        name: name || email.split("@")[0],
        image: picture,
        userName: await generateUniqueUsername(name || email.split("@")[0]),
        emailVerified: new Date(),
      })
    }

    if (!user) {
      return c.json({ error: "User creation failed" }, 500)
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email)

    // Set cookie
    const isDev = process.env.NODE_ENV === "development"
    const secureFlag = isDev ? "" : "; Secure"
    const sameSite = isDev ? "Lax" : "None"

    // For native apps, cookies might not work effectively for persistence if not using CookieManager.
    // However, the standard response is to set-cookie for subsequent webview requests.
    const cookieValue = `token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=${sameSite}${secureFlag}`
    c.header("Set-Cookie", cookieValue)

    // Generate exchange code so the app can manually store the token if needed
    const authCode = await generateExchangeCode(token)

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      token: authCode, // Return code/token for client to use
      jwt: token, // Also return raw JWT for direct use in Authorization header
    })
  } catch (error) {
    console.error("Native Google auth error:", error)
    return c.json({ error: "Authentication failed" }, 500)
  }
})

/**
 * GET /api/auth/signin/google
 * Initiate Google OAuth flow
 */
authRoutes.get("/signin/google", async (c) => {
  try {
    if (!GOOGLE_WEB_CLIENT_ID) {
      return c.json({ error: "Google OAuth not configured" }, 500)
    }

    // Allowed domains for callback URLs (security validation)
    const ALLOWED_DOMAINS = [
      ".chrry.ai",
      ".chrry.dev",
      ".chrry.store",
      "localhost",
    ]

    // Get callback URLs from query params and ensure they're strings
    const callbackUrlParam = c.req.query("callbackUrl")
    // Decode if already encoded (to prevent double-encoding)
    let callbackUrl =
      typeof callbackUrlParam === "string" ? callbackUrlParam : undefined
    if (callbackUrl && callbackUrl.includes("%")) {
      try {
        callbackUrl = decodeURIComponent(callbackUrl)
      } catch (e) {
        // If decode fails, use as-is
      }
    }

    // Validate callback URL belongs to allowed domain
    if (callbackUrl) {
      try {
        const callbackUrlObj = new URL(callbackUrl)
        const isValidDomain = ALLOWED_DOMAINS.some(
          (domain) =>
            callbackUrlObj.hostname === domain.replace(".", "") ||
            callbackUrlObj.hostname.endsWith(domain),
        )
        if (!isValidDomain) {
          console.error("Invalid callback domain:", callbackUrlObj.hostname)
          return c.json({ error: "Invalid callback domain" }, 400)
        }
      } catch (e) {
        console.error("Invalid callback URL:", callbackUrl)
        return c.json({ error: "Invalid callback URL" }, 400)
      }
    } else {
      // Fallback to current origin if no callback URL provided
      const requestUrl = new URL(c.req.url)
      callbackUrl = `${requestUrl.protocol}//${requestUrl.host}`
    }

    const errorUrlParam = c.req.query("errorUrl")
    let errorUrl = typeof errorUrlParam === "string" ? errorUrlParam : undefined
    if (errorUrl && errorUrl.includes("%")) {
      try {
        errorUrl = decodeURIComponent(errorUrl)
      } catch (e) {
        // If decode fails, use as-is
      }
    }

    // Fallback for error URL
    if (!errorUrl) {
      errorUrl = callbackUrl + "/?error=oauth_failed"
    }

    const forwardedHost = c.req.header("X-Forwarded-Host")
    const requestUrl = new URL(c.req.url)

    // Generate state for CSRF protection and encode callback URLs in it
    // Format: {stateId}:{callbackUrl}:{errorUrl}
    const stateId = uuidv4()
    const stateData = {
      id: stateId,
      callbackUrl: callbackUrl || "",
      errorUrl: errorUrl || "",
    }
    // Base64 encode the state to make it URL-safe
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64url")

    // Build Google OAuth URL with API server callback
    const redirectUri = `${API_URL}/auth/callback/google`
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", GOOGLE_WEB_CLIENT_ID)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", "openid email profile")
    authUrl.searchParams.set("state", state)

    // Redirect to Google
    return c.redirect(authUrl.toString())
  } catch (error) {
    console.error("Google OAuth initiation error:", error)
    return c.json({ error: "OAuth initiation failed" }, 500)
  }
})

/**
 * GET /api/auth/callback/google
 * Google OAuth callback
 */
authRoutes.get("/callback/google", async (c) => {
  try {
    const code = c.req.query("code")
    const state = c.req.query("state")

    if (!code || !state) {
      return c.redirect(`https://chrry.ai/?error=oauth_failed`)
    }

    // Decode state to get callback URLs
    let stateData: { id: string; callbackUrl: string; errorUrl: string }
    try {
      const stateJson = Buffer.from(state, "base64url").toString("utf-8")
      stateData = JSON.parse(stateJson)
    } catch (e) {
      console.error("Failed to decode state:", e)
      return c.redirect(`https://chrry.ai/?error=invalid_state`)
    }

    const storedCallbackUrl = stateData.callbackUrl
    const storedErrorUrl = stateData.errorUrl

    if (!code || !storedCallbackUrl || !storedErrorUrl) {
      // Get site config for error redirect
      const forwardedHost = c.req.header("X-Forwarded-Host")
      const siteconfig = getSiteConfig(forwardedHost || "chrry.ai")
      return c.redirect(`${siteconfig.url}/?error=oauth_failed`)
    }

    const forwardedHost = c.req.header("X-Forwarded-Host")
    const requestUrl = new URL(c.req.url)

    // const chrryUrl =
    //   requestUrl.searchParams.get("chrryUrl") ||
    //   forwardedHost ||
    //   "https://chrry.ai"
    // const siteconfig = getSiteConfig(chrryUrl || undefined)

    // Verify state (CSRF protection)

    // Exchange code for tokens
    if (!GOOGLE_WEB_CLIENT_ID || !GOOGLE_WEB_CLIENT_SECRET) {
      return c.redirect(`${storedErrorUrl}/?error=oauth_not_configured`)
    }

    const redirectUri = `${API_URL}/auth/callback/google`
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_WEB_CLIENT_ID,
        client_secret: GOOGLE_WEB_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenResponse.ok) {
      return c.redirect(`${storedErrorUrl}/?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()

    // Get user info from Google
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    )

    if (!userInfoResponse.ok) {
      return c.redirect(`${storedErrorUrl}/?error=user_info_failed`)
    }

    const googleUser = await userInfoResponse.json()

    // Find or create user
    let user = await getUser({ email: googleUser.email })

    if (!user) {
      // Create new user
      user = await createUser({
        email: googleUser.email,
        name: googleUser.name,
        image: googleUser.picture,
        userName: await generateUniqueUsername(googleUser.name),
        emailVerified: new Date(), // Google emails are verified
      })
    }

    if (!user) {
      return c.redirect(`${storedErrorUrl}/?error=user_creation_failed`)
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email)

    // Determine cookie domain from callback URL with validation
    const ALLOWED_DOMAINS = [".chrry.ai", ".chrry.dev", ".chrry.store"]
    let cookieDomain = ""
    try {
      const callbackHostname = new URL(storedCallbackUrl).hostname
      // Extract root domain (e.g., "chrry.ai" from "vex.chrry.ai")
      const domainParts = callbackHostname.split(".")
      if (domainParts.length >= 2) {
        const rootDomain = domainParts.slice(-2).join(".")
        // Validate the root domain is in our allowed list
        const isAllowed = ALLOWED_DOMAINS.some(
          (allowed) =>
            allowed === `.${rootDomain}` || rootDomain === "localhost",
        )
        if (isAllowed) {
          cookieDomain = `; Domain=.${rootDomain}`
        } else {
          console.warn("Callback domain not in allowed list:", rootDomain)
          // Don't set domain - cookie will be host-only for security
        }
      }
    } catch (e) {
      console.error("Failed to parse callback URL for cookie domain:", e)
      // If URL parsing fails, don't set domain (cookie will be host-only)
    }

    // Set auth cookie with domain for cross-subdomain auth
    const isDev = process.env.NODE_ENV === "development"
    const secureFlag = isDev ? "" : "; Secure"
    c.header(
      "Set-Cookie",
      `token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${cookieDomain}${secureFlag}`,
    )

    // Generate one-time exchange code (more secure than token in URL)
    const authCode = await generateExchangeCode(token)

    // Redirect back to the original site with auth_code in URL
    const redirectUrl = new URL(storedCallbackUrl)
    redirectUrl.searchParams.set("auth_token", authCode)
    return c.redirect(redirectUrl.toString())
  } catch (error) {
    console.error("Google OAuth callback error:", error)
    // Fallback to chrry.ai if we can't determine the site
    const forwardedHost = c.req.header("X-Forwarded-Host")
    const siteconfig = getSiteConfig(forwardedHost || "chrry.ai")
    return c.redirect(`${siteconfig.url}/?error=oauth_callback_failed`)
  }
})

/**
 * POST /api/auth/native/apple
 * Verify Apple ID token from Capacitor native plugin
 */
authRoutes.post("/native/apple", async (c) => {
  try {
    const { idToken, name: nameData } = await c.req.json()

    if (!idToken) {
      return c.json({ error: "ID token required" }, 400)
    }

    const appleSignin = (await import("apple-signin-auth")).default
    const APPLE_CLIENT_ID = process.env.APPLE_IOS_CLIENT_ID

    // Verify the ID token
    // Note: verifying Apple tokens often requires the clientID (app bundle ID)
    // to match the aud claim.

    // Debug: Decode token to inspect (without verification)
    try {
      const jwt = (await import("jsonwebtoken")).default
      const decoded = jwt.decode(idToken, { complete: true })
      console.log("🍎 Apple token header:", decoded?.header)
      console.log(
        "🍎 Apple token payload (aud):",
        (decoded?.payload as any)?.aud,
      )
      console.log("🍎 Expected audience:", [
        APPLE_CLIENT_ID,
        process.env.APPLE_IOS_CLIENT_ID || "dev.chrry",
      ])
    } catch (e) {
      console.error("Failed to decode token for debugging:", e)
    }

    let email: string | undefined
    let emailVerified: boolean | undefined

    // In development, Apple test tokens may use different public keys
    // that aren't available in Apple's public key endpoint
    const isDevelopment = process.env.NODE_ENV === "development"

    if (isDevelopment) {
      console.log("🍎 Development mode: Skipping Apple token verification")
      try {
        const jwt = (await import("jsonwebtoken")).default
        const decoded = jwt.decode(idToken) as any
        email = decoded?.email
        emailVerified =
          decoded?.email_verified === "true" || decoded?.email_verified === true
        console.log("🍎 Decoded email:", email)
      } catch (e) {
        console.error("Failed to decode token:", e)
        return c.json({ error: "Invalid Apple ID token" }, 401)
      }
    } else {
      // Production: Verify token properly
      try {
        const result = await appleSignin.verifyIdToken(idToken, {
          audience: [
            APPLE_CLIENT_ID,
            process.env.APPLE_IOS_CLIENT_ID || "dev.chrry",
          ],
          ignoreExpiration: false,
        })
        email = result.email
        emailVerified =
          result.email_verified === "true" || result.email_verified === true
      } catch (verifyError: any) {
        console.error("Apple token verification failed:", verifyError)

        // If it's a public key error, try one more time (Apple rotates keys)
        if (verifyError.message?.includes("public key")) {
          console.log(
            "Retrying Apple token verification (public key refresh)...",
          )
          try {
            const result = await appleSignin.verifyIdToken(idToken, {
              audience: [
                APPLE_CLIENT_ID,
                process.env.APPLE_IOS_CLIENT_ID || "dev.chrry",
              ],
              ignoreExpiration: false,
            })
            email = result.email
            emailVerified =
              result.email_verified === "true" || result.email_verified === true
          } catch (retryError: any) {
            console.error("Apple token verification retry failed:", retryError)
            return c.json(
              {
                error: "Failed to verify Apple ID token",
                details: retryError.message,
              },
              401,
            )
          }
        } else {
          return c.json(
            {
              error: "Failed to verify Apple ID token",
              details: verifyError.message,
            },
            401,
          )
        }
      }
    }

    if (!email) {
      return c.json({ error: "No email in token" }, 400)
    }

    // Find or create user
    let user = await getUser({ email })

    if (!user) {
      // Create new user
      // For Apple Sign In, we only get the name on the FIRST sign in.
      // The client should send it if available.
      let name = email.split("@")[0]
      if (nameData) {
        const { givenName, familyName } = nameData
        if (givenName || familyName) {
          name = `${givenName || ""} ${familyName || ""}`.trim()
        }
      }

      user = await createUser({
        email,
        name,
        userName: await generateUniqueUsername(name),
        emailVerified: emailVerified ? new Date() : undefined,
      })
    }

    if (!user) {
      return c.json({ error: "User creation failed" }, 500)
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email)

    // Set cookie
    const isDev = process.env.NODE_ENV === "development"
    const secureFlag = isDev ? "" : "; Secure"
    const sameSite = isDev ? "Lax" : "None"

    const cookieValue = `token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=${sameSite}${secureFlag}`
    c.header("Set-Cookie", cookieValue)

    const authCode = await generateExchangeCode(token)

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      token: authCode,
      jwt: token,
    })
  } catch (error) {
    console.error("Native Apple auth error:", error)
    return c.json({ error: "Authentication failed" }, 500)
  }
})

/**
 * GET /api/auth/signin/apple
 * Initiate Apple OAuth flow
 * Note: Apple requires HTTPS, won't work on localhost
 */
authRoutes.get("/signin/apple", async (c) => {
  try {
    const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID

    if (!APPLE_CLIENT_ID) {
      return c.json({ error: "Apple OAuth not configured" }, 500)
    }

    // Allowed domains for callback URLs (security validation)
    const ALLOWED_DOMAINS = [
      ".chrry.ai",
      ".chrry.dev",
      ".chrry.store",
      "localhost",
    ]

    // Get callback URLs from query params and ensure they're strings
    const callbackUrlParam = c.req.query("callbackUrl")
    // Decode if already encoded (to prevent double-encoding)
    let callbackUrl =
      typeof callbackUrlParam === "string" ? callbackUrlParam : undefined
    if (callbackUrl && callbackUrl.includes("%")) {
      try {
        callbackUrl = decodeURIComponent(callbackUrl)
      } catch (e) {
        // If decode fails, use as-is
      }
    }

    // Validate callback URL belongs to allowed domain
    if (callbackUrl) {
      try {
        const callbackUrlObj = new URL(callbackUrl)
        const isValidDomain = ALLOWED_DOMAINS.some(
          (domain) =>
            callbackUrlObj.hostname === domain.replace(".", "") ||
            callbackUrlObj.hostname.endsWith(domain),
        )
        if (!isValidDomain) {
          console.error("Invalid callback domain:", callbackUrlObj.hostname)
          return c.json({ error: "Invalid callback domain" }, 400)
        }
      } catch (e) {
        console.error("Invalid callback URL:", callbackUrl)
        return c.json({ error: "Invalid callback URL" }, 400)
      }
    } else {
      // Fallback to current origin if no callback URL provided
      const requestUrl = new URL(c.req.url)
      callbackUrl = `${requestUrl.protocol}//${requestUrl.host}`
    }

    const errorUrlParam = c.req.query("errorUrl")
    let errorUrl = typeof errorUrlParam === "string" ? errorUrlParam : undefined
    if (errorUrl && errorUrl.includes("%")) {
      try {
        errorUrl = decodeURIComponent(errorUrl)
      } catch (e) {
        // If decode fails, use as-is
      }
    }

    // Fallback for error URL
    if (!errorUrl) {
      errorUrl = callbackUrl + "/?error=oauth_failed"
    }

    // Generate state for CSRF protection and encode callback URLs in it
    // Format: {stateId}:{callbackUrl}:{errorUrl}
    const stateId = uuidv4()
    const stateData = {
      id: stateId,
      callbackUrl: callbackUrl || "",
      errorUrl: errorUrl || "",
    }
    // Base64 encode the state to make it URL-safe
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64url")

    // Store state in cookie for verification (Apple uses POST callback)
    // SameSite=None required for Apple's cross-site POST callback
    const isProduction = process.env.NODE_ENV === "production"
    c.header(
      "Set-Cookie",
      `oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=None${isProduction ? "; Secure" : ""}`,
    )

    // Build Apple OAuth URL with API server callback
    const redirectUri = `${API_URL}/auth/callback/apple`
    const authUrl = new URL("https://appleid.apple.com/auth/authorize")
    authUrl.searchParams.set("client_id", APPLE_CLIENT_ID)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("response_mode", "form_post")
    authUrl.searchParams.set("scope", "name email")
    authUrl.searchParams.set("state", state)

    // Redirect to Apple
    return c.redirect(authUrl.toString())
  } catch (error) {
    console.error("Apple OAuth initiation error:", error)
    return c.json({ error: "OAuth initiation failed" }, 500)
  }
})

/**
 * POST /api/auth/callback/apple
 * Apple OAuth callback (POST because Apple uses form_post)
 */
authRoutes.post("/callback/apple", async (c) => {
  try {
    const body = await c.req.parseBody()
    const code = body.code as string
    const state = body.state as string

    if (!code || !state) {
      return c.redirect(`https://chrry.ai/?error=oauth_failed`)
    }

    // Decode state to get callback URLs
    let stateData: { id: string; callbackUrl: string; errorUrl: string }
    try {
      const stateJson = Buffer.from(state, "base64url").toString("utf-8")
      stateData = JSON.parse(stateJson)
    } catch (e) {
      console.error("Failed to decode state:", e)
      return c.redirect(`https://chrry.ai/?error=invalid_state`)
    }

    const storedCallbackUrl = stateData.callbackUrl
    const storedErrorUrl = stateData.errorUrl

    if (!code || !storedCallbackUrl || !storedErrorUrl) {
      return c.redirect(`https://chrry.ai/?error=oauth_failed`)
    }

    // Verify state cookie (CSRF protection)
    const cookieHeader = c.req.header("cookie")
    const stateMatch = cookieHeader?.match(/oauth_state=([^;]+)/)
    const storedState = stateMatch ? stateMatch[1] : null

    if (state !== storedState) {
      return c.redirect(`${storedErrorUrl}?error=invalid_state`)
    }

    const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID
    const APPLE_CLIENT_SECRET = process.env.APPLE_CLIENT_SECRET

    if (!APPLE_CLIENT_ID || !APPLE_CLIENT_SECRET) {
      return c.redirect(`${storedErrorUrl}?error=oauth_not_configured`)
    }

    // Exchange code for tokens
    const redirectUri = `${API_URL}/auth/callback/apple`
    const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: APPLE_CLIENT_ID,
        client_secret: APPLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error("Apple token exchange failed:", errorText)
      return c.redirect(`${storedErrorUrl}?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()

    // Decode the id_token to get user info (Apple doesn't have a userinfo endpoint)
    const idToken = tokens.id_token
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64").toString(),
    )

    // Apple only provides email in the token
    const email = payload.email
    const emailVerified = payload.email_verified === "true"

    // Get user name from the initial request (only provided on first auth)
    let name = null
    if (body.user) {
      try {
        const userData = JSON.parse(body.user as string)
        name =
          `${userData.name?.firstName || ""} ${userData.name?.lastName || ""}`.trim()
      } catch (e) {
        // Name not provided or parsing failed
      }
    }

    // Find or create user
    let user = await getUser({ email })

    if (!user) {
      // Create new user
      user = await createUser({
        email,
        name: name || email.split("@")[0], // Fallback to email username
        userName: await generateUniqueUsername(name || email.split("@")[0]),
        emailVerified: emailVerified ? new Date() : undefined,
      })
    }

    if (!user) {
      return c.redirect(`${storedErrorUrl}?error=user_creation_failed`)
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email)

    // Clear oauth_state cookie
    c.header("Set-Cookie", "oauth_state=; HttpOnly; Path=/; Max-Age=0")

    // Generate one-time exchange code (more secure than token in URL)
    const authCode = await generateExchangeCode(token)

    // Redirect back to app with auth_token in URL
    return c.redirect(`${storedCallbackUrl}?auth_token=${authCode}`)
  } catch (error) {
    console.error("Apple OAuth callback error:", error)
    // Fallback to chrry.ai if callback URL not available
    return c.redirect(`https://chrry.ai/?error=oauth_callback_failed`)
  }
})

/**
 * POST /api/auth/exchange-code
 * Exchange one-time code for JWT token (secure OAuth flow)
 */
authRoutes.post("/exchange-code", async (c) => {
  try {
    const { code } = await c.req.json()

    if (!code) {
      return c.json({ error: "Code required" }, 400)
    }

    // Exchange code for token (one-time use, 5-minute expiry)
    const token = await exchangeCodeForToken(code)

    if (!token) {
      return c.json({ error: "Invalid or expired code" }, 401)
    }

    return c.json({ token })
  } catch (error) {
    console.error("Code exchange error:", error)
    return c.json({ error: "Code exchange failed" }, 500)
  }
})

/**
 * GET /api/auth/signin/github
 * Initiate GitHub OAuth flow
 */
authRoutes.get("/signin/github", async (c) => {
  try {
    if (!GITHUB_CLIENT_ID) {
      return c.json({ error: "GitHub OAuth not configured" }, 500)
    }

    // Allowed domains for callback URLs (security validation)
    const ALLOWED_DOMAINS = [
      ".chrry.ai",
      ".chrry.dev",
      ".chrry.store",
      "localhost",
    ]

    // Get callback URLs from query params and ensure they're strings
    const callbackUrlParam = c.req.query("callbackUrl")
    // Decode if already encoded (to prevent double-encoding)
    let callbackUrl =
      typeof callbackUrlParam === "string" ? callbackUrlParam : undefined
    if (callbackUrl && callbackUrl.includes("%")) {
      try {
        callbackUrl = decodeURIComponent(callbackUrl)
      } catch (e) {
        // If decode fails, use as-is
      }
    }

    // Validate callback URL belongs to allowed domain
    if (callbackUrl) {
      try {
        const callbackUrlObj = new URL(callbackUrl)
        const isValidDomain = ALLOWED_DOMAINS.some(
          (domain) =>
            callbackUrlObj.hostname === domain.replace(".", "") ||
            callbackUrlObj.hostname.endsWith(domain),
        )
        if (!isValidDomain) {
          console.error("Invalid callback domain:", callbackUrlObj.hostname)
          return c.json({ error: "Invalid callback domain" }, 400)
        }
      } catch (e) {
        console.error("Invalid callback URL:", callbackUrl)
        return c.json({ error: "Invalid callback URL" }, 400)
      }
    } else {
      // Fallback to current origin if no callback URL provided
      const requestUrl = new URL(c.req.url)
      callbackUrl = `${requestUrl.protocol}//${requestUrl.host}`
    }

    const errorUrlParam = c.req.query("errorUrl")
    let errorUrl = typeof errorUrlParam === "string" ? errorUrlParam : undefined
    if (errorUrl && errorUrl.includes("%")) {
      try {
        errorUrl = decodeURIComponent(errorUrl)
      } catch (e) {
        // If decode fails, use as-is
      }
    }

    // Fallback for error URL
    if (!errorUrl) {
      errorUrl = callbackUrl + "/?error=oauth_failed"
    }

    // Generate state for CSRF protection and encode callback URLs in it
    const stateId = uuidv4()
    const stateData = {
      id: stateId,
      callbackUrl: callbackUrl || "",
      errorUrl: errorUrl || "",
    }
    // Base64 encode the state to make it URL-safe
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64url")

    // Build GitHub OAuth URL with API server callback
    const redirectUri = `${API_URL}/auth/callback/github`
    const authUrl = new URL("https://github.com/login/oauth/authorize")
    authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("scope", "read:user user:email")
    authUrl.searchParams.set("state", state)

    // Redirect to GitHub
    return c.redirect(authUrl.toString())
  } catch (error) {
    console.error("GitHub OAuth initiation error:", error)
    return c.json({ error: "OAuth initiation failed" }, 500)
  }
})

/**
 * GET /api/auth/callback/github
 * GitHub OAuth callback
 */
authRoutes.get("/callback/github", async (c) => {
  try {
    const code = c.req.query("code")
    const state = c.req.query("state")

    if (!code || !state) {
      return c.redirect(`https://chrry.ai/?error=oauth_failed`)
    }

    // Decode state to get callback URLs
    let stateData: { id: string; callbackUrl: string; errorUrl: string }
    try {
      const stateJson = Buffer.from(state, "base64url").toString("utf-8")
      stateData = JSON.parse(stateJson)
    } catch (e) {
      console.error("Failed to decode state:", e)
      return c.redirect(`https://chrry.ai/?error=invalid_state`)
    }

    const storedCallbackUrl = stateData.callbackUrl
    const storedErrorUrl = stateData.errorUrl

    if (!code || !storedCallbackUrl || !storedErrorUrl) {
      const forwardedHost = c.req.header("X-Forwarded-Host")
      const siteconfig = getSiteConfig(forwardedHost || "chrry.ai")
      return c.redirect(`${siteconfig.url}/?error=oauth_failed`)
    }

    // Exchange code for access token
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return c.redirect(`${storedErrorUrl}/?error=oauth_not_configured`)
    }

    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        }),
      },
    )

    if (!tokenResponse.ok) {
      return c.redirect(`${storedErrorUrl}/?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()

    if (tokens.error) {
      console.error("GitHub token error:", tokens.error_description)
      return c.redirect(
        `${storedErrorUrl}/?error=${tokens.error_description || "token_exchange_failed"}`,
      )
    }

    // Get user info from GitHub
    const userInfoResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })

    if (!userInfoResponse.ok) {
      return c.redirect(`${storedErrorUrl}/?error=user_info_failed`)
    }

    const githubUser = await userInfoResponse.json()

    // Get user's primary email from GitHub
    const emailsResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })

    let email = githubUser.email
    if (!email && emailsResponse.ok) {
      const emails = await emailsResponse.json()
      const primaryEmail =
        emails.find((e: any) => e.primary && e.verified) || emails[0]
      email = primaryEmail?.email
    }

    if (!email) {
      return c.redirect(`${storedErrorUrl}/?error=no_email_found`)
    }

    // Find or create user
    let user = await getUser({ email })

    if (!user) {
      // Create new user
      user = await createUser({
        email,
        name: githubUser.name || githubUser.login,
        image: githubUser.avatar_url,
        userName: await generateUniqueUsername(
          githubUser.name || githubUser.login,
        ),
        emailVerified: new Date(), // GitHub emails are verified
      })
    }

    if (!user) {
      return c.redirect(`${storedErrorUrl}/?error=user_creation_failed`)
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email)

    // Determine cookie domain from callback URL with validation
    const ALLOWED_DOMAINS = [".chrry.ai", ".chrry.dev", ".chrry.store"]
    let cookieDomain = ""
    try {
      const callbackHostname = new URL(storedCallbackUrl).hostname
      const domainParts = callbackHostname.split(".")
      if (domainParts.length >= 2) {
        const rootDomain = domainParts.slice(-2).join(".")
        const isAllowed = ALLOWED_DOMAINS.some(
          (allowed) =>
            allowed === `.${rootDomain}` || rootDomain === "localhost",
        )
        if (isAllowed) {
          cookieDomain = `; Domain=.${rootDomain}`
        } else {
          console.warn("Callback domain not in allowed list:", rootDomain)
        }
      }
    } catch (e) {
      console.error("Failed to parse callback URL for cookie domain:", e)
    }

    // Set auth cookie with domain for cross-subdomain auth
    const isDev = process.env.NODE_ENV === "development"
    const secureFlag = isDev ? "" : "; Secure"
    c.header(
      "Set-Cookie",
      `token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${cookieDomain}${secureFlag}`,
    )

    // Generate one-time exchange code (more secure than token in URL)
    const authCode = await generateExchangeCode(token)

    // Redirect back to the original site with auth_code in URL
    const redirectUrl = new URL(storedCallbackUrl)
    redirectUrl.searchParams.set("auth_token", authCode)
    return c.redirect(redirectUrl.toString())
  } catch (error) {
    console.error("GitHub OAuth callback error:", error)
    const forwardedHost = c.req.header("X-Forwarded-Host")
    const siteconfig = getSiteConfig(forwardedHost || "chrry.ai")
    return c.redirect(`${siteconfig.url}/?error=oauth_callback_failed`)
  }
})

export default authRoutes
