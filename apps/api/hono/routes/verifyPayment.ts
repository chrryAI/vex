import {
  capitalizeFirstLetter,
  FRONTEND_URL,
  isE2E,
} from "@chrryai/chrry/utils"
import { getSiteConfig } from "@chrryai/chrry/utils/siteConfig"
import { render } from "@react-email/render"
import {
  createAffiliateReferral,
  createCreditTransaction,
  createFeedbackTransaction,
  createGuest,
  createPremiumSubscription,
  createSubscription,
  createSystemLog,
  getAffiliateLink,
  getApp,
  getGuest,
  getScheduledJob,
  getSubscription,
  getUser,
  updateAffiliateLink,
  updateGuest,
  updateScheduledJob,
  updateSubscription,
  updateUser,
} from "@repo/db"
import {
  GUEST_CREDITS_PER_MONTH,
  MEMBER_CREDITS_PER_MONTH,
  PLUS_CREDITS_PER_MONTH,
  PRO_CREDITS_PER_MONTH,
} from "@repo/db/src/schema"
import { Hono } from "hono"
import nodemailer from "nodemailer"
import { jsx } from "react/jsx-runtime"
import Stripe from "stripe"
import { v4 as uuidv4 } from "uuid"
import Gift from "../../components/emails/Gift"
import { captureException } from "../../lib/captureException"
import { getMember } from "../lib/auth"

export const verifyPayment = new Hono()

// POST /verifyPayment - Verify Stripe payment and process subscription/credits
verifyPayment.post("/", async (c) => {
  const body = await c.req.json()
  const siteConfig = getSiteConfig()
  const {
    session_id,
    userId,
    guestId,
    email,
    plan: requestPlan,
    tier: requestTier,
    appId,
    // Tribe/Molt schedule fields (optional)
    totalPrice,
  } = body

  console.log("🔍 verifyPayment received session_id:", {
    session_id,
    length: session_id?.length,
    type: typeof session_id,
  })

  const app = appId ? await getApp({ id: appId }) : undefined

  const member = await getMember(c)

  const stripe = new Stripe(
    member?.role === "admin"
      ? process.env.STRIPE_SECRET_KEY_TEST!
      : process.env.STRIPE_SECRET_KEY!,
  )

  const newFingerprint = uuidv4()

  let user = email
    ? await getUser({ email, skipCache: true })
    : userId
      ? await getUser({ id: userId, skipCache: true })
      : undefined
  let guest = !user
    ? email
      ? (await getGuest({ email, skipCache: true })) ||
        (await createGuest({
          email,
          fingerprint: newFingerprint,
          ip: "192.168.1.1",
        }))
      : await getGuest({ id: guestId, skipCache: true })
    : undefined

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

    let scheduledTaskId: string | null = null
    if (session.metadata?.scheduledTaskId) {
      scheduledTaskId = session.metadata.scheduledTaskId
      console.log("📦 Found pending schedule ID in metadata:", scheduledTaskId)
    } else {
      console.log("⚠️ No scheduledTaskId in session metadata")
    }

    let newCredits = 0

    // Prefer an explicit request plan, then try to infer from session line items
    // (safer for one-off `payment` sessions where frontend might omit metadata),
    // then fall back to `session.metadata.plan` and finally default to `plus`.
    let plan = requestPlan as
      | "plus"
      | "pro"
      | "credits"
      | "grape"
      | "pear"
      | "coder"
      | "watermelon"
      | "tribe"
      | "molt"
      | undefined

    // If this was a one-time payment, prefer to infer plan from the line item
    if (!plan && session.mode === "payment" && session.line_items?.data?.[0]) {
      const item = session.line_items.data[0]
      const priceId = (item.price as any)?.id

      if (priceId) {
        if (
          priceId === process.env.STRIPE_PRICE_CREDITS_ID ||
          priceId === process.env.STRIPE_PRICE_CREDITS_TEST
        ) {
          plan = "credits"
        } else if (
          priceId === process.env.STRIPE_TRIBE ||
          priceId === process.env.STRIPE_TRIBE_TEST
        ) {
          plan = "tribe"
        } else if (
          priceId === process.env.STRIPE_MOLT ||
          priceId === process.env.STRIPE_MOLT_TEST
        ) {
          plan = "molt"
        }
      } else if ((item as any).price_data?.product_data?.name) {
        const name = (item as any).price_data.product_data.name.toLowerCase()
        if (name.includes("tribe")) plan = "tribe"
        else if (name.includes("molt")) plan = "molt"
        else if (name.includes("credit")) plan = "credits"
      }
    }

    if (!plan) {
      plan =
        (session.metadata?.plan as
          | "plus"
          | "pro"
          | "credits"
          | "grape"
          | "pear"
          | "coder"
          | "watermelon") || "plus"
    }

    console.log(
      `🚀 Derived plan:`,
      plan,
      "(metadata.plan:",
      session.metadata?.plan,
      ")",
    )

    const tier =
      requestTier ||
      (session.metadata?.tier as
        | "free"
        | "plus"
        | "pro"
        | "coder"
        | "architect"
        | "standard"
        | "sovereign"
        | undefined)

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

        user = await getUser({ id: user.id, skipCache: true })
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

        guest = await getGuest({ id: guest.id, skipCache: true })
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
            subject: `🎁 Your Vex ${capitalizeFirstLetter(plan)} Gift is Ready!`,
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

      // Create premium subscription for grape, pear, coder, watermelon plans
      if (
        ["grape", "pear", "coder", "watermelon"].includes(plan) &&
        tier &&
        tier !== "free" &&
        user
      ) {
        const productTypeMap: Record<string, string> = {
          grape: "grape_analytics",
          pear: "pear_feedback",
          coder: "sushi_debugger",
          watermelon: "watermelon_white_label",
        }

        // Always retrieve the full subscription object to ensure we have all properties
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id

        const stripeSubscription =
          await stripe.subscriptions.retrieve(subscriptionId)

        const subscriptionItem = stripeSubscription.items.data[0]
        if (!subscriptionItem) {
          console.error("❌ No subscription items found")
          throw new Error("Invalid subscription: no items")
        }

        try {
          await createPremiumSubscription({
            userId: user.id,
            stripeSubscriptionId: stripeSubscription.id,
            stripePriceId: subscriptionItem.price.id,
            stripeProductId: subscriptionItem.price.product as string,
            stripeCustomerId: stripeSubscription.customer as string,
            productType: productTypeMap[plan] as any,
            tier: tier as any,
            appId: app?.id,
            status: "active",
            currentPeriodStart: new Date(
              (stripeSubscription as any).current_period_start * 1000,
            ),
            currentPeriodEnd: new Date(
              (stripeSubscription as any).current_period_end * 1000,
            ),
            cancelAtPeriodEnd: false,
            metadata: {
              plan,
              tier,
              sessionId: session.id,
            } as any,
          })

          console.log(`✅ Premium subscription created: ${plan} (${tier})`, {
            userId: user.id,
            productType: productTypeMap[plan],
            tier,
          })

          // Initialize Pear feedback credits
          if (plan === "pear" && tier !== "free") {
            const pearCredits =
              tier === "plus" ? 5000 : tier === "pro" ? 50000 : 0

            if (pearCredits > 0) {
              // Update user's pearFeedbackCount
              await updateUser({
                ...user,
                pearFeedbackCount: pearCredits,
              })

              // Create transaction record
              await createFeedbackTransaction({
                appOwnerId: user.id,
                feedbackUserId: user.id,
                amount: pearCredits,
                commission: 0,
                transactionType: "monthly_allocation",
                pearTier: tier as "plus" | "pro",
                creditsRemaining: pearCredits,
                metadata: {
                  subscriptionId: stripeSubscription.id,
                },
              })

              console.log(
                `💎 Pear feedback credits allocated: ${pearCredits}`,
                {
                  userId: user.id,
                  tier,
                  pearFeedbackCount: pearCredits,
                },
              )
            }
          }
        } catch (error) {
          console.error("❌ Error creating premium subscription:", error)
          captureException(error)
        }
      }

      if (["plus", "pro"].includes(plan)) {
        const newSubscription = await createSubscription({
          provider: "stripe",
          subscriptionId:
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id,
          status: "active",
          userId: user?.id,
          guestId: guest?.id,
          plan: plan as "plus" | "pro",
          sessionId: session.id,
          appId: app?.id,
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
            sessionId: session.id,

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
            sessionId: session.id,
          })
        }

        // Process affiliate referral
        const affiliateCode = session.metadata?.affiliateCode
        if (affiliateCode) {
          try {
            const affiliateLink = await getAffiliateLink({
              code: affiliateCode,
            })

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

                user = await getUser({ id: user.id, skipCache: true })
              } else if (guest) {
                await updateGuest({
                  ...guest,
                  credits: newCredits + bonusCredits,
                })
                guest = await getGuest({ id: guest.id, skipCache: true })
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
      }

      return c.json({
        success: true,
        type: "subscription",
        gift: !!email,
        fingerprint: guest?.fingerprint || user?.fingerprint || newFingerprint,
      })
    }

    // Handle one-time credit purchase
    if (
      session.mode === "payment" &&
      session.line_items?.data[0] &&
      plan === "credits"
    ) {
      // Get the amount paid (in cents)
      const amountPaidCents = session.amount_total || 0
      const amountPaidEur = amountPaidCents / 100

      // Calculate credits: €0.01 per credit = 1 cent per credit
      // So: cents / 1 = credits (100 credits per euro)
      const creditsToAdd = amountPaidCents

      console.log(
        `💰 Credit purchase: €${amountPaidEur} (${amountPaidCents} cents) = ${creditsToAdd} credits`,
      )

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

            const purchaseAmount = amountPaidCents
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

        user = await getUser({ id: user.id, skipCache: true })
        if (!user) {
          return c.json({ error: "User not found" }, 404)
        }

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
          sessionId: session.id,
        })
      }

      if (guest) {
        await updateGuest({
          ...guest,
          credits: guest.credits + totalCredits,
        })

        guest = await getGuest({ id: guest.id, skipCache: true })
        if (!guest) {
          return c.json({ error: "Guest not found" }, 404)
        }

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
          sessionId: session.id,
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

      return c.json({
        success: true,
        type: "credits",
        creditsAdded: creditsToAdd,
        gift: !!email,
        credits: creditsToAdd,
        plan,
        totalPrice,
        fingerprint: guest?.fingerprint || user?.fingerprint || newFingerprint,
      })
    }

    // Handle Tribe/Molt flexible schedule payments
    if (
      session.mode === "payment" &&
      (plan === "tribe" || plan === "molt") &&
      session.line_items?.data[0]
    ) {
      const amountPaidCents = session.amount_total || 0
      const amountPaidEur = amountPaidCents / 100

      // Calculate credits based on payment (€5 per 1000 credits - must match createTribeSchedule.ts)
      const CREDITS_PRICE = 5.0 // EUR per 1000 credits
      const creditsReserved = Math.round((amountPaidEur / CREDITS_PRICE) * 1000)

      console.log(
        `💰 ${plan === "tribe" ? "Tribe" : "Molt"} payment: €${amountPaidEur} = ${creditsReserved} credits reserved (€${CREDITS_PRICE}/1000 credits)`,
      )

      // Note: creditTransaction already created in createSubscription as pending (amount=0)
      // It will be updated below when activating the schedule with actual creditsReserved amount

      // Activate pending schedule if scheduledTaskId exists in metadata
      if (scheduledTaskId) {
        if (!member) {
          return c.json({ error: "Member not found" }, 404)
        }
        const scheduledTask = await getScheduledJob({
          id: scheduledTaskId,
          userId: member?.id,
        })

        if (!scheduledTask) {
          return c.json({ error: "Scheduled task not found" }, 404)
        }

        try {
          console.log(`🔨 Activating pending schedule: ${scheduledTaskId}`)

          // Validate payment amount matches expected price
          // Skip validation if pendingPayment is 0 (newly created pending schedule)
          const expectedPrice = scheduledTask.pendingPayment
            ? scheduledTask.pendingPayment / 100
            : 0

          if (expectedPrice > 0) {
            const priceDifference = Math.abs(amountPaidEur - expectedPrice)
            const PRICE_TOLERANCE = 0.01 // 1 cent tolerance

            if (priceDifference > PRICE_TOLERANCE) {
              console.error(
                `❌ Price mismatch: Expected €${expectedPrice}, paid €${amountPaidEur}`,
              )
              return c.json({
                error: `Price mismatch: Expected €${expectedPrice}, paid €${amountPaidEur}`,
                sessionId: session.id,
              })
            }

            console.log(
              `✅ Price validated: €${amountPaidEur} matches expected €${expectedPrice}`,
            )
          } else {
            console.log(
              `⚠️ Newly created pending schedule (no prior price set) - accepting payment €${amountPaidEur}`,
            )
          }

          // Activate the pending schedule by updating its status
          const updatedSchedule = await updateScheduledJob({
            id: scheduledTaskId,
            status: "active",
            isPaid: true,
            stripePaymentIntentId: session.payment_intent as string,
            pendingPayment: 0,
            metadata: {
              ...scheduledTask.metadata,
            },
          })

          if (updatedSchedule) {
            console.log(
              `✅ ${plan === "tribe" ? "Tribe" : "Molt"} schedule activated successfully`,
              {
                scheduledTaskId: updatedSchedule.id,
                creditsReserved: creditsReserved,
                paidAmount: amountPaidEur,
                expectedAmount: expectedPrice,
              },
            )

            // Create credit transaction for tribe/molt payment
            if (member) {
              try {
                await createCreditTransaction({
                  userId: member.id,
                  guestId: null,
                  amount: creditsReserved,
                  balanceBefore: 0, // Tribe/Molt works with schedule credits, not user balance
                  balanceAfter: creditsReserved,
                  description: `${plan === "tribe" ? "Tribe" : "Molt"} schedule payment - ${creditsReserved} credits reserved`,
                  type: plan as "tribe" | "molt",
                  scheduleId: updatedSchedule.id,
                  sessionId: session.id,
                  metadata: {
                    sessionId: session.id,
                    scheduleType: plan,
                    creditsReserved: creditsReserved,
                    amountPaid: amountPaidEur,
                  },
                })

                console.log(
                  `✅ Created creditTransaction for ${plan} schedule`,
                  {
                    userId: member.id,
                    creditsReserved,
                    scheduleId: updatedSchedule.id,
                  },
                )
              } catch (txError) {
                console.error(
                  `⚠️ Failed to create creditTransaction for ${plan}:`,
                  txError,
                )
                // Don't fail payment if transaction logging fails
              }
            }
          } else {
            console.error(`❌ Failed to activate schedule: ${scheduledTaskId}`)
          }
        } catch (scheduleError) {
          console.error(
            `❌ Error activating ${plan} schedule after payment:`,
            scheduleError,
          )
          captureException(scheduleError)
          // Don't fail the entire response - payment is complete
        }
      }

      return c.json({
        success: true,
        type: plan,
        sessionId: session.id,
        creditsReserved,
        fingerprint: guest?.fingerprint || user?.fingerprint || newFingerprint,
      })
    }

    return c.json({ error: "Payment not completed" }, 400)
  } catch (err: any) {
    captureException(err)
    console.error("Payment verification error:", err)
    return c.json({ error: "Payment verification failed" }, 500)
  }
})
