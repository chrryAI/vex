import { getGuest as getGuestDB } from "@repo/db"
import { cookies, headers } from "next/headers"
import getMember from "../getMember"
import captureException from "../../../lib/captureException"
import getApp from "../getApp"
import { isOwner, OWNER_CREDITS } from "chrry/utils"
import { validate } from "uuid"

export default async function getGuest(debug = false) {
  const member = await getMember()
  if (member) return

  try {
    const cookieStore = await cookies()
    const headersList = await headers()

    const authHeader = headersList.get("authorization")

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const fp = authHeader.replace("Bearer ", "")

      if (!validate(fp)) {
        return
      }

      let result = await getGuestDB({ fingerprint: fp })

      if (!result) {
        const fingerprint =
          cookieStore.get("fingerprint")?.value || headersList.get("x-fp")!

        if (fingerprint) {
          let result = await getGuestDB({ fingerprint })
          return result || undefined
        }
      }

      return result || undefined
    }

    return
  } catch (error) {
    captureException(error)
    console.error("Error verifying token:", error)
    return
  }
}
