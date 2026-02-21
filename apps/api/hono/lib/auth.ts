import { FRONTEND_URL } from "@chrryai/chrry/utils"
import {
  getGuest as getGuestDb,
  getUser,
  type userWithRelations,
} from "@repo/db"
import type { Context } from "hono"
import jwt from "jsonwebtoken"
import { validate } from "uuid"
import { captureException } from "../../lib/captureException"

export { getApp } from "./getApp"

// ==================== MAIN FUNCTION ====================

export async function getMember(
  c: Context,
  options: {
    byEmail?: string
    full?: boolean
    skipCache?: boolean
  } = {},
) {
  const { byEmail } = options

  const request = c.req.raw

  const appIdHeader = request.headers.get("x-app-id")
  const appIdParam = c.req.query("appId")

  const appId = appIdParam || appIdHeader || undefined

  const skipCache = options.skipCache || c.req.method !== "GET"
  const full = options.full || skipCache

  if (byEmail) {
    const user = await getUser({ email: byEmail, skipCache, appId })

    if (user) {
      const token = jwt.sign({ email: byEmail }, process.env.NEXTAUTH_SECRET!)

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

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "")

      // Basic JWT format validation
      if (token.split(".").length !== 3) {
        const fp = authHeader.replace("Bearer ", "")

        const result = await getUser({
          apiKey: fp,
          skipCache: skipCache,
          appId,
        })
        if (result) {
          return {
            ...result,
            token,
            password: full ? result.password : null,
          } as userWithRelations
        }

        return
      }

      // Verify and decode the token
      const decoded: any = jwt.verify(token, process.env.NEXTAUTH_SECRET!)
      if (decoded.email) {
        const user = await getUser({
          email: decoded.email,
          skipCache: skipCache,
          appId,
        })

        if (user) {
          return {
            ...user,
            token,
            password: full ? user.password : null,
          } as userWithRelations
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
  const request = c?.req.raw
  const appIdHeader = request?.headers.get("x-app-id")
  const appIdParam = c?.req.query("appId")

  const appId = appIdParam || appIdHeader || undefined

  try {
    // If no context provided, return undefined (for backward compatibility)
    if (!c) {
      return undefined
    }

    const authHeader = c.req.header("authorization")

    if (authHeader?.startsWith("Bearer ")) {
      const fp = authHeader.replace("Bearer ", "")

      if (!validate(fp)) {
        return
      }

      const result = await getGuestDb({ fingerprint: fp, skipCache, appId })

      if (!result) {
        const cookieFingerprint = c.req
          .header("cookie")
          ?.split(";")
          .find((c) => c.trim().startsWith("fingerprint="))
          ?.split("=")[1]

        const headerFingerprint = c.req.header("x-fp")

        const fingerprint = cookieFingerprint || headerFingerprint

        if (fingerprint) {
          const result = await getGuestDb({ fingerprint, skipCache, appId })

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
export function getChrryUrl(request: Request): string | undefined {
  try {
    const chrryUrlHeader = request.headers.get("x-chrry-url")
    return chrryUrlHeader || FRONTEND_URL
  } catch (error) {
    console.error("Error getting chrryUrl:", error)
    return undefined
  }
}
