import { NextResponse } from "next/server"
import getMemberAction from "../../actions/getMember"
import {
  createGuest,
  deleteThread,
  getCreditTransactions,
  getCreditUsage,
  getGuest,
  getThreads,
  migrateUser,
  updateGuest,
  updateUser,
  user,
  guest,
  upsertDevice,
  getApp,
  getAiAgents,
  getAiAgent,
  getStores,
  getStore,
  TEST_MEMBER_FINGERPRINTS,
  TEST_GUEST_FINGERPRINTS,
  TEST_MEMBER_EMAILS,
} from "@repo/db"
import * as lib from "../../../lib"

import { validate as validateUuid } from "uuid"
import { UAParser } from "ua-parser-js"
import arcjet, { detectBot } from "@arcjet/next"

import { isDevelopment, VERSION, getSlugFromPathname } from "chrry/utils"
import { checkRateLimit } from "../../../lib/rateLimiting"
import { v4 as uuidv4 } from "uuid"
import {
  GUEST_CREDITS_PER_MONTH,
  MEMBER_CREDITS_PER_MONTH,
  PLUS_CREDITS_PER_MONTH,
  PRO_CREDITS_PER_MONTH,
} from "@repo/db/src/schema"

import captureException from "../../../lib/captureException"
import getGuestAction from "../../actions/getGuest"
import { cookies } from "next/headers"
import { appWithStore } from "chrry/types"
import { excludedSlugRoutes, getAppAndStoreSlugs } from "chrry/utils/url"
import { locales } from "chrry/locales"
import { getSiteConfig } from "chrry/utils/siteConfig"
import getAppAction from "../../actions/getApp"
import getChrryUrl from "../../actions/getChrryUrl"

const getGuestDb = ({
  email,
  fingerprint,
  id,
}: {
  email?: string
  fingerprint?: string
  id?: string
}) => getGuest({ skipCache: true, email, fingerprint, id })

const hasThreadNotification = lib.hasThreadNotification

const isNewBillingPeriod = (subscribedOn: Date) => {
  const subscriptionDate = new Date(subscribedOn)
  const currentDate = new Date()

  return (
    currentDate.getFullYear() > subscriptionDate.getFullYear() ||
    (currentDate.getFullYear() === subscriptionDate.getFullYear() &&
      currentDate.getMonth() > subscriptionDate.getMonth())
  )
}

const setFingerprintCookie = (
  response: NextResponse,
  fingerprint: string,
  domain?: string,
  isExtension?: boolean,
) => {
  // Extensions manage their own storage - don't set web cookies
  if (isExtension) return response

  response.cookies.set("fingerprint", fingerprint, {
    httpOnly: true, // 👈 Make it read-only from client-side JS
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
    domain: domain || undefined,
  })
  return response
}

const setDeviceIdCookie = (
  response: NextResponse,
  deviceId: string,
  domain?: string,
  isExtension?: boolean,
) => {
  // Extensions manage their own storage - don't set web cookies
  if (isExtension) return response

  response.cookies.set("deviceId", deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
    domain: domain || undefined,
  })
  return response
}

function parseUserAgent(uaString: string) {
  const parser = new UAParser(uaString)
  return {
    browser: parser.getBrowser(),
    os: parser.getOS(),
    device: parser.getDevice(),
  }
}

const isValidFingerprint = (fp: string | null): boolean => {
  if (!fp) {
    return false
  }
  if (validateUuid(fp)) {
    return true
  }
  // Basic validation - adjust these rules as needed
  const minLength = 10
  const maxLength = 64
  const validChars = /^[a-zA-Z0-9_-]+$/

  return fp.length >= minLength && fp.length <= maxLength && validChars.test(fp)
}

// Initialize Arcjet with bot detection
const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    detectBot({
      // mode: "DRY_RUN", // Temporarily set to DRY_RUN to allow Google verification
      allow: [
        "CATEGORY:SEARCH_ENGINE", // Allow Google, Bing, etc.
        "CATEGORY:PREVIEW", // Allow link preview bots (Twitter, Slack, etc.)
        "CATEGORY:MONITOR", // Allow uptime monitors
      ],
    }),
  ],
})

export async function GET(request: Request) {
  // Arcjet bot detection - block bots from creating guest accounts
  if (!isDevelopment) {
    const decision = await aj.protect(request)

    if (decision.isDenied()) {
      console.log("🤖 Bot detected:", {
        reason: decision.reason,
        userAgent: request.headers.get("user-agent"),
        ip: decision.ip,
      })
      return NextResponse.json(
        { error: "Bot detected", reason: decision.reason },
        { status: 403 },
      )
    }

    // Log allowed bots for debugging
    if (decision.isAllowed() && decision.reason.isBot?.()) {
      console.log("✅ Allowed bot:", {
        userAgent: request.headers.get("user-agent"),
      })
    }
  }

  const versions = {
    webVersion: VERSION,
    firefoxVersion: "1.1.47",
    chromeVersion: "1.1.47",
  }

  const getMember = () => getMemberAction({ full: true, skipCache: true })

  let member = await getMember()
  const guest = !member ? await getGuestAction({ skipCache: true }) : undefined
  const { success } = await checkRateLimit(request, { member, guest })

  const url = new URL(request.url)

  // Detect domain for cookies from chrryUrl (for extensions), Referer, or Origin header
  const chrryUrl = await getChrryUrl(request)
  const referer =
    request.headers.get("referer") || request.headers.get("origin")
  let cookieDomain: string | undefined = undefined

  // Priority: chrryUrl (for extensions) > referer (for web)
  const sourceUrl = chrryUrl ? chrryUrl : referer

  if (sourceUrl && process.env.NODE_ENV === "production") {
    try {
      const parsedUrl = new URL(sourceUrl)
      const hostname = parsedUrl.hostname

      // Use exact hostname match or subdomain check (not .includes())
      if (hostname === "vex.chrry.ai" || hostname.endsWith(".vex.chrry.ai")) {
        cookieDomain = ".chrry.ai" // vex.chrry.ai shares cookies with chrry.ai
      } else if (hostname === "chrry.ai" || hostname.endsWith(".chrry.ai")) {
        cookieDomain = ".chrry.ai"
      } else if (
        hostname === "askvex.com" ||
        hostname.endsWith(".askvex.com")
      ) {
        cookieDomain = ".askvex.com"
      } else if (hostname === "chrry.dev" || hostname.endsWith(".chrry.dev")) {
        cookieDomain = ".chrry.dev"
      } else if (
        hostname === "focus.chrry.ai" ||
        hostname.endsWith(".focus.chrry.ai")
      ) {
        cookieDomain = ".chrry.ai" // focus.chrry.ai shares cookies with chrry.ai
      }
    } catch {
      // Invalid URL, leave cookieDomain undefined
    }
  }
  const locale = url.searchParams.get("locale") || "en"
  const appType = url.searchParams.get("app")
  const isExtension = appType === "extension"
  const headers = request.headers

  const appId = url.searchParams.get("appId") || undefined
  // If no slug param, use store's default app directly
  // Otherwise fetch by slug
  const app = await getAppAction({
    request,
    appId: appId && validateUuid(appId) ? appId : undefined,
  })

  try {
    if (member?.id) {
      const threads = await getThreads({
        pageSize: 100,
        isIncognito: true,
        userId: member.id,
        publicBookmarks: true,
      })

      await Promise.all(
        threads.threads.map((thread) => {
          deleteThread({ id: thread.id })
        }),
      )
    }

    const url = new URL(request.url)

    const agentNameParam = url.searchParams.get("agent")

    const aiAgent = agentNameParam
      ? await getAiAgent({
          name: agentNameParam,
        })
      : null

    const fingerPrintUrl = url.searchParams.get("fp")

    const appParam = url.searchParams.get("app")

    const deviceIdHeader = headers.get("x-device-id")
    const fingerprintHeader = headers.get("x-fp")
    const env =
      member?.role === "admin"
        ? headers.get("x-env")
        : isDevelopment
          ? "development"
          : "production"

    const deviceIdUrl = url.searchParams.get("deviceId")

    const deviceIdCookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim()) // Trim all cookie parts
      .find((c) => c.startsWith("deviceId=")) // Remove space after ;
      ?.split("=")[1]

    const deviceId = deviceIdUrl || deviceIdCookie || deviceIdHeader

    let fingerPrintCookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim()) // Trim all cookie parts
      .find((c) => c.startsWith("fingerprint=")) // Find the fingerprint cookie
      ?.substring("fingerprint=".length) // Get everything after "fingerprint="
      ?.trim() // Trim the value itself

    let fingerprint =
      fingerprintHeader ||
      fingerPrintUrl ||
      fingerPrintCookie ||
      guest?.fingerprint

    const { getIp } = lib

    // Use UAParser for detailed device detection (more accurate than lib functions)
    const userAgent = request.headers.get("user-agent") || "unknown"
    const deviceInfo = parseUserAgent(userAgent)

    const device = deviceInfo.device
    const os = deviceInfo.os
    const browser = deviceInfo.browser

    fingerprint =
      fingerprint && validateUuid(fingerprint) ? fingerprint : uuidv4()

    const appVersion = url.searchParams.get("appVersion")
    const ip = getIp(request)
    const gift = url.searchParams.get("gift")

    if (!ip) {
      return NextResponse.json({ error: "IP address not found" })
    }

    if (!fingerprint) {
      return NextResponse.json({ error: "Missing fingerprint" })
    }

    const aiAgents = await getAiAgents()

    async function updateDevice({
      member,
      guest,
    }: {
      member?: user
      guest?: guest
    }) {
      if (!member && !guest) {
        return
      }

      if (!deviceId) {
        return
      }
      try {
        const userAgent = request.headers.get("user-agent") || "unknown"
        const deviceInfo = parseUserAgent(userAgent)

        // Enhanced app/device detection
        const ua = userAgent.toLowerCase()
        let appIdentifier = "web"
        let deviceType = deviceInfo.device.type || appParam || "desktop"

        // Check for ios
        if (
          ua.includes("iphone") ||
          ua.includes("ipad") ||
          ua.includes("ipod")
        ) {
          if (ua.includes("safari") && !ua.includes("chrome")) {
            appIdentifier = "safari"
          }
          deviceType = appParam === "pwa" ? "pwa" : "mobile"
        }
        // Check for macOS Safari
        else if (
          ua.includes("macintosh") &&
          ua.includes("safari") &&
          !ua.includes("chrome")
        ) {
          appIdentifier = "safari"
        } else if (ua.includes("firefox") && !ua.includes("chrome")) {
          appIdentifier = "firefox"
        } else if (ua.includes("chrome")) {
          appIdentifier = "chrome"
        }
        // Check for Android
        else if (ua.includes("android")) {
          if (ua.includes("chrome")) {
            appIdentifier = "chrome"
          } else if (ua.includes("firefox")) {
            appIdentifier = "firefox"
          } else if (ua.includes("samsungbrowser")) {
            appIdentifier = "samsung-internet"
          } else {
            appIdentifier = "android-browser"
          }
          deviceType = "mobile"
        }
        // Use provided app name if available
        else if (appParam) {
          appIdentifier = appParam.toLowerCase()
        }

        const device = await upsertDevice({
          fingerprint: deviceId,
          type: deviceType,
          app: appIdentifier,
          browserVersion: deviceInfo.browser?.version || "unknown",
          browser: deviceInfo.browser?.name || "unknown",
          os: deviceInfo.os?.name || "unknown",
          osVersion: deviceInfo.os?.version || "unknown",
          appVersion,
          timezone: headers.get("x-timezone") || undefined,
          screenWidth: Number(headers.get("x-screen-width")) || undefined,
          screenHeight: Number(headers.get("x-screen-height")) || undefined,
          language: headers.get("accept-language")?.split(",")[0],
          ...(member?.id ? { userId: member.id } : { guestId: guest?.id }),
        })

        return device

        // Continue with your existing session logic...
      } catch (error) {
        captureException(error)
        // Handle error appropriately
      }
    }

    if (member) {
      const needsRenewal =
        member.subscribedOn && isNewBillingPeriod(member.subscribedOn)

      if (needsRenewal) {
        let creditsToGive: number

        if (member.subscription) {
          // Active subscription - use subscription plan credits
          creditsToGive =
            member.subscription.plan === "pro"
              ? PRO_CREDITS_PER_MONTH
              : PLUS_CREDITS_PER_MONTH
        } else {
          // No active subscription but had one before - use member credits
          creditsToGive = MEMBER_CREDITS_PER_MONTH
        }

        // For subscribers: reset to subscription credits + keep remaining purchased credits
        if (member.subscription) {
          const allPurchases = await getCreditTransactions({
            userId: member.id,
            type: "purchase",
          })

          const totalPurchased = allPurchases.reduce(
            (total, purchase) => total + purchase.amount,
            0,
          )

          // Get credit usage since first purchase to calculate remaining purchased credits
          const firstPurchase = allPurchases[allPurchases.length - 1] // oldest first due to desc order
          const usageFromDate = firstPurchase
            ? firstPurchase.createdOn
            : new Date()

          const creditUsageRecords = await getCreditUsage({
            userId: member.id,
            fromDate: usageFromDate,
          })

          const totalUsed = creditUsageRecords.reduce(
            (total, usage) => total + usage.creditCost,
            0,
          )

          // Calculate remaining purchased credits (can't be negative)
          const remainingPurchased = Math.max(0, totalPurchased - totalUsed)

          await updateUser({
            ...member,
            credits: creditsToGive + remainingPurchased,
            subscribedOn: new Date(),
          })
        } else {
          // Non-subscribers: just reset to member credits
          await updateUser({
            ...member,
            credits: creditsToGive,
            subscribedOn: new Date(),
          })
        }

        member = await getMember()
      } else if (member.creditsLeft === 0) {
        await updateUser({
          ...member,
          credits:
            member.subscription?.plan === "pro"
              ? PRO_CREDITS_PER_MONTH
              : member.subscription?.plan === "plus"
                ? PLUS_CREDITS_PER_MONTH
                : MEMBER_CREDITS_PER_MONTH,
        })

        member = await getMember()
      }

      if (!member) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const device = await updateDevice({ member })

      const threads = await getThreads({
        pageSize: 10,
        userId: member.id,
      })

      const collaborationThreads = await getThreads({
        collaborationStatus: ["active", "pending"],
        userId: member.id,
        pageSize: 10,
      })

      const hasNotifications = [
        ...threads.threads,
        ...collaborationThreads.threads,
      ].some((thread) =>
        hasThreadNotification({
          thread,
          user: member,
        }),
      )

      const guestFingerprint = await getGuestDb({ fingerprint })

      let migratedFromGuest = false
      if (!member.migratedFromGuest && appType && appType !== "web") {
        const toMigrate = member.email
          ? (await getGuestDb({ email: member.email })) || guestFingerprint
          : guestFingerprint

        if (toMigrate && !toMigrate?.migratedToUser) {
          await migrateUser({
            user: member,
            guest: toMigrate,
          })

          member.migratedFromGuest = true
          migratedFromGuest = true
          member = await getMember()
        }
      }

      if (!member) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const protectedFPs = TEST_MEMBER_FINGERPRINTS.concat(
        TEST_GUEST_FINGERPRINTS,
      )

      await updateUser({
        ...member,
        fingerprint: protectedFPs.includes(fingerprint)
          ? TEST_MEMBER_EMAILS.includes(member.email)
            ? fingerprint
            : member.fingerprint && protectedFPs.includes(member.fingerprint)
              ? uuidv4()
              : member.fingerprint
          : fingerprint,
        // ip,
        timezone: device?.timezone ?? member.timezone,
      })

      const response = setFingerprintCookie(
        NextResponse.json({
          locale,
          TEST_MEMBER_FINGERPRINTS,
          TEST_GUEST_FINGERPRINTS,
          TEST_MEMBER_EMAILS,
          device,
          os,
          browser,
          aiAgent,
          versions,
          guest: null,
          user: {
            ...member,
            password: null,
          },
          aiAgents,
          fingerprint,
          migratedFromGuest,
          note: "This is a fake guest for bot/crawler traffic.",
          hasNotifications,
          deviceId,
          app,
          env,
        }),
        fingerprint!,
        cookieDomain,
        isExtension,
      )
      return setDeviceIdCookie(response, deviceId!, cookieDomain, isExtension)
    }

    let existingGuest = gift
      ? await getGuestDb({ fingerprint: gift })
      : await getGuestDb({ fingerprint })

    if (gift && !existingGuest?.email) {
      existingGuest = await getGuestDb({ fingerprint })
    }

    if (existingGuest?.id) {
      const threads = await getThreads({
        pageSize: 100,
        isIncognito: true,
        guestId: existingGuest.id,
      })

      await Promise.all(
        threads.threads.map((thread) => {
          deleteThread({ id: thread.id })
        }),
      )
    }

    if (existingGuest) {
      const needsRenewal =
        existingGuest.subscribedOn &&
        isNewBillingPeriod(existingGuest.subscribedOn)

      if (needsRenewal) {
        let creditsToGive: number

        if (existingGuest.subscription) {
          // Active subscription - use subscription plan credits
          creditsToGive =
            existingGuest.subscription.plan === "pro"
              ? PRO_CREDITS_PER_MONTH
              : PLUS_CREDITS_PER_MONTH
        } else {
          // No active subscription but had one before - use guest credits
          creditsToGive = GUEST_CREDITS_PER_MONTH
        }

        // For subscribers: reset to subscription credits + keep remaining purchased credits
        if (existingGuest.subscription) {
          const allPurchases = await getCreditTransactions({
            guestId: existingGuest.id,
            type: "purchase",
          })

          const totalPurchased = allPurchases.reduce(
            (total, purchase) => total + purchase.amount,
            0,
          )

          // Get credit usage since first purchase to calculate remaining purchased credits
          const firstPurchase = allPurchases[allPurchases.length - 1] // oldest first due to desc order
          const usageFromDate = firstPurchase
            ? firstPurchase.createdOn
            : new Date()

          const creditUsageRecords = await getCreditUsage({
            guestId: existingGuest.id,
            fromDate: usageFromDate,
          })

          const totalUsed = creditUsageRecords.reduce(
            (total, usage) => total + usage.creditCost,
            0,
          )

          // Calculate remaining purchased credits (can't be negative)
          const remainingPurchased = Math.max(0, totalPurchased - totalUsed)

          await updateGuest({
            ...existingGuest,
            credits: creditsToGive + remainingPurchased,
            subscribedOn: new Date(),
          })
        } else {
          // Non-subscribers: just reset to guest credits
          await updateGuest({
            ...existingGuest,
            credits: creditsToGive,
            subscribedOn: new Date(),
          })
        }

        existingGuest = await getGuestDb({ id: existingGuest.id })
      } else if (existingGuest.creditsLeft === 0) {
        await updateGuest({
          ...existingGuest,
          credits:
            existingGuest.subscription?.plan === "pro"
              ? PRO_CREDITS_PER_MONTH
              : existingGuest.subscription?.plan === "plus"
                ? PLUS_CREDITS_PER_MONTH
                : GUEST_CREDITS_PER_MONTH,
        })
        existingGuest = await getGuestDb({ id: existingGuest.id })
      }

      if (!existingGuest) {
        return NextResponse.json({ error: "Guest not found" }, { status: 404 })
      }

      const device = await updateDevice({ guest: existingGuest })

      const updatedGuest = await updateGuest({
        ...existingGuest,
        activeOn: new Date(),
        timezone: device?.timezone || null,
        fingerprint: gift || fingerprint,
      })

      if (!updatedGuest) {
        return NextResponse.json({ error: "Failed to update guest" })
      }

      const threads = await getThreads({
        pageSize: 10,
        guestId: updatedGuest.id,
      })

      const collaborationThreads = await getThreads({
        collaborationStatus: ["active", "pending"],
        guestId: updatedGuest.id,
        pageSize: 10,
      })

      const hasNotifications = [
        ...threads.threads,
        ...collaborationThreads.threads,
      ].some((thread) =>
        hasThreadNotification({
          thread,
          guest: updatedGuest,
        }),
      )

      const response = setFingerprintCookie(
        NextResponse.json({
          locale,
          TEST_MEMBER_FINGERPRINTS,
          TEST_GUEST_FINGERPRINTS,
          TEST_MEMBER_EMAILS,
          device,
          os,
          browser,
          app,
          aiAgent,
          versions,
          guest: {
            ...(await getGuestDb({ id: updatedGuest.id })),
          },
          user: null,
          aiAgents,
          fingerprint,
          hasNotifications,
          deviceId,
          env,
        }),
        fingerprint!,
        cookieDomain,
        isExtension,
      )

      return setDeviceIdCookie(response, deviceId!, cookieDomain, isExtension)
    }

    const newGuest = await createGuest({
      ip: ip.toString(),
      createdOn: new Date(),
      updatedOn: new Date(),
      activeOn: new Date(),
      fingerprint,
    })

    if (newGuest) {
      const device = await updateDevice({ guest: newGuest })

      if (device) {
        await updateGuest({
          ...newGuest,
          timezone: device.timezone,
          fingerprint,
        })
      }
    } else {
      return NextResponse.json({ error: "Failed to create guest" })
    }

    const response = setFingerprintCookie(
      NextResponse.json({
        locale,
        TEST_MEMBER_FINGERPRINTS,
        TEST_GUEST_FINGERPRINTS,
        TEST_MEMBER_EMAILS,
        device,
        os,
        browser,
        aiAgent,
        app,
        versions,
        aiAgents,
        guest: {
          ...(await getGuestDb({ id: newGuest.id })),
        },
        user: null,
        deviceId,
        fingerprint,
        env,
      }),
      fingerprint!,
      cookieDomain,
      isExtension,
    )
    return setDeviceIdCookie(response, deviceId!, cookieDomain, isExtension)
  } catch (error) {
    console.error("Error handling guest:", error)
    return NextResponse.json({ error: "Internal server error" })
  }
}
