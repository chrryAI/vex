import { Hono } from "hono"
import Stripe from "stripe"
import { v4 as uuidv4, validate } from "uuid"
import { jsx } from "react/jsx-runtime"
import { render } from "@react-email/render"
import nodemailer from "nodemailer"
import {
  createCreditTransaction,
  createGuest,
  createSubscription,
  createSystemLog,
  getGuest,
  getSubscription,
  getUser,
  updateGuest,
  updateSubscription,
  updateUser,
  getAffiliateLink,
  createAffiliateReferral,
  updateAffiliateLink,
} from "@repo/db"
import { getMember } from "../lib/auth"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import captureException from "../../lib/captureException"
import {
  ADDITIONAL_CREDITS,
  GUEST_CREDITS_PER_MONTH,
  MEMBER_CREDITS_PER_MONTH,
  PLUS_CREDITS_PER_MONTH,
  PRO_CREDITS_PER_MONTH,
} from "@repo/db/src/schema"
import { capitalizeFirstLetter, FRONTEND_URL, isE2E } from "@chrryai/chrry/utils"
import { trackPurchase } from "../../lib/ads"
import Gift from "../../components/emails/Gift"

export const verifyPayment = new Hono()

// POST /verifyPayment - Verify Stripe payment and process subscription/credits
verifyPayment.post("/", async (c) => {
  const body = await c.req.json()
  const siteConfig = getSiteConfig()
  const { session_id, userId, guestId, email, checkoutFingerPrint } = body

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const member = await getMember(c)

  const isE2EAndValidFingerprint = isE2E && validate(checkoutFingerPrint)

  const newFingerprint = isE2EAndValidFingerprint
    ? checkoutFingerPrint
    : uuidv4()

  let user = email
    ? await getUser({ email })
    : userId
      ? await getUser({ id: userId })
      : undefined
  let guest = !user
    ? email
      ? (await getGuest({ email })) ||
        (await createGuest({
          email,
          fingerprint: newFingerprint,
          ip: "192.168.1.1",
        }))
      : await getGuest({ id: guestId })
    : undefined

  if (isE2EAndValidFingerprint && user) {
    await updateUser({
      ...user,
      fingerprint: newFingerprint,
    })

    user = await getUser({ id: userId })
  }

  if (isE2EAndValidFingerprint && guest) {
    await updateGuest({
      ...guest,
      fingerprint: newFingerprint,
    })

    guest = await getGuest({ id: guestId })
  }

  if (!user && !guest) {
    return c.json({ error: "Member or guest not found" }, 404)
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(
      session_id as string,
      {
        expand: ["subscription", "line_items"],
      },
    )

    // Security check - ensure payment was actually completed
    if (session.payment_status !== "paid") {
      return c.json({ error: "Payment not completed" }, 400)
    }

    let newCredits = 0

    const plan =
      (session.metadata?.plan as "plus" | "pro" | "credits") || "plus"

    const subscription = user?.subscription || guest?.subscription

    if (subscription && plan !== "credits") {
      return c.json(
        {
          error: "Member or guest already has a subscription",
        },
        400,
      )
    }

    const existingSubscription = await getSubscription({
      sessionId: session.id,
    })
    if (existingSubscription) {
      return c.json({
        success: true,
        type: "subscription",
        message: "Already processed",
      })
    }

    const CREDITS_PER_MONTH =
      plan === "plus" ? PLUS_CREDITS_PER_MONTH : PRO_CREDITS_PER_MONTH

    // Handle subscription payment
    if (
      session.mode === "subscription" &&
      session.subscription &&
      plan !== "credits"
    ) {
      if (user) {
        const excessCredits = Math.max(
          0,
          user.credits - MEMBER_CREDITS_PER_MONTH,
        )

        newCredits =
          MEMBER_CREDITS_PER_MONTH +
          excessCredits +
          (CREDITS_PER_MONTH - MEMBER_CREDITS_PER_MONTH)

        await updateUser({
          ...user,
          credits: newCredits,
          subscribedOn: new Date(),
        })
      }

      if (guest) {
        const excessCredits = Math.max(
          0,
          guest.credits - GUEST_CREDITS_PER_MONTH,
        )

        newCredits = excessCredits + CREDITS_PER_MONTH

        await updateGuest({
          ...guest,
          credits: newCredits,
          subscribedOn: new Date(),
        })
      }

      const apiKey = process.env.ZEPTOMAIL_API_KEY

      if (email && !isE2E && apiKey) {
        const transporter = nodemailer.createTransport({
          host: "smtp.zeptomail.eu",
          port: 587,
          auth: {
            user: "emailapikey",
            pass: apiKey,
          },
        })

        const emailHtml = await render(
          jsx(Gift, {
            inviterName: member?.name,
            origin: FRONTEND_URL,
            isExistingUser: !!user,
            giftFingerprint: guest?.fingerprint || user?.fingerprint || "",
            plan: plan,
          }),
        )

        try {
          await transporter.sendMail({
            from: `${siteConfig.name} <gifts@${siteConfig.domain}>`,
            to: email,
            subject:
              "🎁 Your Vex " + capitalizeFirstLetter(plan) + " Gift is Ready!",
            html: emailHtml,
            headers: {
              "List-Unsubscribe": `<mailto:unsubscribe@${siteConfig.domain}>`,
              "X-Mailer": `${siteConfig.name} Gift System`,
            },
          })
          console.log("Email sent successfully")
        } catch (error) {
          captureException(error)
          console.error("ZeptoMail API error:", error)
          createSystemLog({
            level: "error",
            message: "Error sending gift email",
            object: error,
            userId: user?.id,
            guestId: guest?.id,
          })
        }
      }

      const newSubscription = await createSubscription({
        provider: "stripe",
        subscriptionId:
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id,
        status: "active",
        userId: user?.id,
        guestId: guest?.id,
        plan,
        sessionId: session.id,
      })

      if (!newSubscription) {
        return c.json({
          success: false,
          type: "subscription",
          message: "Something went wrong",
        })
      }

      // Create credit transaction
      if (guest) {
        await createCreditTransaction({
          userId: null,
          guestId: guest.id,
          amount:
            plan === "plus" ? PLUS_CREDITS_PER_MONTH : PRO_CREDITS_PER_MONTH,
          balanceBefore: guest.credits,
          balanceAfter: guest.credits + newCredits,
          description: "Subscription credit allocation",
          type: "subscription",
          subscriptionId: newSubscription.id,
          metadata: {
            sessionId: session.id,
          },
        })
      } else if (user) {
        await createCreditTransaction({
          userId: user.id,
          guestId: null,
          amount:
            plan === "plus" ? PLUS_CREDITS_PER_MONTH : PRO_CREDITS_PER_MONTH,
          balanceBefore: user.credits,
          balanceAfter: newCredits,
          description: "Subscription credit allocation",
          type: "subscription",
          subscriptionId: newSubscription.id,
          metadata: {
            sessionId: session.id,
          },
        })
      }

      // Process affiliate referral
      const affiliateCode = session.metadata?.affiliateCode
      if (affiliateCode) {
        try {
          const affiliateLink = await getAffiliateLink({ code: affiliateCode })

          if (affiliateLink && affiliateLink.status === "active") {
            const isSelfReferral = user && affiliateLink.userId === user.id

            if (isSelfReferral) {
              console.log("⚠️ Self-referral blocked:", {
                affiliateUserId: affiliateLink.userId,
                buyerUserId: user?.id,
              })
              throw new Error("Cannot use your own affiliate link")
            }

            const monthlyPrice = plan === "plus" ? 999 : 1999
            const monthlyCommission = Math.floor(
              monthlyPrice * (affiliateLink.commissionRate / 100),
            )

            const bonusCredits = Math.floor(CREDITS_PER_MONTH * 0.3)

            await createAffiliateReferral({
              affiliateLinkId: affiliateLink.id,
              referredUserId: user?.id || null,
              referredGuestId: guest?.id || null,
              subscriptionId: newSubscription.id,
              status: "converted",
              commissionAmount: monthlyCommission,
              bonusCredits: bonusCredits,
              convertedOn: new Date(),
            })

            await updateAffiliateLink({
              ...affiliateLink,
              conversions: affiliateLink.conversions + 1,
              totalRevenue: affiliateLink.totalRevenue + monthlyPrice,
              commissionEarned:
                affiliateLink.commissionEarned + monthlyCommission,
              updatedOn: new Date(),
            })

            if (user) {
              await updateUser({
                ...user,
                credits: newCredits + bonusCredits,
              })
            } else if (guest) {
              await updateGuest({
                ...guest,
                credits: newCredits + bonusCredits,
              })
            }

            console.log("🎉 Affiliate bonus applied (monthly recurring):", {
              affiliate: affiliateCode,
              monthlyCommission: monthlyCommission / 100,
              bonusCredits: bonusCredits,
              plan: plan,
            })
          }
        } catch (error) {
          console.error("❌ Error processing affiliate referral:", error)
          captureException(error)
        }
      }

      // Track Google Ads conversion
      const purchaseAmount = plan === "plus" ? 9.99 : 19.99
      const purchaseUserId = user?.id || guest?.id || "unknown"
      await trackPurchase(purchaseUserId, purchaseAmount, session.id).catch(
        (err) => console.error("Failed to track purchase:", err),
      )

      return c.json({
        success: true,
        type: "subscription",
        gift: !!email,
        fingerprint: guest?.fingerprint || user?.fingerprint,
      })
    }

    // Handle one-time credit purchase
    if (session.mode === "payment" && session.line_items?.data[0]) {
      const creditAmount = session.line_items.data[0].quantity || 0
      const creditsToAdd = creditAmount * ADDITIONAL_CREDITS

      const affiliateCode = session.metadata?.affiliateCode
      let bonusCredits = 0

      if (affiliateCode) {
        try {
          const affiliateLink = await getAffiliateLink({ code: affiliateCode })

          if (affiliateLink && affiliateLink.status === "active") {
            const isSelfReferral = member && affiliateLink.userId === member.id

            if (isSelfReferral) {
              console.log("⚠️ Self-referral blocked (credits):", {
                affiliateUserId: affiliateLink.userId,
                buyerUserId: member.id,
              })
              throw new Error("Cannot use your own affiliate link")
            }

            const purchaseAmount = creditAmount * 500
            const commission = Math.floor(
              purchaseAmount * (affiliateLink.commissionRate / 100),
            )

            bonusCredits = Math.floor(creditsToAdd * 0.3)

            await createAffiliateReferral({
              affiliateLinkId: affiliateLink.id,
              referredUserId: user?.id || null,
              referredGuestId: guest?.id || null,
              subscriptionId: null,
              status: "converted",
              commissionAmount: commission,
              bonusCredits: bonusCredits,
              convertedOn: new Date(),
            })

            await updateAffiliateLink({
              ...affiliateLink,
              conversions: affiliateLink.conversions + 1,
              totalRevenue: affiliateLink.totalRevenue + purchaseAmount,
              commissionEarned: affiliateLink.commissionEarned + commission,
              updatedOn: new Date(),
            })

            console.log("🎉 Affiliate bonus applied (credits):", {
              affiliate: affiliateCode,
              commission: commission,
              bonusCredits: bonusCredits,
            })
          }
        } catch (error) {
          console.error("❌ Error processing affiliate referral:", error)
          captureException(error)
        }
      }

      const totalCredits = creditsToAdd + bonusCredits

      if (user) {
        await updateUser({
          ...user,
          credits: user.credits + totalCredits,
        })

        await createCreditTransaction({
          userId: user.id,
          guestId: null,
          amount: totalCredits,
          balanceBefore: user.credits,
          balanceAfter: user.credits + totalCredits,
          description: bonusCredits
            ? `Credit purchase + ${bonusCredits} affiliate bonus`
            : "Credit purchase",
          metadata: {
            sessionId: session.id,
            ...(bonusCredits && { affiliateBonus: bonusCredits }),
          },
        })
      }

      if (guest) {
        await updateGuest({
          ...guest,
          credits: guest.credits + totalCredits,
        })

        await createCreditTransaction({
          userId: null,
          guestId: guest.id,
          amount: totalCredits,
          balanceBefore: guest.credits,
          balanceAfter: guest.credits + totalCredits,
          description: bonusCredits
            ? `Credit purchase + ${bonusCredits} affiliate bonus`
            : "Credit purchase",
          metadata: {
            sessionId: session.id,
            ...(bonusCredits && { affiliateBonus: bonusCredits }),
          },
        })
      }

      const existingSubscription = user?.subscription || guest?.subscription
      if (existingSubscription) {
        await updateSubscription({
          ...existingSubscription,
          sessionId: session.id,
        })
      }

      const apiKey = process.env.ZEPTOMAIL_API_KEY

      if (email && !isE2E && apiKey) {
        const transporter = nodemailer.createTransport({
          host: "smtp.zeptomail.eu",
          port: 587,
          auth: {
            user: "emailapikey",
            pass: apiKey,
          },
        })

        const emailHtml = await render(
          jsx(Gift, {
            inviterName: member?.name,
            origin: FRONTEND_URL,
            isExistingUser: !!user,
            plan: "credits",
            giftFingerprint: guest?.fingerprint || user?.fingerprint || "",
          }),
        )

        try {
          await transporter.sendMail({
            from: `${siteConfig.name} <gifts@${siteConfig.domain}>`,
            to: email,
            subject: "🎁 Your Chrry Credits Gift is Ready!",
            html: emailHtml,
            headers: {
              "List-Unsubscribe": `<mailto:unsubscribe@${siteConfig.domain}>`,
              "X-Mailer": "Vex Gift System",
            },
          })
          console.log("Email sent successfully")
        } catch (error) {
          captureException(error)
          console.error("ZeptoMail API error:", error)
          createSystemLog({
            level: "error",
            message: "Error sending gift email",
            object: error,
            userId: user?.id,
            guestId: guest?.id,
          })
        }
      }

      // Track Google Ads conversion
      const creditPurchaseAmount = (session.amount_total || 0) / 100
      const creditPurchaseUserId = user?.id || guest?.id || "unknown"
      await trackPurchase(
        creditPurchaseUserId,
        creditPurchaseAmount,
        session.id,
      ).catch((err) => console.error("Failed to track purchase:", err))

      return c.json({
        success: true,
        type: "credits",
        creditsAdded: creditsToAdd,
        gift: !!email,
        credits: creditsToAdd,
        fingerprint: guest?.fingerprint || user?.fingerprint,
      })
    }

    return c.json({ error: "Payment not completed" }, 400)
  } catch (err: any) {
    captureException(err)
    console.error("Payment verification error:", err)
    return c.json({ error: "Payment verification failed" }, 500)
  }
})
