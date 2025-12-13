import { Hono } from "hono"
import { getCookie, setCookie } from "hono/cookie"
import {
  getMember as getMemberAction,
  getGuest as getGuestAction,
  getChrryUrl,
  getApp as getAppAction,
} from "../lib/auth"
import {
  createGuest,
  deleteThread,
  getCreditTransactions,
  getCreditUsage,
  getGuest,
  getThreads,
  hasThreadNotifications,
  migrateUser,
  updateGuest,
  updateUser,
  user,
  guest,
  upsertDevice,
  getAiAgents,
  getAiAgent,
  TEST_MEMBER_FINGERPRINTS,
  TEST_GUEST_FINGERPRINTS,
  TEST_MEMBER_EMAILS,
} from "@repo/db"
import * as lib from "../../lib"

import { validate as validateUuid } from "uuid"
import { UAParser } from "ua-parser-js"
import arcjet, { detectBot } from "@arcjet/node"

import {
  FRONTEND_URL,
  isDevelopment,
  isE2E,
  VERSION,
} from "@chrryai/chrry/utils"
import { v4 as uuidv4 } from "uuid"
import {
  GUEST_CREDITS_PER_MONTH,
  MEMBER_CREDITS_PER_MONTH,
  PLUS_CREDITS_PER_MONTH,
  PRO_CREDITS_PER_MONTH,
} from "@repo/db/src/schema"

import captureException from "../../lib/captureException"
import { whiteLabels } from "@chrryai/chrry/utils/siteConfig"
import { checkRateLimit } from "../../lib/rateLimiting"

const getGuestDb = ({
  email,
  fingerprint,
  id,
}: {
  email?: string
  fingerprint?: string
  id?: string
}) => getGuest({ skipCache: true, email, fingerprint, id })

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
  c: any,
  fingerprint: string,
  domain?: string,
  isExtension?: boolean,
) => {
  // Extensions manage their own storage - don't set web cookies
  if (isExtension) return

  setCookie(c, "fingerprint", fingerprint, {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
    domain: domain || undefined,
  })
}

const setDeviceIdCookie = (
  c: any,
  deviceId: string,
  domain?: string,
  isExtension?: boolean,
) => {
  // Extensions manage their own storage - don't set web cookies
  if (isExtension) return

  setCookie(c, "deviceId", deviceId, {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
    domain: domain || undefined,
  })
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
      allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW", "CATEGORY:MONITOR"],
    }),
  ],
})

export const session = new Hono()

session.get("/", async (c) => {
  console.log("🔥 HONO SESSION ROUTE CALLED - This is Hono, not Next.js!")

  // Convert Hono request to standard Request for Arcjet
  const request = c.req.raw

  // Arcjet bot detection - block bots from creating guest accounts
  if (!isDevelopment && !isE2E) {
    const decision = await aj.protect(request)

    if (decision.isDenied()) {
      console.log("🤖 Bot detected:", {
        reason: decision.reason,
        userAgent: request.headers.get("user-agent"),
        ip: decision.ip,
      })
      return c.json({ error: "Bot detected", reason: decision.reason }, 403)
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

  let member = await getMemberAction(c, { full: true, skipCache: true })

  const guest = !member
    ? await getGuestAction(c, { skipCache: true })
    : undefined
  const { success } = await checkRateLimit(c.req.raw, {
    member: member ?? undefined,
    guest: guest ?? undefined,
  })

  if (!success) {
    return c.json({ error: "Too many requests" }, 429)
  }

  const url = new URL(request.url)

  // Detect domain for cookies from chrryUrl (for extensions), Referer, or Origin header
  const chrryUrl = getChrryUrl(request)
  const referer =
    request.headers.get("referer") || request.headers.get("origin")
  let cookieDomain: string | undefined = undefined

  // Priority: chrryUrl (for extensions) > referer (for web)
  const sourceUrl = chrryUrl ? chrryUrl : referer

  if (sourceUrl && !isDevelopment) {
    try {
      const parsedUrl = new URL(sourceUrl)
      const hostname = parsedUrl.hostname

      // Dynamically calculate cookie domain based on whiteLabels configuration
      for (const label of whiteLabels) {
        const labelDomain = label.domain

        // Check if hostname matches or is a subdomain of this white label
        if (hostname === labelDomain || hostname.endsWith(`.${labelDomain}`)) {
          // Extract the root domain (e.g., "chrry.ai" from "vex.chrry.ai")
          const domainParts = labelDomain.split(".")

          // If it's already a root domain (e.g., "chrry.ai"), use it with a dot prefix
          // If it's a subdomain (e.g., "vex.chrry.ai"), extract the root (chrry.ai)
          if (domainParts.length === 2) {
            // Root domain like "chrry.ai" or "chrry.dev"
            cookieDomain = `.${labelDomain}`
          } else if (domainParts.length > 2) {
            // Subdomain like "vex.chrry.ai" -> extract "chrry.ai"
            const rootDomain = domainParts.slice(-2).join(".")
            cookieDomain = `.${rootDomain}`
          }

          break // Found a match, stop searching
        }
      }
    } catch {
      // Invalid URL, leave cookieDomain undefined
    }
  }

  const locale = url.searchParams.get("locale") || "en"

  const source = url.searchParams.get("source") || "client"

  const appType = url.searchParams.get("app")
  const isExtension = appType === "extension"
  const headers = request.headers

  const appId = url.searchParams.get("appId") || undefined
  // If no slug param, use store's default app directly
  // Otherwise fetch by slug
  // const app =
  //   source !== "layout"
  //     ? await getAppAction(request, {
  //         appId: appId && validateUuid(appId) ? appId : undefined,
  //       })
  //     : undefined

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

    const deviceIdCookie = getCookie(c, "deviceId")
    const deviceId = deviceIdUrl || deviceIdCookie || deviceIdHeader

    let fingerPrintCookie = getCookie(c, "fingerprint")

    let fingerprint =
      fingerPrintUrl ||
      fingerprintHeader ||
      fingerPrintCookie ||
      guest?.fingerprint

    const { getIp } = lib

    // Use UAParser for detailed device detection (more accurate than lib functions)
    const userAgent = request.headers.get("user-agent") || "unknown"
    const deviceInfo = parseUserAgent(userAgent)

    const device = deviceInfo.device
    const os = deviceInfo.os
    const browser = deviceInfo.browser

    fingerprint = fingerprint
      ? validateUuid(fingerprint)
        ? fingerprint
        : uuidv4()
      : uuidv4()

    const appVersion = url.searchParams.get("appVersion")
    const ip = getIp(request) // Fallback for internal Docker calls
    const gift = url.searchParams.get("gift")
    console.log(`🚀 ~ session.get ~ gift:`, gift)

    // IP is now guaranteed to have a value (either real or fallback)

    if (!fingerprint) {
      return c.json({ error: "Missing fingerprint" })
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

        member = await getMemberAction(c, { full: true, skipCache: true })
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

        member = await getMemberAction(c, { full: true, skipCache: true })
      }

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401)
      }

      const device = await updateDevice({ member })

      const guestFingerprint = await getGuestDb({ fingerprint })

      let migratedFromGuest = false
      if (!member.migratedFromGuest) {
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
          member = await getMemberAction(c, {
            full: true,
            skipCache: true,
          })
        }
      }

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401)
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

      const hasNotification = await hasThreadNotifications({
        userId: member.id,
      })

      setFingerprintCookie(c, fingerprint!, cookieDomain, isExtension)
      setDeviceIdCookie(c, deviceId!, cookieDomain, isExtension)

      return c.json({
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
        hasNotification,
        note: "This is a fake guest for bot/crawler traffic.",
        deviceId,
        // app,
        env,
      })
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
        return c.json({ error: "Guest not found" }, 404)
      }

      const device = await updateDevice({ guest: existingGuest })

      const updatedGuest = await updateGuest({
        ...existingGuest,
        activeOn: new Date(),
        timezone: device?.timezone || null,
        fingerprint: gift || fingerprint,
      })

      if (!updatedGuest) {
        return c.json({ error: "Failed to update guest" })
      }

      const hasNotification = await hasThreadNotifications({
        guestId: updatedGuest.id,
      })

      setFingerprintCookie(c, fingerprint!, cookieDomain, isExtension)
      setDeviceIdCookie(c, deviceId!, cookieDomain, isExtension)

      return c.json({
        locale,
        TEST_MEMBER_FINGERPRINTS,
        TEST_GUEST_FINGERPRINTS,
        TEST_MEMBER_EMAILS,
        device,
        os,
        browser,
        // app,
        aiAgent,
        versions,
        guest: {
          ...(await getGuestDb({ id: updatedGuest.id })),
        },
        user: null,
        aiAgents,
        fingerprint,
        hasNotification,
        deviceId,
        env,
      })
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
      return c.json({ error: "Failed to create guest" })
    }

    setFingerprintCookie(c, fingerprint!, cookieDomain, isExtension)
    setDeviceIdCookie(c, deviceId!, cookieDomain, isExtension)

    return c.json({
      locale,
      TEST_MEMBER_FINGERPRINTS,
      TEST_GUEST_FINGERPRINTS,
      TEST_MEMBER_EMAILS,
      device,
      os,
      browser,
      aiAgent,
      // app,
      versions,
      aiAgents,
      guest: {
        ...(await getGuestDb({ id: newGuest.id })),
      },
      user: null,
      deviceId,
      fingerprint,
      env,
    })
  } catch (error) {
    console.error("Error handling guest:", error)
    return c.json({ error: "Internal server error" })
  }
})
