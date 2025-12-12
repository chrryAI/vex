import { Hono } from "hono"
import { getMember, getGuest } from "../lib/auth"
import {
  createCollaboration,
  deletePushSubscription,
  getCollaboration,
  getCollaborations,
  getPushSubscription,
  getThread,
  getUser,
  updateThread,
  updateCollaboration,
  deleteCollaboration,
} from "@repo/db"
import { collaborationStatus } from "@repo/db/src/schema"
import nodemailer from "nodemailer"
import { render } from "@react-email/render"
import webpush from "web-push"
import { FRONTEND_URL, isE2E } from "chrry/utils"
import Collaboration from "../../components/emails/Collaboration"
import { defaultLocale } from "chrry/locales"
import { getSiteConfig } from "chrry/utils/siteConfig"
import { captureException } from "@sentry/node"

export const collaborations = new Hono()

// POST /collaborations - Create collaboration
collaborations.post("/", async (c) => {
  const siteConfig = getSiteConfig()
  webpush.setVapidDetails(
    `mailto:${siteConfig.email}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  const { threadId, userId } = await c.req.json()

  const thread = await getThread({ id: threadId })

  const member = await getMember(c)
  const guest = member ? undefined : await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  if (!thread) {
    return c.json({ error: "Thread not found" }, 404)
  }

  // Check if user is the thread owner (either member or guest)
  const isThreadOwner =
    (member && thread.userId === member.id) ||
    (guest && thread.guestId === guest.id)

  if (!isThreadOwner) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const existingCollaboration = await getCollaboration({
    threadId,
    userId,
  })

  if (existingCollaboration) {
    return c.json({ error: "Collaboration already exists" }, 400)
  }

  const user = await getUser({
    id: userId,
  })

  if (!user) {
    return c.json({ error: "User not found" }, 404)
  }

  const collaboration = await createCollaboration({
    threadId,
    userId: user.id,
    status: "pending",
  })

  if (!collaboration) {
    return c.json({ error: "Collaboration not created" }, 500)
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

  const apiKey = process.env.ZEPTOMAIL_API_KEY

  if (apiKey) {
    const transporter = nodemailer.createTransport({
      host: "smtp.zeptomail.eu",
      port: 587,
      auth: {
        user: "emailapikey",
        pass: apiKey,
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
        return c.json({ error: "Failed to send invite" }, 500)
      }
    }
  }

  return c.json({ collaboration })
})

// PATCH /collaborations/:id - Update collaboration status
collaborations.patch("/:id", async (c) => {
  const id = c.req.param("id")

  if (!id) {
    return c.json({ error: "Collaboration not found", status: 404 }, 404)
  }

  const { status } = (await c.req.json()) as {
    status: collaborationStatus | undefined
  }

  if (!["active", "revoked", "rejected", "pending"].includes(status ?? "")) {
    return c.json({ error: "Invalid status", status: 400 }, 400)
  }

  const member = await getMember(c)
  const guest = member ? undefined : await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized", status: 401 }, 401)
  }

  const collab = await getCollaboration({ id })

  if (!collab) {
    return c.json({ error: "Collaboration not found", status: 404 }, 404)
  }

  const thread = await getThread({ id: collab.threadId })

  if (!thread) {
    return c.json({ error: "Thread not found", status: 404 }, 404)
  }

  // Check if user is the thread owner (either member or guest)
  const isThreadOwner =
    (member && thread.userId === member.id) ||
    (guest && thread.guestId === guest.id)

  const isCollaborator = thread.collaborations?.some(
    (collaboration) => collaboration.user.id === member?.id,
  )

  if (!isThreadOwner && !isCollaborator) {
    console.log("Unauthorized - not thread owner")
    return c.json({ error: "Unauthorized", status: 401 }, 401)
  }

  if (status === "revoked") {
    await deleteCollaboration({ id })
    return c.json({ collaboration: null })
  }

  const updatedCollab = await updateCollaboration({
    ...collab,
    status: status ?? collab.status,
  })

  return c.json({ collaboration: updatedCollab })
})
