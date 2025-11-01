import {
  createCollaboration,
  deletePushSubscription,
  getCollaboration,
  getCollaborations,
  getPushSubscription,
  getThread,
  getUser,
  updateThread,
} from "@repo/db"
import { NextResponse } from "next/server"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import nodemailer from "nodemailer"
import { render } from "@react-email/render"
import webpush from "web-push"
import { FRONTEND_URL, isE2E } from "chrry/utils"
import Collaboration from "../../../components/emails/Collaboration"
import { defaultLocale } from "chrry/locales"
import { getSiteConfig } from "chrry/utils/siteConfig"
import { captureException } from "@sentry/nextjs"

export async function POST(request: Request) {
  const siteConfig = getSiteConfig()
  webpush.setVapidDetails(
    `mailto:${siteConfig.email}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  const { threadId, userId } = await request.json()

  const thread = await getThread({ id: threadId })

  const member = await getMember()
  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 })
  }

  // Check if user is the thread owner (either member or guest)
  const isThreadOwner =
    (member && thread.userId === member.id) ||
    (guest && thread.guestId === guest.id)

  if (!isThreadOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const existingCollaboration = await getCollaboration({
    threadId,
    userId,
  })

  if (existingCollaboration) {
    return NextResponse.json(
      { error: "Collaboration already exists" },
      { status: 400 },
    )
  }

  const user = await getUser({
    id: userId,
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const collaboration = await createCollaboration({
    threadId,
    userId: user.id,
    status: "pending",
  })

  if (!collaboration) {
    return NextResponse.json(
      { error: "Collaboration not created" },
      { status: 500 },
    )
  }

  const subscription = await getPushSubscription({
    userId,
  })

  if (subscription) {
    try {
      const result = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        JSON.stringify({
          title: "Collaboration Request",
          body: "You have a new collaboration request",
          icon: "/icon-128.png", // Optional: path to notification icon
          data: {
            url: `${FRONTEND_URL}/threads/${thread.id}`, // URL to open when notification is clicked
          },
        }),
      )

      if (result.statusCode !== 201) {
        await deletePushSubscription({ id: subscription.id })
      }
    } catch (error) {
      console.error("WebPush error:", error)
    }
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.zeptomail.eu",
    port: 587,
    auth: {
      user: "emailapikey",
      pass: process.env.ZEPTOMAIL_API_KEY!,
    },
  })
  if (user.email && !isE2E) {
    const emailHtml = await render(
      <Collaboration
        origin={FRONTEND_URL}
        thread={thread}
        type="invited"
        user={member}
        guest={guest}
        language={member?.language || defaultLocale}
      />,
    )

    try {
      // ZeptoMail returns void on success, throws on error
      await transporter.sendMail({
        from: `${siteConfig.name} Team <no-reply@${siteConfig.domain}>`,
        to: user.email,
        subject: `Let's collaborate on ${siteConfig.name}!`,
        html: emailHtml,
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

  return NextResponse.json({ collaboration })
}
