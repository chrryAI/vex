import {
  user,
  threadSummary,
  thread,
  guest,
  subscription,
  message,
  collaboration,
  app,
  isOwner,
} from "@repo/db"
import { headers } from "next/headers"
import PDFParser from "pdf2json"
import captureException from "./captureException"
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

const THREAD_SUMMARY_LIMITS = {
  guest: 10, // Trial experience
  member: 50, // Registered users
  plus: 200, // 200/day (very generous)
  pro: 500, // 500/day (unlimited feel)
}

export const getDailyImageLimit = ({
  member,
  guest,
}: {
  member?: Partial<user> & { subscription?: subscription }
  guest?: Partial<guest> & { subscription?: subscription }
}) => {
  const multiplier = member?.role === "admin" ? 10 : 1
  if (member?.subscription || guest?.subscription) {
    return 50 * multiplier // Plus users: 50 images per day
  } else if (member) {
    return 10 * multiplier // Free users: 10 images per day
  } else {
    return 3 * multiplier // Guests: 3 images per day
  }
}

export const getHourlyLimit = ({
  member,
  guest,
  app,
}: {
  app?: app
  member?: user & { subscription?: subscription | null }
  guest?: (guest & { subscription?: subscription | null }) | null
}) => {
  if (app && isOwner(app, { userId: app?.userId, guestId: app?.guestId }))
    return 5000
  if (member?.role === "admin") return 500

  if (member?.subscription || guest?.subscription) {
    return member?.subscription?.plan === "pro" ? 200 : 100
  } else if (member) {
    return 30
  } else {
    return 10
  }
}

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const SPEECH_LIMITS = {
  GUEST: {
    REQUESTS_PER_HOUR: 5,
    REQUESTS_PER_DAY: 50,
    CHARACTERS_PER_DAY: 2500, // ~10-12 sentences
    VOICE_TYPE: "elevenlabs_basic",
  },
  USER: {
    REQUESTS_PER_HOUR: 20,
    REQUESTS_PER_DAY: 200,
    CHARACTERS_PER_DAY: 10000, // ~40-50 sentences
    // CHARACTERS_PER_DAY: 10000, // ~40-50 sentences
    VOICE_TYPE: "elevenlabs_basic",
  },
  SUBSCRIBER: {
    REQUESTS_PER_HOUR: -1, // unlimited
    REQUESTS_PER_DAY: -1, // unlimited
    CHARACTERS_PER_DAY: -1, // unlimited
    VOICE_TYPE: "elevenlabs_premium",
  },
} as const

export type UserType = "GUEST" | "USER" | "SUBSCRIBER"

export function getSpeechLimits(userType: UserType) {
  return SPEECH_LIMITS[userType]
}

export function checkSpeechLimits({
  user,
  guest,
  textLength,
}: {
  user?: user
  guest?: guest
  textLength: number
}) {
  if (!user && !guest) {
    return { allowed: false, reason: "Unauthorized" }
  }

  const currentUser = (user || guest) as (user | guest) & {
    subscription?: subscription
  }
  const userType: UserType = currentUser?.subscription
    ? "SUBSCRIBER"
    : user
      ? "USER"
      : "GUEST"
  const limits = getSpeechLimits(userType)

  const requestsToday = currentUser?.speechRequestsToday || 0
  const requestsThisHour = currentUser?.speechRequestsThisHour || 0
  const charactersToday = currentUser?.speechCharactersToday || 0

  // Check hourly request limit
  if (
    limits.REQUESTS_PER_HOUR !== -1 &&
    requestsThisHour >= limits.REQUESTS_PER_HOUR
  ) {
    return {
      allowed: false,
      reason: `Hourly limit reached`,
    }
  }

  // Check daily request limit (using requestsToday)
  if (
    limits.REQUESTS_PER_DAY !== -1 &&
    requestsToday >= limits.REQUESTS_PER_DAY
  ) {
    return {
      allowed: false,
      reason: `Daily request limit reached (${limits.REQUESTS_PER_DAY} requests/day)`,
    }
  }

  // Check daily character limit
  if (
    limits.CHARACTERS_PER_DAY !== -1 &&
    charactersToday + textLength > limits.CHARACTERS_PER_DAY
  ) {
    return {
      allowed: false,
      reason: `Daily character limit reached (${limits.CHARACTERS_PER_DAY} chars/day)`,
    }
  }

  return { allowed: true }
}

export const isCollaborator = (
  thread: thread & {
    collaborations?: {
      collaboration: collaboration
      user: user
    }[]
  },
  userId?: string,
  status?: "active" | "pending",
): boolean => {
  if (!userId || !thread.collaborations) return false
  return (
    thread.collaborations.some(
      (collab) =>
        collab.user.id === userId &&
        (status ? collab.collaboration.status === status : true),
    ) ?? false
  )
}

export function checkThreadSummaryLimit({
  user,
  guest,
  thread,
}: {
  user?: (user & { subscription?: subscription }) | null
  guest?: (guest & { subscription?: subscription }) | null
  threadId?: string
  thread: thread & { summary?: threadSummary }
}): boolean {
  if (!user && !guest) return false

  const summary = thread.summary

  // Determine user type and limit
  let limit: number
  if (user?.subscription || guest?.subscription) {
    limit =
      user?.subscription?.plan === "pro"
        ? THREAD_SUMMARY_LIMITS.pro
        : THREAD_SUMMARY_LIMITS.plus
  } else if (user) {
    limit = THREAD_SUMMARY_LIMITS.member
  } else {
    limit = THREAD_SUMMARY_LIMITS.guest
  }

  try {
    // Check if summary was created today
    if (summary?.createdOn) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const summaryDate = new Date(summary.createdOn)
      summaryDate.setHours(0, 0, 0, 0)

      // If summary was created today, check if thread message count is under limit
      // This prevents one huge thread from consuming entire daily quota
      if (summaryDate.getTime() === today.getTime()) {
        return summary.messageCount < limit
      }
    }

    // Allow generation if no summary exists or summary is from previous day
    return true
  } catch (error) {
    console.error("Error checking thread summary limit:", error)
    return false
  }
}

export const hasThreadNotification = ({
  thread,
  guest,
  user,
}: {
  thread: thread & {
    lastMessage?: message
    collaborations?: { collaboration: collaboration; user: user }[]
  }
  guest?: guest
  user?: user
}) => {
  if (!thread.lastMessage?.createdOn) return false

  // Handle thread owner cases first
  if (thread.guestId === guest?.id) {
    return guest.activeOn && thread.lastMessage.createdOn > guest.activeOn
  }

  if (thread.userId === user?.id) {
    return user.activeOn && thread.lastMessage.createdOn > user.activeOn
  }

  return !!(
    thread.lastMessage?.createdOn && // Safe access with optional chaining
    thread.collaborations?.some(
      (c) =>
        c.user?.id === user?.id &&
        c.collaboration?.activeOn && // Check activeOn exists
        c.collaboration.activeOn < thread.lastMessage!.createdOn, // Non-null assertion since we already checked
    )
  )
}
export const extractPDFText = async (buffer: Buffer): Promise<string> => {
  return new Promise((resolve) => {
    console.log("📄 PDF buffer size:", buffer.length)

    const pdfParser = new PDFParser()

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      console.error("❌ PDF parsing error:", errData)
      resolve("[Could not extract text from PDF - parsing error]")
      captureException(errData)
    })

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        console.log("📊 PDF data received, pages:", pdfData.Pages?.length || 0)

        const text = pdfParser.getRawTextContent()
        console.log("📝 Raw text length:", text?.length || 0)
        console.log("📝 First 100 chars:", text?.substring(0, 100))

        if (text && text.trim().length > 0) {
          resolve(text)
        } else {
          // Try alternative extraction method
          let extractedText = ""
          if (pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const text of page.Texts) {
                  if (text.R) {
                    for (const run of text.R) {
                      if (run.T) {
                        extractedText += decodeURIComponent(run.T) + " "
                      }
                    }
                  }
                }
              }
              extractedText += "\n"
            }
          }

          console.log("📝 Alternative extraction result:", extractedText.length)
          resolve(extractedText || "[No text content found in PDF]")
        }
      } catch (error) {
        captureException(error)
        console.error("❌ Text extraction error:", error)
        resolve("[Could not extract text from PDF - extraction error]")
      }
    })

    try {
      pdfParser.parseBuffer(buffer)
    } catch (error) {
      captureException(error)
      console.error("❌ Buffer parsing error:", error)
      resolve("[Could not extract text from PDF - buffer error]")
    }
  })
}

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

export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
export const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET
export const CHATGPT_API_KEY = process.env.CHATGPT_API_KEY
export const CHATGPT_API_KEY_2 = process.env.CHATGPT_API_KEY_2
export const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY
export const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY
export const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY
