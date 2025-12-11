import { Context } from "hono"
import { getGuest as getGuestDB } from "@repo/db"
import { validate } from "uuid"

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

      let result = await getGuestDB({ fingerprint: fp, skipCache })

      if (!result) {
        const cookieFingerprint = c.req
          .header("cookie")
          ?.split(";")
          .find((c) => c.trim().startsWith("fingerprint="))
          ?.split("=")[1]

        const headerFingerprint = c.req.header("x-fp")

        const fingerprint = cookieFingerprint || headerFingerprint

        if (fingerprint) {
          let result = await getGuestDB({ fingerprint })
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
