"use server"

import { getUser, app } from "@repo/db"
import { getServerSession } from "next-auth"
import { headers } from "next/headers"
import jwt from "jsonwebtoken"
import { Session } from "next-auth"
import captureException from "../../../lib/captureException"
import getApp from "../getApp"
import { isOwner, OWNER_CREDITS } from "chrry/utils"
import { authOptions } from "../../api/auth/[...nextauth]/options"

export default async function getMember(
  exposePassword = false,
  byEmail?: string,
) {
  if (byEmail) {
    const token = jwt.sign({ email: byEmail }, process.env.NEXTAUTH_SECRET!)
    let user = await getUser({ email: byEmail })

    if (user) {
      return {
        ...user,
        token,
        password: exposePassword ? user.password : null,
      }
    }
    return
  }

  const session = (await getServerSession(authOptions as any)) as Session
  if (session?.user?.email) {
    let user = await getUser({ email: session.user.email })
    if (user) {
      // Generate token if not present in session (fallback)
      const token =
        session.token ||
        jwt.sign(
          { email: session.user.email, sub: user.id },
          process.env.NEXTAUTH_SECRET!,
        )

      return {
        ...user,
        token,
        password: exposePassword ? user.password : null,
      }
    }

    return
  }

  // Fallback: Check if session cookie exists (indicates user is authenticated)
  // Even if getServerSession() failed, the cookie presence means they're logged in
  try {
    const headersList = await headers()
    const cookieHeader = headersList.get("cookie")

    if (cookieHeader) {
      // Look for __Secure-next-auth.session-token or next-auth.session-token
      const hasSessionCookie =
        cookieHeader.includes("__Secure-next-auth.session-token=") ||
        cookieHeader.includes("next-auth.session-token=")

      if (hasSessionCookie) {
        console.log(
          "⚠️ Session cookie exists but getServerSession() returned null",
        )
        console.log("This might indicate a session callback issue")
        // Could retry getServerSession() here or log for debugging
      }
    }
  } catch (error) {
    console.error("Error checking session cookie:", error)
  }

  try {
    // Check for token in Authorization header
    const headersList = await headers()
    const authHeader = headersList.get("authorization")

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "")

      // Basic JWT format validation
      if (token.split(".").length !== 3) {
        const fp = authHeader.replace("Bearer ", "")

        let result = await getUser({ apiKey: fp })
        if (result) {
          return {
            ...result,
            token,
            password: exposePassword ? result.password : null,
          }
        }

        return
      }

      // Verify and decode the token
      const decoded: any = jwt.verify(token, process.env.NEXTAUTH_SECRET!)
      if (decoded.email) {
        const user = await getUser({ email: decoded.email })

        if (user) {
          return {
            ...user,
            token,
            password: exposePassword ? user.password : null,
          }
        }
        return
      }
    }
  } catch (error) {
    captureException(error)
    console.error("Error verifying token:", error)
  }

  // If no session, try to get user from Authorization header token

  // If neither method worked, return null
  return
}
