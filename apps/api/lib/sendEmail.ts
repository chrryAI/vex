import { isE2E } from "@chrryai/chrry/utils"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import type { Context } from "hono"
import nodemailer from "nodemailer"
import { getChrryUrl } from "../hono/lib/getApp"
import { captureException } from "./captureException"

export const sendEmail = async ({
  c,
  from,
  to,
  subject,
  headers,
  html,
  timeoutMs = 10000, // 10 second default timeout
}: {
  c: Context
  from?: string
  to: string
  subject: string
  html: string
  timeoutMs?: number
  headers?: Record<string, string>
}) => {
  if (isE2E) {
    console.log("E2E mode, skipping email send")
    return { success: true, skipped: true }
  }

  const apiKey = process.env.ZEPTOMAIL_API_KEY

  if (!apiKey) {
    console.warn("ZEPTOMAIL_API_KEY not set, skipping email")
    return { success: false, error: "Email API key not configured" }
  }

  const chrryUrl = getChrryUrl(c.req.raw)
  const _siteConfig = getSiteConfig(chrryUrl)

  const transporter = nodemailer.createTransport({
    host: "smtp.zeptomail.eu",
    port: 587,
    auth: {
      user: "emailapikey",
      pass: apiKey,
    },
  })

  try {
    // Add timeout to prevent hanging
    const emailPromise = transporter.sendMail({
      from: from || `Chrry <no-reply@chrry.ai>`,
      to,
      subject,
      html,
      headers,
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Email send timeout")), timeoutMs),
    )

    await Promise.race([emailPromise, timeoutPromise])

    return { success: true }
  } catch (error) {
    console.error("Email send error:", error)
    captureException(error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
