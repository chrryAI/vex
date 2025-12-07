import { cookies, headers } from "next/headers"
import { v4 as uuidv4 } from "uuid"
import { session } from "chrry/types"
import { API_URL } from "chrry/utils"

interface GetSessionOptions {
  appSlug?: string | null
  agentName?: string | null
  fingerprint?: string
  deviceId?: string
  currentMemberToken?: string
  appId?: string | null
  routeType?: string | null
  env?: string
}

export async function getSession(
  options: GetSessionOptions = {},
): Promise<session | null> {
  const headersList = await headers()
  const cookieStore = await cookies()

  const {
    appSlug,
    agentName,
    fingerprint = cookieStore.get("fingerprint")?.value ||
      headersList.get("x-fp") ||
      uuidv4(),
    deviceId = cookieStore.get("deviceId")?.value ||
      headersList.get("x-device-id") ||
      uuidv4(),
    currentMemberToken,
    appId,
    routeType,
    env = cookieStore.get("env")?.value || "production",
  } = options

  try {
    const queryParams = new URLSearchParams()
    if (appSlug) queryParams.append("appSlug", appSlug)
    if (agentName) queryParams.append("agent", agentName)

    const url = `${API_URL}/session${queryParams.toString() ? `?${queryParams.toString()}` : ""}`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-real-ip":
          headersList.get("x-forwarded-for") ||
          headersList.get("x-real-ip") ||
          "127.0.0.1",
        "user-agent": headersList.get("user-agent") || "Vex/1.0",
        authorization: `Bearer ${currentMemberToken || fingerprint}`,
        "x-fp": fingerprint || "",
        "x-device-id": deviceId || "",
        "x-app-id": appId || "",
        "x-app-slug": appSlug || "",
        "x-route-type": routeType || "",
        "x-env": env || "production",
      },
    })

    if (response.ok) {
      return await response.json()
    }

    return null
  } catch (error) {
    console.error("Failed to fetch session:", error)
    return null
  }
}
