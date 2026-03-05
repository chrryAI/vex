import { isDevelopment, isE2E } from "@chrryai/chrry/utils"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import { render } from "@react-email/render"
import { createInvitation, getInvitation } from "@repo/db"
import { Hono } from "hono"
import Invite from "../../components/emails/Invite"
import { captureException } from "../../lib/captureException"
import { checkRateLimit } from "../../lib/rateLimiting"
import { sendEmail } from "../../lib/sendEmail"
import { getGuest, getMember } from "../lib/auth"

export const invite = new Hono()

// POST /invite - Send invitation email
invite.post("/", async (c) => {
  const siteConfig = getSiteConfig()

  if (!(isDevelopment || isE2E)) {
    const member = await getMember(c)
    const guest = await getGuest(c)
    const { success } = await checkRateLimit(c.req.raw, {
      member: member ?? undefined,
      guest: guest ?? undefined,
    })
    if (!success) {
      return c.json({ error: "Too many requests" }, 429)
    }
  }

  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const { email, threadId } = await c.req.json()

  if (!email) {
    return c.json({ error: "Missing email" }, 400)
  }

  const invitation = await getInvitation({
    email,
    threadId,
  })

  if (invitation && !isDevelopment) {
    return c.json({ error: "Invitation already exists" }, 400)
  }

  const emailHtml = await render(<Invite />)
  try {
    // ZeptoMail returns void on success, throws on error
    await sendEmail({
      c,
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
    return c.json({ error: "Failed to send invite" }, 500)
  }

  await createInvitation({
    email,
    threadId,
    userId: member?.id,
    guestId: guest?.id,
  })

  return c.json({ success: true })
})
