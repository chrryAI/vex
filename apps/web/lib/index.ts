import { subscription, user } from "@repo/db"
import { headers } from "next/headers"
export const DEV_IP = "192.168.2.27"
export const getIp = (request: Request) => {
  const isDev = process.env.NODE_ENV !== "production"
  const ip = isDev
    ? DEV_IP
    : request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      (request.headers.get("x-forwarded-for") || "")?.split(",")?.[0]?.trim()

  return ip
}

export const isCI = process.env.NEXT_PUBLIC_CI || process.env.CI

export const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_NODE_ENV === "production"

export const isDevelopment = !isProduction

export async function getDevice() {
  const headersList = await headers()

  const userAgent = headersList.get("user-agent")

  const isMobile =
    /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(
      userAgent || "",
    )

  return isMobile ? "mobile" : "desktop"
} // Add more device checks as needed for different devices
export async function getOS() {
  const headersList = await headers()

  let os = "unknown"
  let userAgent = headersList.get("user-agent") || ""

  if (!userAgent) {
    return os
  }

  userAgent = userAgent.toLowerCase()

  // Check iOS first (before Mac, since iPad can report as Mac)
  if (
    userAgent.indexOf("iphone") > -1 ||
    userAgent.indexOf("ipad") > -1 ||
    userAgent.indexOf("ipod") > -1
  ) {
    os = "ios"
  } else if (userAgent.indexOf("android") > -1) {
    os = "android"
  } else if (userAgent.indexOf("win") > -1) {
    os = "windows"
  } else if (userAgent.indexOf("mac") > -1) {
    os = "macos" // lowercase to match PlatformProvider
  } else if (userAgent.indexOf("x11") > -1 || userAgent.indexOf("linux") > -1) {
    os = "linux"
  }

  return os
}

export async function getBrowser() {
  const headersList = await headers()

  let browser = "unknown"
  const userAgent = headersList.get("user-agent") || ""

  if (userAgent.indexOf("Chrome") > -1) {
    browser = "chrome"
  } else if (userAgent.indexOf("Firefox") > -1) {
    browser = "firefox"
  } // Add more browser checks as needed
  else if (userAgent.indexOf("Safari") > -1) {
    browser = "safari"
  }

  return browser
}

export const getHourlyLimit = (
  member?: user & { subscription?: subscription },
) => {
  if (member?.subscription) {
    return 100
  } else if (member) {
    return 30
  } else {
    return 10
  }
}
export const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET
