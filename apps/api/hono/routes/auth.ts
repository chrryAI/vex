import { Hono } from "hono"
import { sign, verify } from "jsonwebtoken"
import { compare, hash } from "bcrypt"
import {
  getUser,
  createUser,
  getStore,
  eq,
  and,
  gt,
  db,
  authExchangeCodes,
} from "@repo/db"
import { v4 as uuidv4 } from "uuid"
import { API_URL, isValidUsername } from "@chrryai/chrry/utils"
import { randomBytes } from "crypto"
import type { Context } from "hono"
import { getCookie, setCookie, deleteCookie } from "hono/cookie"

const authRoutes = new Hono()

// ==================== CONSTANTS ====================
const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID
const GOOGLE_WEB_CLIENT_SECRET = process.env.GOOGLE_WEB_CLIENT_SECRET
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const JWT_SECRET = process.env.NEXTAUTH_SECRET || "development-secret"
const JWT_EXPIRY = "30d"
const ALLOWED_DOMAINS = [".chrry.ai", ".chrry.dev", ".chrry.store", "localhost"]
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days

// ==================== TYPES ====================
interface OAuthState {
  id: string
  callbackUrl: string
  errorUrl: string
}

interface CookieOptions {
  domain?: string
  secure?: boolean
  sameSite: "Lax" | "None"
}

interface UserProfile {
  email: string
  name?: string
  image?: string
  emailVerified?: boolean
}

// ==================== JWT HELPERS ====================

function generateToken(userId: string, email: string): string {
  return sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    return verify(token, JWT_SECRET) as { userId: string; email: string }
  } catch {
    return null
  }
}

// ==================== EXCHANGE CODE HELPERS ====================

async function generateExchangeCode(token: string): Promise<string> {
  const code = randomBytes(32).toString("base64url")
  const expiresOn = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  await db.insert(authExchangeCodes).values({
    code,
    token,
    expiresOn,
  })

  return code
}

async function exchangeCodeForToken(code: string): Promise<string | null> {
  const now = new Date()

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

  if (!result) return null

  await db
    .update(authExchangeCodes)
    .set({ used: true })
    .where(eq(authExchangeCodes.id, result.id))

  return result.token
}

// ==================== USERNAME HELPERS ====================

async function checkUsernameExists(username: string): Promise<boolean> {
  const existingUser = await getUser({ userName: username })
  if (existingUser) return true

  const existingStore = await getStore({ slug: username })
  return !!existingStore?.store
}

async function generateUniqueUsername(
  fullName: string | null | undefined,
): Promise<string> {
  if (!fullName) return uuidv4()

  const firstNameRaw = fullName.split(" ")[0]
  if (!firstNameRaw) return uuidv4()

  const firstName = firstNameRaw.toLowerCase().replaceAll(/[^a-z0-9]/g, "")
  if (!firstName || !isValidUsername(firstName)) return uuidv4()

  // Try base name
  if (!(await checkUsernameExists(firstName))) {
    return firstName
  }

  // Try with numbers
  for (let counter = 1; counter <= 999; counter++) {
    const username = `${firstName}${counter}`
    if (!(await checkUsernameExists(username)) && isValidUsername(username)) {
      return username
    }
  }

  return uuidv4()
}

// ==================== COOKIE HELPERS ====================

function getCookieDomain(hostname: string): string {
  try {
    const domainParts = hostname.split(".")
    if (domainParts.length < 2) return ""

    const rootDomain = domainParts.slice(-2).join(".")
    const isAllowed = ALLOWED_DOMAINS.some(
      (allowed) => allowed === `.${rootDomain}` || rootDomain === "localhost",
    )

    return isAllowed ? `; Domain=.${rootDomain}` : ""
  } catch {
    return ""
  }
}

function buildCookieString(token: string, options: CookieOptions): string {
  const isDev = process.env.NODE_ENV === "development"
  const secureFlag = (options.secure ?? !isDev) ? "; Secure" : ""
  const domainFlag = options.domain || ""

  return `token=${token}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=${options.sameSite || "Lax"}${domainFlag}${secureFlag}`
}

function setCookieFromHost(
  c: Context,
  token: string,
  sameSite: "Lax" | "None" = "Lax",
): void {
  const forwardedHost = c.req.header("X-Forwarded-Host") || c.req.header("Host")
  const cookieDomain = forwardedHost ? getCookieDomain(forwardedHost) : ""

  c.header(
    "Set-Cookie",
    buildCookieString(token, { domain: cookieDomain, sameSite }),
  )
}

function setCookieFromUrl(
  c: Context,
  token: string,
  callbackUrl: string,
): void {
  try {
    const callbackHostname = new URL(callbackUrl).hostname
    const cookieDomain = getCookieDomain(callbackHostname)
    c.header(
      "Set-Cookie",
      buildCookieString(token, { domain: cookieDomain, sameSite: "Lax" }),
    )
  } catch (e) {
    console.error("Failed to parse callback URL for cookie domain:", e)
    c.header("Set-Cookie", buildCookieString(token, { sameSite: "Lax" }))
  }
}

// ==================== URL VALIDATION HELPERS ====================

function validateCallbackUrl(callbackUrl: string): boolean {
  try {
    const callbackUrlObj = new URL(callbackUrl)
    return ALLOWED_DOMAINS.some(
      (domain) =>
        callbackUrlObj.hostname === domain.replace(".", "") ||
        callbackUrlObj.hostname.endsWith(domain),
    )
  } catch {
    return false
  }
}

function decodeUrlParam(param: string | undefined): string | undefined {
  if (!param || typeof param !== "string") return undefined

  if (param.includes("%")) {
    try {
      return decodeURIComponent(param)
    } catch {
      return param
    }
  }
  return param
}

function getCallbackUrls(c: Context): {
  callbackUrl: string
  errorUrl: string
} {
  const callbackUrlParam = decodeUrlParam(c.req.query("callbackUrl"))
  const errorUrlParam = decodeUrlParam(c.req.query("errorUrl"))

  let callbackUrl = callbackUrlParam
  let errorUrl = errorUrlParam

  // Validate callback URL
  if (callbackUrl && !validateCallbackUrl(callbackUrl)) {
    throw new Error("Invalid callback domain")
  }

  // Fallback to current origin
  if (!callbackUrl) {
    const requestUrl = new URL(c.req.url)
    callbackUrl = `${requestUrl.protocol}//${requestUrl.host}`
  }

  // Fallback error URL
  if (!errorUrl) {
    errorUrl = callbackUrl + "/?error=oauth_failed"
  }

  return { callbackUrl, errorUrl }
}

// ==================== STATE HELPERS ====================

function encodeOAuthState(data: OAuthState): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url")
}

function decodeOAuthState(state: string): OAuthState | null {
  try {
    const stateJson = Buffer.from(state, "base64url").toString("utf-8")
    return JSON.parse(stateJson)
  } catch {
    return null
  }
}

function createOAuthState(callbackUrl: string, errorUrl: string): string {
  const stateData: OAuthState = {
    id: uuidv4(),
    callbackUrl,
    errorUrl,
  }
  return encodeOAuthState(stateData)
}

// ==================== USER HELPERS ====================

async function findOrCreateUser(profile: UserProfile): Promise<any> {
  let user = await getUser({ email: profile.email })

  if (!user) {
    user = await createUser({
      email: profile.email,
      name: profile.name || profile.email.split("@")[0],
      image: profile.image,
      userName: await generateUniqueUsername(
        profile.name || profile.email.split("@")[0],
      ),
      emailVerified: profile.emailVerified ? new Date() : undefined,
    })
  }

  return user
}

// ==================== TOKEN EXTRACTION ====================

function extractTokenFromRequest(c: Context): string | null {
  const cookieHeader = c.req.header("cookie")
  const authHeader = c.req.header("authorization")

  if (cookieHeader) {
    const match = cookieHeader.match(/token=([^;]+)/)
    return match?.[1] ?? null
  }

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7)
  }

  return null
}

// ==================== RESPONSE BUILDERS ====================

function buildAuthResponse(user: any, authCode: string, callbackUrl?: string) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    },
    token: authCode,
    ...(callbackUrl && {
      callbackUrl: `${callbackUrl}${callbackUrl.includes("?") ? "&" : "?"}auth_token=${authCode}`,
    }),
  }
}

function buildRedirectUrl(baseUrl: string, authCode: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set("auth_token", authCode)
  return url.toString()
}

// ==================== ROUTES ====================

/**
 * POST /api/auth/signup/password
 */
authRoutes.post("/signup/password", async (c) => {
  try {
    const { email, password, name } = await c.req.json()

    if (!email || !password) {
      return c.json({ error: "Email and password required" }, 400)
    }

    const existingUser = await getUser({ email })
    if (existingUser) {
      return c.json({ error: "User already exists" }, 400)
    }

    const passwordHash = await hash(password, 10)
    const newUser = await createUser({
      email,
      password: passwordHash,
      name,
      userName: await generateUniqueUsername(name),
    })

    if (!newUser) {
      return c.json({ error: "User creation failed" }, 500)
    }

    const token = generateToken(newUser.id, newUser.email)
    setCookieFromHost(c, token, "Lax")

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
 */
authRoutes.post("/signin/password", async (c) => {
  try {
    const { email, password, callbackUrl } = await c.req.json()

    if (!email || !password) {
      return c.json({ error: "Email and password required" }, 400)
    }

    const user = await getUser({ email })
    if (!user || !user.password) {
      return c.json({ error: "Invalid credentials" }, 401)
    }

    const valid = await compare(password, user.password)
    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401)
    }

    const token = generateToken(user.id, user.email)
    setCookieFromHost(c, token, "None")

    const authCode = await generateExchangeCode(token)
    return c.json(buildAuthResponse(user, authCode, callbackUrl))
  } catch (error) {
    console.error("Signin error:", error)
    return c.json({ error: "Signin failed" }, 500)
  }
})

/**
 * GET /api/auth/session
 */
authRoutes.get("/session", async (c) => {
  try {
    const token = extractTokenFromRequest(c)
    if (!token) {
      return c.json({ user: null })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return c.json({ user: null })
    }

    const user = await getUser({ id: payload.userId })
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
 */
authRoutes.post("/signout", async (c) => {
  const isDev = process.env.NODE_ENV === "development"
  c.header(
    "Set-Cookie",
    `token=; ${isDev ? "" : "HttpOnly; "}Path=/; Max-Age=0; SameSite=Lax`,
  )
  return c.json({ success: true })
})

/**
 * POST /api/auth/exchange-code
 */
authRoutes.post("/exchange-code", async (c) => {
  try {
    const { code } = await c.req.json()
    if (!code) {
      return c.json({ error: "Code required" }, 400)
    }

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

// ==================== GOOGLE OAUTH ====================

authRoutes.post("/native/google", async (c) => {
  try {
    const { idToken } = await c.req.json()
    if (!idToken || !GOOGLE_WEB_CLIENT_ID) {
      return c.json({ error: "Invalid request" }, 400)
    }

    const { OAuth2Client } = await import("google-auth-library")
    const client = new OAuth2Client(GOOGLE_WEB_CLIENT_ID)

    const isDevelopment = process.env.NODE_ENV === "development"
    let payload: any

    if (isDevelopment) {
      const jwt = (await import("jsonwebtoken")).default
      payload = jwt.decode(idToken) as any
    } else {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: [
          GOOGLE_WEB_CLIENT_ID,
          process.env.GOOGLE_IOS_CLIENT_ID || "",
        ],
      })
      payload = ticket.getPayload()
    }

    if (!payload?.email) {
      return c.json({ error: "Invalid token payload" }, 400)
    }

    const user = await findOrCreateUser({
      email: payload.email,
      name: payload.name,
      image: payload.picture,
      emailVerified: true,
    })

    if (!user) {
      return c.json({ error: "User creation failed" }, 500)
    }

    const token = generateToken(user.id, user.email)
    setCookieFromHost(c, token, "None")

    const authCode = await generateExchangeCode(token)

    return c.json({
      ...buildAuthResponse(user, authCode),
      jwt: token,
    })
  } catch (error) {
    console.error("Native Google auth error:", error)
    return c.json({ error: "Authentication failed" }, 500)
  }
})

authRoutes.get("/signin/google", async (c) => {
  try {
    if (!GOOGLE_WEB_CLIENT_ID) {
      return c.json({ error: "Google OAuth not configured" }, 500)
    }

    const { callbackUrl, errorUrl } = getCallbackUrls(c)
    const state = createOAuthState(callbackUrl, errorUrl)

    setCookie(c, "oauth_state", state, {
      httpOnly: true,
<<<<<<< HEAD
      path: "/",
      maxAge: 600,
      sameSite: "None",
      secure: true,
=======
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 600,
>>>>>>> 959f1b85e880687b31cf67b1fd8ecc7bee7cdf32
    })

    const redirectUri = `${API_URL}/auth/callback/google`
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", GOOGLE_WEB_CLIENT_ID)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", "openid email profile")
    authUrl.searchParams.set("state", state)

    return c.redirect(authUrl.toString())
  } catch (error) {
    console.error("Google OAuth initiation error:", error)
    return c.json({ error: "OAuth initiation failed" }, 500)
  }
})

authRoutes.get("/callback/google", async (c) => {
  try {
    const code = c.req.query("code")
    const state = c.req.query("state")

    if (!code || !state) {
      return c.redirect(`https://chrry.ai/?error=oauth_failed`)
    }

    const stateData = decodeOAuthState(state)
    if (!stateData) {
      return c.redirect(`https://chrry.ai/?error=invalid_state`)
    }

    const storedState = getCookie(c, "oauth_state")

    if (state !== storedState) {
<<<<<<< HEAD
      // Redirect to static URL to prevent Open Redirect
=======
>>>>>>> 959f1b85e880687b31cf67b1fd8ecc7bee7cdf32
      return c.redirect(`https://chrry.ai/?error=invalid_state`)
    }

    if (!GOOGLE_WEB_CLIENT_ID || !GOOGLE_WEB_CLIENT_SECRET) {
      return c.redirect(`${stateData.errorUrl}/?error=oauth_not_configured`)
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
      return c.redirect(`${stateData.errorUrl}/?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    )

    if (!userInfoResponse.ok) {
      return c.redirect(`${stateData.errorUrl}/?error=user_info_failed`)
    }

    const googleUser = await userInfoResponse.json()

    const user = await findOrCreateUser({
      email: googleUser.email,
      name: googleUser.name,
      image: googleUser.picture,
      emailVerified: true,
    })

    if (!user) {
      return c.redirect(`${stateData.errorUrl}/?error=user_creation_failed`)
    }

    const token = generateToken(user.id, user.email)

<<<<<<< HEAD
    setCookie(c, "oauth_state", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
      sameSite: "None",
      secure: true,
=======
    deleteCookie(c, "oauth_state", {
      path: "/",
      secure: true,
      sameSite: "Lax",
>>>>>>> 959f1b85e880687b31cf67b1fd8ecc7bee7cdf32
    })

    setCookieFromUrl(c, token, stateData.callbackUrl)

    const authCode = await generateExchangeCode(token)
    return c.redirect(buildRedirectUrl(stateData.callbackUrl, authCode))
  } catch (error) {
    console.error("Google OAuth callback error:", error)
    return c.redirect(`https://chrry.ai/?error=oauth_callback_failed`)
  }
})

// ==================== APPLE OAUTH ====================

authRoutes.post("/native/apple", async (c) => {
  try {
    const { idToken, name: nameData } = await c.req.json()
    const APPLE_CLIENT_ID = process.env.APPLE_IOS_CLIENT_ID

    if (!idToken || !APPLE_CLIENT_ID) {
      return c.json({ error: "Invalid request" }, 400)
    }

    const appleSignin = (await import("apple-signin-auth")).default
    const isDevelopment = process.env.NODE_ENV === "development"

    let email: string | undefined
    let emailVerified: boolean | undefined

    if (isDevelopment) {
      const jwt = (await import("jsonwebtoken")).default
      const decoded = jwt.decode(idToken) as any
      email = decoded?.email
      emailVerified =
        decoded?.email_verified === "true" || decoded?.email_verified === true
    } else {
      const result = await appleSignin.verifyIdToken(idToken, {
        audience: [APPLE_CLIENT_ID, process.env.APPLE_IOS_CLIENT_ID || ""],
        ignoreExpiration: false,
      })
      email = result.email
      emailVerified =
        result.email_verified === "true" || result.email_verified === true
    }

    if (!email) {
      return c.json({ error: "No email in token" }, 400)
    }

    let name = email.split("@")[0]
    if (nameData) {
      const { givenName, familyName } = nameData
      if (givenName || familyName) {
        name = `${givenName || ""} ${familyName || ""}`.trim()
      }
    }

    const user = await findOrCreateUser({
      email,
      name,
      emailVerified,
    })

    if (!user) {
      return c.json({ error: "User creation failed" }, 500)
    }

    const token = generateToken(user.id, user.email)
    setCookieFromHost(c, token, "None")

    const authCode = await generateExchangeCode(token)

    return c.json({
      ...buildAuthResponse(user, authCode),
      jwt: token,
    })
  } catch (error) {
    console.error("Native Apple auth error:", error)
    return c.json({ error: "Authentication failed" }, 500)
  }
})

authRoutes.get("/signin/apple", async (c) => {
  try {
    const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID

    if (!APPLE_CLIENT_ID) {
      return c.json({ error: "Apple OAuth not configured" }, 500)
    }

    const { callbackUrl, errorUrl } = getCallbackUrls(c)
    const state = createOAuthState(callbackUrl, errorUrl)

    setCookie(c, "oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "None", // Required for form_post callback from Apple
      path: "/",
      maxAge: 600,
    })

    const redirectUri = `${API_URL}/auth/callback/apple`
    const authUrl = new URL("https://appleid.apple.com/auth/authorize")
    authUrl.searchParams.set("client_id", APPLE_CLIENT_ID)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("response_mode", "form_post")
    authUrl.searchParams.set("scope", "name email")
    authUrl.searchParams.set("state", state)

    return c.redirect(authUrl.toString())
  } catch (error) {
    console.error("Apple OAuth initiation error:", error)
    return c.json({ error: "OAuth initiation failed" }, 500)
  }
})

authRoutes.post("/callback/apple", async (c) => {
  try {
    const body = await c.req.parseBody()
    const code = body.code as string
    const state = body.state as string

    if (!code || !state) {
      return c.redirect(`https://chrry.ai/?error=oauth_failed`)
    }

    const stateData = decodeOAuthState(state)
    if (!stateData) {
      return c.redirect(`https://chrry.ai/?error=invalid_state`)
    }

    const storedState = getCookie(c, "oauth_state")

    if (state !== storedState) {
      return c.redirect(`https://chrry.ai/?error=invalid_state`)
    }

    const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID
    const APPLE_CLIENT_SECRET = process.env.APPLE_CLIENT_SECRET

    if (!APPLE_CLIENT_ID || !APPLE_CLIENT_SECRET) {
      return c.redirect(`${stateData.errorUrl}?error=oauth_not_configured`)
    }

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
      return c.redirect(`${stateData.errorUrl}?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()
    const idToken = tokens.id_token
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64").toString(),
    )

    const email = payload.email
    const emailVerified = payload.email_verified === "true"

    let name = null
    if (body.user) {
      try {
        const userData = JSON.parse(body.user as string)
        name =
          `${userData.name?.firstName || ""} ${userData.name?.lastName || ""}`.trim()
      } catch (e) {
        // Name not provided
      }
    }

    const user = await findOrCreateUser({
      email,
      name: name || email.split("@")[0],
      emailVerified,
    })

    if (!user) {
      return c.redirect(`${stateData.errorUrl}?error=user_creation_failed`)
    }

    const token = generateToken(user.id, user.email)

    deleteCookie(c, "oauth_state", {
      path: "/",
      secure: true,
      sameSite: "None",
    })

    setCookieFromUrl(c, token, stateData.callbackUrl)

    const authCode = await generateExchangeCode(token)
    return c.redirect(buildRedirectUrl(stateData.callbackUrl, authCode))
  } catch (error) {
    console.error("Apple OAuth callback error:", error)
    return c.redirect(`https://chrry.ai/?error=oauth_callback_failed`)
  }
})

export default authRoutes
