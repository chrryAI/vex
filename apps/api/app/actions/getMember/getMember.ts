"use server"

import { getUser, app } from "@repo/db"
import { headers } from "next/headers"
import jwt from "jsonwebtoken"
import captureException from "../../../lib/captureException"
import getApp from "../getApp"
import { isOwner, OWNER_CREDITS } from "chrry/utils"

export default async function getMember({
  byEmail,
  full,
  skipCache,
}: {
  byEmail?: string
  full?: boolean
  skipCache?: boolean
} = {}) {
  if (byEmail) {
    const token = jwt.sign({ email: byEmail }, process.env.NEXTAUTH_SECRET!)
    let user = await getUser({ email: byEmail, skipCache: skipCache || full })

    if (user) {
      return {
        ...user,
        token,
        sessionCookie: undefined, // No session cookie when fetching by email
        password: full ? user.password : null,
      }
    }
    return
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

  // If no session, return null
  return
}
