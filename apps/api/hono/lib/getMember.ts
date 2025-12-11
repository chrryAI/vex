import { Context } from "hono"
import { getUser } from "@repo/db"
import jwt from "jsonwebtoken"
import captureException from "../../lib/captureException"
import { auth } from "../lib/better-auth"

/**
 * Hono-compatible getMember function
 * Extracts user from Authorization header or Better Auth session
 */
export async function getMember(
  c: Context,
  options: {
    byEmail?: string
    full?: boolean
    skipCache?: boolean
  } = {},
) {
  const { byEmail, full, skipCache } = options

  if (byEmail) {
    const token = jwt.sign({ email: byEmail }, process.env.NEXTAUTH_SECRET!)
    let user = await getUser({ email: byEmail, skipCache: skipCache || full })

    if (user) {
      return {
        ...user,
        token,
        sessionCookie: undefined,
        password: full ? user.password : null,
      }
    }
    return
  }

  try {
    // Check for token in Authorization header
    const authHeader = c.req.header("authorization")

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "")

      // Basic JWT format validation
      if (token.split(".").length !== 3) {
        const fp = authHeader.replace("Bearer ", "")

        let result = await getUser({ apiKey: fp, skipCache: skipCache || full })
        if (result) {
          return {
            ...result,
            token,
            password: full ? result.password : null,
          }
        }

        return
      }

      // Verify and decode the token
      const decoded: any = jwt.verify(token, process.env.NEXTAUTH_SECRET!)
      if (decoded.email) {
        const user = await getUser({
          email: decoded.email,
          skipCache: skipCache || full,
        })

        if (user) {
          return {
            ...user,
            token,
            password: full ? user.password : null,
          }
        }
        return
      }
    }
  } catch (error) {
    captureException(error)
    console.error("Error verifying token:", error)
  }

  // Try Better Auth session
  try {
    const cookieHeader = c.req.header("cookie") || ""

    // Create a Request object for Better Auth
    const request = new Request("http://localhost:3001/api/auth/session", {
      headers: {
        cookie: cookieHeader,
      },
    })

    // Get session from Better Auth
    const session = await auth.api.getSession({ headers: request.headers })

    if (session?.user?.email) {
      const user = await getUser({
        email: session.user.email,
        skipCache: skipCache || full,
      })

      if (user) {
        // Generate token
        const token = jwt.sign(
          { email: session.user.email, sub: user.id },
          process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET!,
        )

        return {
          ...user,
          token,
          password: full ? user.password : null,
        }
      }
    }
  } catch (error) {
    console.error("Error getting Better Auth session:", error)
  }

  // If no session, return null
  return
}
