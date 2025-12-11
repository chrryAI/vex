import { getUser, getGuest as getGuestDb } from "@repo/db"
import jwt from "jsonwebtoken"
import { decode } from "next-auth/jwt"
import captureException from "../../lib/captureException"
import { isOwner, OWNER_CREDITS } from "chrry/utils"
import { Context } from "hono"
import { validate } from "uuid"

/**
 * Get authenticated member from request
 * Pure function - no Next.js dependencies
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
}
/**
 * Get guest from request
 * Pure function - no Next.js dependencies
 */
export async function getGuest(
  c?: Context,
  { skipCache }: { skipCache?: boolean } = {},
) {
  try {
    // If no context provided, return undefined (for backward compatibility)
    if (!c) {
      return undefined
    }

    const authHeader = c.req.header("authorization")

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const fp = authHeader.replace("Bearer ", "")

      if (!validate(fp)) {
        return
      }

      let result = await getGuestDb({ fingerprint: fp, skipCache })

      if (!result) {
        const cookieFingerprint = c.req
          .header("cookie")
          ?.split(";")
          .find((c) => c.trim().startsWith("fingerprint="))
          ?.split("=")[1]

        const headerFingerprint = c.req.header("x-fp")

        const fingerprint = cookieFingerprint || headerFingerprint

        if (fingerprint) {
          let result = await getGuestDb({ fingerprint })
          return result || undefined
        }
      }

      return result || undefined
    }

    return
  } catch (error) {
    console.error("Error verifying token:", error)
    return
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
