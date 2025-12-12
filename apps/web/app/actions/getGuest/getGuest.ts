import { getGuest as getGuestDB } from "@repo/db"
import { cookies, headers } from "next/headers"
import captureException from "../../../lib/captureException"
import { validate } from "uuid"

export default async function getGuest({
  skipCache,
}: { skipCache?: boolean } = {}) {
  try {
    const cookieStore = await cookies()
    const headersList = await headers()

    const authHeader = headersList.get("authorization")

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const fp = authHeader.replace("Bearer ", "")

      if (!validate(fp)) {
        return
      }

      let result = await getGuestDB({ fingerprint: fp, skipCache })

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
