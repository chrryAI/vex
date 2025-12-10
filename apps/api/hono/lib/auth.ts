import { getUser, getGuest as getGuestDb, app } from "@repo/db"
import jwt from "jsonwebtoken"
import { decode } from "next-auth/jwt"
import captureException from "../../lib/captureException"
import { isOwner, OWNER_CREDITS } from "chrry/utils"

/**
 * Get authenticated member from request
 * Pure function - no Next.js dependencies
 */
export async function getMember(
  request: Request,
  options: {
    byEmail?: string
    full?: boolean
    skipCache?: boolean
  } = {},
) {
  const { byEmail, full, skipCache } = options

  // If fetching by email directly
  if (byEmail) {
    const token = jwt.sign({ email: byEmail }, process.env.NEXTAUTH_SECRET!)
    const user = await getUser({ email: byEmail, skipCache: skipCache || full })

    if (user) {
      return {
        ...user,
        token,
        sessionCookie: undefined,
        password: full ? user.password : null,
      }
    }
    return null
  }

  try {
    // Check for token in Authorization header
    const authHeader = request.headers.get("authorization")

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "")

      // Basic JWT format validation
      if (token.split(".").length !== 3) {
        const fp = authHeader.replace("Bearer ", "")

        const result = await getUser({
          apiKey: fp,
          skipCache: skipCache || full,
        })
        if (result) {
          return {
            ...result,
            token,
            password: full ? result.password : null,
          }
        }

        return null
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
        return null
      }
    }
  } catch (error) {
    captureException(error)
    console.error("Error verifying token:", error)
  }

  // Try to decode session cookie directly
  let sessionCookie: string | undefined
  let decodedToken: any = null

  try {
    const cookieHeader = request.headers.get("cookie")

    if (cookieHeader) {
      // Look for __Secure-next-auth.session-token or next-auth.session-token
      const sessionTokenMatch =
        cookieHeader.match(/__Secure-next-auth\.session-token=([^;]+)/) ||
        cookieHeader.match(/next-auth\.session-token=([^;]+)/)

      if (sessionTokenMatch) {
        sessionCookie = decodeURIComponent(sessionTokenMatch[1]!)
        console.log("✅ Found session cookie, attempting to decode...")

        // Try to decode the session token
        decodedToken = await decode({
          token: sessionCookie,
          secret: process.env.NEXTAUTH_SECRET!,
        })

        if (decodedToken?.email) {
          console.log("✅ Successfully decoded session token")
          const user = await getUser({
            email: decodedToken.email,
            skipCache: skipCache || full,
          })

          if (user) {
            // Generate token from decoded session
            const token = jwt.sign(
              { email: decodedToken.email, sub: user.id },
              process.env.NEXTAUTH_SECRET!,
            )

            return {
              ...user,
              token,
              sessionCookie,
              password: full ? user.password : null,
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error decoding session cookie:", error)
  }

  return null
}

/**
 * Get guest from request
 * Pure function - no Next.js dependencies
 */
export async function getGuest(
  request: Request,
  options: {
    skipCache?: boolean
  } = {},
) {
  const { skipCache } = options

  try {
    const cookieHeader = request.headers.get("cookie")

    if (!cookieHeader) {
      return null
    }

    // Extract fingerprint from cookie
    const fingerprintMatch = cookieHeader.match(/fingerprint=([^;]+)/)
    if (!fingerprintMatch?.[1]) {
      return null
    }

    const fingerprint = decodeURIComponent(fingerprintMatch[1])

    const guest = await getGuestDb({
      fingerprint,
      skipCache: skipCache || false,
    })

    return guest || null
  } catch (error) {
    captureException(error)
    console.error("Error getting guest:", error)
    return null
  }
}

/**
 * Get chrryUrl from request headers
 * Pure function - no Next.js dependencies
 */
export function getChrryUrl(request: Request): string | null {
  try {
    const chrryUrlHeader = request.headers.get("x-chrry-url")
    return chrryUrlHeader || null
  } catch (error) {
    console.error("Error getting chrryUrl:", error)
    return null
  }
}

/**
 * Get app from request
 * Pure function - no Next.js dependencies
 */
export async function getApp(
  request: Request,
  options: {
    appId?: string
  } = {},
) {
  // This is a simplified version - you may need to port the full getAppAction logic
  // For now, returning null to keep it simple
  return null
}
