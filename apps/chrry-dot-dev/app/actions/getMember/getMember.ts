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
      // Check if user owns the current app for infinite credits
      const app = await getApp({ member: user })

      if (app) {
        const isAppOwner = isOwner(app, { userId: user.id })

        // Override creditsLeft if user owns the app
        if (isAppOwner) {
          user.creditsLeft = OWNER_CREDITS
        }
      }

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
      // Check if user owns the current app for infinite credits
      const app = await getApp({ member: user })

      if (app) {
        const isAppOwner = isOwner(app, { userId: user.id })

        // Override creditsLeft if user owns the app
        if (isAppOwner) {
          user.creditsLeft = OWNER_CREDITS
        }
      }

      return {
        ...user,
        token: session.token,
        password: exposePassword ? user.password : null,
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
