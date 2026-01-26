import { Hono } from "hono"
import { getMember, getGuest } from "../lib/auth"
import {
  createCollaboration,
  getCollaboration,
  getThread,
  getUser,
  updateCollaboration,
  deleteCollaboration,
} from "@repo/db"
import { collaborationStatus } from "@repo/db/src/schema"
import { render } from "@react-email/render"
import { FRONTEND_URL } from "@chrryai/chrry/utils"
import Collaboration from "../../components/emails/Collaboration"
import { defaultLocale } from "@chrryai/chrry/locales"
import { sendWebPush } from "../../lib/sendWebPush"
import { sendEmail } from "../../lib/sendEmail"

export const collaborations = new Hono()

// POST /collaborations - Create collaboration
collaborations.post("/", async (c) => {
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

  // Send push notification (with timeout)
  await sendWebPush({
    c,
    userId,
    payload: {
      title: "Collaboration Request",
      body: "You have a new collaboration request",
      icon: "/icon-128.png",
      data: {
        url: `${FRONTEND_URL}/threads/${thread.id}`,
      },
    },
  })

  // Send email notification (with timeout)
  if (user.email) {
    const emailHtml = await render(
      <Collaboration
        origin={FRONTEND_URL}
        thread={thread}
        type="invited"
        user={member}
        language={member?.language || defaultLocale}
      />,
    )

    await sendEmail({
      c,
      to: user.email,
      subject: "Let's collaborate!",
      html: emailHtml,
    })
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
