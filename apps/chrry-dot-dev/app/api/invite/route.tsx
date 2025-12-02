import { NextRequest, NextResponse } from "next/server"
import { SendMailClient } from "zeptomail"
import { render } from "@react-email/render"

import Invite from "../../../components/emails/Invite"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { Ratelimit } from "@upstash/ratelimit"
import { upstashRedis } from "@repo/db"
import { isDevelopment, isE2E } from "chrry/utils"
import nodemailer from "nodemailer"
import { createInvitation, getInvitation } from "@repo/db"
import captureException from "../../../lib/captureException"
import { getSiteConfig } from "chrry/utils/siteConfig"

export async function POST(request: NextRequest) {
  const siteConfig = getSiteConfig()
  if (!(isDevelopment || isE2E)) {
    const ratelimit = new Ratelimit({
      redis: upstashRedis,
      limiter: Ratelimit.slidingWindow(60, "1 m"), // 240 requests per minute (supports real-time collaboration auth)
    })
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1"
    const { success } = await ratelimit.limit(ip)

    if (!success) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    }
  }
  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { email, threadId } = await request.json()

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 })
  }

  const invitation = await getInvitation({
    email,
    threadId,
  })

  if (invitation && !isDevelopment) {
    return NextResponse.json(
      { error: "Invitation already exists" },
      { status: 400 },
    )
  }

  const apiKey = process.env.ZEPTOMAIL_API_KEY

  if (!isE2E && apiKey) {
    const transporter = nodemailer.createTransport({
      host: "smtp.zeptomail.eu",
      port: 587,
      auth: {
        user: "emailapikey",
        pass: apiKey,
      },
    })

    const emailHtml = await render(<Invite />)

    try {
      // ZeptoMail returns void on success, throws on error
      await transporter.sendMail({
        from: `"${siteConfig.name} Team" <no-reply@${siteConfig.domain}>`,
        to: email,
        subject: `Let's get started with ${siteConfig.name}!`,
        html: emailHtml,
        headers: {
          "List-Unsubscribe": `<mailto:unsubscribe@${siteConfig.domain}>`,
          "X-Mailer": `${siteConfig.name} Collaboration System`,
        },
      })
    } catch (error) {
      captureException(error)
      console.error("ZeptoMail API error:", error)
      return NextResponse.json(
        { error: "Failed to send invite" },
        { status: 500 },
      )
    }
  }

  await createInvitation({
    email,
    threadId,
    userId: member?.id,
    guestId: guest?.id,
  })

  return NextResponse.json({ success: true })
}
