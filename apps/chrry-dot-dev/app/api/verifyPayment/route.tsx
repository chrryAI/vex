import { NextResponse } from "next/server"
import Stripe from "stripe"
import getMember from "../../actions/getMember"
import {
  createCreditTransaction,
  createGuest,
  createSubscription,
  createSystemLog,
  deleteSubscription,
  getGuest,
  getSubscription,
  getSubscriptions,
  getUser,
  updateGuest,
  updateSubscription,
  updateUser,
  getAffiliateLink,
  createAffiliateReferral,
  updateAffiliateLink,
} from "@repo/db"
import { render } from "@react-email/render"
import Gift from "../../../components/emails/Gift"
import nodemailer from "nodemailer"

import { getSiteConfig } from "chrry/utils/siteConfig"
import captureException from "../../../lib/captureException"
import {
  ADDITIONAL_CREDITS,
  GUEST_CREDITS_PER_MONTH,
  MEMBER_CREDITS_PER_MONTH,
  PLUS_CREDITS_PER_MONTH,
  PRO_CREDITS_PER_MONTH,
} from "@repo/db/src/schema"
import { v4 as uuidv4, validate } from "uuid"
import { capitalizeFirstLetter, FRONTEND_URL, isE2E } from "chrry/utils"
import { trackPurchase } from "../../../lib/ads"

export async function POST(request: Request) {
  const body = await request.json()
  const siteConfig = getSiteConfig()
  const { session_id, userId, guestId, email, checkoutFingerPrint } = body

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const member = await getMember()

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
    return NextResponse.json(
      { error: "Member or guest not found" },
      { status: 404 },
    )
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
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 },
      )
    }

    let newCredits = 0

    const plan =
      (session.metadata?.plan as "plus" | "pro" | "credits") || "plus"

    const subscription = user?.subscription || guest?.subscription

    if (subscription && plan !== "credits") {
      return NextResponse.json(
        {
          error: "Member or guest already has a subscription",
        },
        { status: 400 },
      )
    }

    // Get plan from session metadata instead of trusting payload

    const existingSubscription = await getSubscription({
      sessionId: session.id,
    })
    if (existingSubscription) {
      return NextResponse.json({
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

        // Ensure user gets at least subscription credits, preserving any excess they already have
        newCredits =
          MEMBER_CREDITS_PER_MONTH +
          excessCredits +
          (CREDITS_PER_MONTH - MEMBER_CREDITS_PER_MONTH) // subscription benefit

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

        // Guest gets subscription credits + any excess they purchased
        newCredits = excessCredits + CREDITS_PER_MONTH

        await updateGuest({
          ...guest,
          credits: newCredits,
          subscribedOn: new Date(),
        })
      }

      if (email && !isE2E) {
        const transporter = nodemailer.createTransport({
          host: "smtp.zeptomail.eu",
          port: 587,
          auth: {
            user: "emailapikey",
            pass: process.env.ZEPTOMAIL_API_KEY!,
          },
        })

        const emailHtml = await render(
          <Gift
            inviterName={member?.name}
            origin={FRONTEND_URL}
            isExistingUser={!!user}
            giftFingerprint={guest?.fingerprint || user?.fingerprint || ""}
            plan={plan}
          />,
        )

        try {
          // ZeptoMail returns void on success, throws on error
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

      const subscription = await createSubscription({
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

      if (!subscription) {
        return NextResponse.json({
          success: false,
          type: "subscription",
          message: "Something went wrong",
        })
      }

      // Process affiliate referral

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
          subscriptionId: subscription.id,
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
          subscriptionId: subscription.id,
          metadata: {
            sessionId: session.id,
          },
        })
      }

      const affiliateCode = session.metadata?.affiliateCode
      if (affiliateCode) {
        try {
          const affiliateLink = await getAffiliateLink({ code: affiliateCode })

          if (affiliateLink && affiliateLink.status === "active") {
            // Prevent self-referral (only check user, as guests can't be affiliates)
            const isSelfReferral = user && affiliateLink.userId === user.id

            if (isSelfReferral) {
              console.log("⚠️ Self-referral blocked:", {
                affiliateUserId: affiliateLink.userId,
                buyerUserId: user?.id,
              })
              throw new Error("Cannot use your own affiliate link")
            }

            // Calculate commission (20% of monthly price - recurring)
            const monthlyPrice = plan === "plus" ? 999 : 1999 // in cents
            const monthlyCommission = Math.floor(
              monthlyPrice * (affiliateLink.commissionRate / 100),
            )

            // Calculate bonus credits for new user (30%)
            const bonusCredits = Math.floor(CREDITS_PER_MONTH * 0.3)

            // Create referral record (monthly recurring commission)
            await createAffiliateReferral({
              affiliateLinkId: affiliateLink.id,
              referredUserId: user?.id || null,
              referredGuestId: guest?.id || null,
              subscriptionId: subscription.id,
              status: "converted",
              commissionAmount: monthlyCommission, // Monthly, not yearly
              bonusCredits: bonusCredits,
              convertedOn: new Date(),
            })

            // Update affiliate stats (track first month only, will add more each renewal)
            await updateAffiliateLink({
              ...affiliateLink,
              conversions: affiliateLink.conversions + 1,
              totalRevenue: affiliateLink.totalRevenue + monthlyPrice,
              commissionEarned:
                affiliateLink.commissionEarned + monthlyCommission,
              updatedOn: new Date(),
            })

            // Give bonus credits to new user
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
          // Don't fail the payment if affiliate processing fails
        }
      }

      // Track Google Ads conversion (server-side, zero client tracking)
      const purchaseAmount = plan === "plus" ? 9.99 : 19.99
      const purchaseUserId = user?.id || guest?.id || "unknown"
      await trackPurchase(purchaseUserId, purchaseAmount, session.id).catch(
        (err) => console.error("Failed to track purchase:", err),
      )

      return NextResponse.json({
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

      // Process affiliate referral for credit purchases
      const affiliateCode = session.metadata?.affiliateCode
      let bonusCredits = 0

      if (affiliateCode) {
        try {
          const affiliateLink = await getAffiliateLink({ code: affiliateCode })

          if (affiliateLink && affiliateLink.status === "active") {
            // Prevent self-referral (only check user, as guests can't be affiliates)
            const isSelfReferral = member && affiliateLink.userId === member.id

            if (isSelfReferral) {
              console.log("⚠️ Self-referral blocked (credits):", {
                affiliateUserId: affiliateLink.userId,
                buyerUserId: member.id,
              })
              throw new Error("Cannot use your own affiliate link")
            }

            // Calculate commission (20% of purchase)
            const purchaseAmount = creditAmount * 500 // $5 per credit pack in cents
            const commission = Math.floor(
              purchaseAmount * (affiliateLink.commissionRate / 100),
            )

            // Calculate bonus credits for buyer (30%)
            bonusCredits = Math.floor(creditsToAdd * 0.3)

            // Create referral record
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

            // Update affiliate stats
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
          // Don't fail the payment if affiliate processing fails
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

      // Update subscription if exists to track this purchase
      const existingSubscription = user?.subscription || guest?.subscription
      if (existingSubscription) {
        await updateSubscription({
          ...existingSubscription,
          sessionId: session.id,
        })
      }

      if (email && !isE2E) {
        const transporter = nodemailer.createTransport({
          host: "smtp.zeptomail.eu",
          port: 587,
          auth: {
            user: "emailapikey",
            pass: process.env.ZEPTOMAIL_API_KEY!,
          },
        })

        const emailHtml = await render(
          <Gift
            inviterName={member?.name}
            origin={FRONTEND_URL}
            isExistingUser={!!user}
            plan={"credits"}
            giftFingerprint={guest?.fingerprint || user?.fingerprint || ""}
          />,
        )

        try {
          // ZeptoMail returns void on success, throws on error
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

      // Track Google Ads conversion (server-side, zero client tracking)
      const creditPurchaseAmount = (session.amount_total || 0) / 100 // Convert cents to euros
      const creditPurchaseUserId = user?.id || guest?.id || "unknown"
      await trackPurchase(
        creditPurchaseUserId,
        creditPurchaseAmount,
        session.id,
      ).catch((err) => console.error("Failed to track purchase:", err))

      return NextResponse.json({
        success: true,
        type: "credits",
        creditsAdded: creditsToAdd,
        gift: !!email,
        credits: creditsToAdd,
        fingerprint: guest?.fingerprint || user?.fingerprint,
      })
    }

    return NextResponse.json(
      { error: "Payment not completed" },
      { status: 400 },
    )
  } catch (err: any) {
    captureException(err)
    console.error("Payment verification error:", err)
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 },
    )
  }
}
