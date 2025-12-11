import { Hono } from "hono"
import { sign, verify } from "jsonwebtoken"
import { compare, hash } from "bcrypt"
import { db } from "@repo/db"
import { users } from "@repo/db/src/schema"
import { eq } from "drizzle-orm"

const authRoutes = new Hono()

// JWT secret (reuse existing env var)
const JWT_SECRET =
  process.env.BETTER_AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "development-secret"
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
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (existingUser) {
      return c.json({ error: "User already exists" }, 400)
    }

    // Hash password
    const passwordHash = await hash(password, 10)

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        password: passwordHash,
        name: name || email.split("@")[0],
        emailVerified: new Date(), // Auto-verify for now
      })
      .returning()

    // Generate token
    const token = generateToken(newUser.id, newUser.email)

    // Set HTTP-only cookie
    c.header(
      "Set-Cookie",
      `token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`,
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
    const { email, password } = await c.req.json()

    if (!email || !password) {
      return c.json({ error: "Email and password required" }, 400)
    }

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (!user || !user.password) {
      return c.json({ error: "Invalid credentials" }, 401)
    }

    // Verify password
    const valid = await compare(password, user.password)

    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401)
    }

    // Generate token
    const token = generateToken(user.id, user.email)

    // Set HTTP-only cookie
    c.header(
      "Set-Cookie",
      `token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`,
    )

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      token,
    })
  } catch (error) {
    console.error("Signin error:", error)
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
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
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
  // Clear cookie
  c.header(
    "Set-Cookie",
    "auth-token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
  )

  return c.json({ success: true })
})

/**
 * GET /api/auth/signin/google
 * Initiate Google OAuth flow
 * TODO: Implement Google OAuth
 */
authRoutes.get("/signin/google", async (c) => {
  return c.json({ error: "Google OAuth not yet implemented" }, 501)
})

/**
 * GET /api/auth/callback/google
 * Google OAuth callback
 * TODO: Implement Google OAuth callback
 */
authRoutes.get("/callback/google", async (c) => {
  return c.json({ error: "Google OAuth not yet implemented" }, 501)
})

/**
 * GET /api/auth/signin/apple
 * Initiate Apple OAuth flow
 * TODO: Implement Apple OAuth
 */
authRoutes.get("/signin/apple", async (c) => {
  return c.json({ error: "Apple OAuth not yet implemented" }, 501)
})

/**
 * POST /api/auth/callback/apple
 * Apple OAuth callback
 * TODO: Implement Apple OAuth callback
 */
authRoutes.post("/callback/apple", async (c) => {
  return c.json({ error: "Apple OAuth not yet implemented" }, 501)
})

export default authRoutes
