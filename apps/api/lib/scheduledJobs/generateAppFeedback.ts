import {
  and,
  db,
  eq,
  getAiAgent,
  getSimpleApp as getApp,
  getMessages,
  getUser,
  gte,
  type scheduledJob,
  sql,
} from "@repo/db"
import { pearFeedback } from "@repo/db/src/schema"
import { sign } from "jsonwebtoken"
import { cleanAiResponse } from "../../lib/ai/cleanAiResponse"
import { sendDiscordNotification } from "../sendDiscordNotification"

// ==================== CONSTANTS ====================

const FEEDBACK_DAILY_QUOTA = 10 // Max feedbacks per app per day
const MIN_FEEDBACK_LENGTH = 200

const JWT_SECRET = process.env.AUTH_SECRET
const JWT_EXPIRY = "1h"
if (!JWT_SECRET && process.env.NODE_ENV !== "development") {
  throw new Error("AUTH_SECRET is not defined")
}
const SECRET = JWT_SECRET || "development-secret"

// ==================== TYPES ====================
export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

interface GeneratedAppFeedback {
  appIndex: number
  content: string
  feedbackType:
    | "suggestion"
    | "praise"
    | "complaint"
    | "feature_request"
    | "bug"
  category:
    | "ux"
    | "performance"
    | "feature"
    | "bug"
    | "ui_design"
    | "analytics"
    | "other"
  credits: number
}

interface AppContext {
  id: string
  name: string
  slug: string
  description?: string
  characterProfile?: string
}

function generateToken(userId: string, email: string): string {
  return sign({ userId, email }, SECRET, { expiresIn: JWT_EXPIRY })
}

// ==================== RATE LIMITING ====================

async function checkAppFeedbackQuota(
  sourceAppId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(pearFeedback)
    .where(
      and(
        eq(pearFeedback.sourceAppId, sourceAppId),
        eq(pearFeedback.source, "m2m"),
        gte(pearFeedback.createdOn, twentyFourHoursAgo),
      ),
    )

  const used = Number(result[0]?.count) || 0
  return {
    allowed: used < FEEDBACK_DAILY_QUOTA,
    remaining: Math.max(0, FEEDBACK_DAILY_QUOTA - used),
  }
}

async function checkAppFeedbackDedup(
  sourceAppId: string,
  targetAppId: string,
): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(pearFeedback)
    .where(
      and(
        eq(pearFeedback.sourceAppId, sourceAppId),
        eq(pearFeedback.appId, targetAppId),
        eq(pearFeedback.source, "m2m"),
        gte(pearFeedback.createdOn, twentyFourHoursAgo),
      ),
    )

  return Number(result[0]?.count) > 0
}

// ==================== METRICS ====================

function calculateAppFeedbackMetrics(
  credits: number,
  feedbackType: GeneratedAppFeedback["feedbackType"],
) {
  let baseSentiment = 0
  switch (feedbackType) {
    case "praise":
      baseSentiment = 0.9
      break
    case "suggestion":
    case "feature_request":
      baseSentiment = 0.5
      break
    case "complaint":
      baseSentiment = -0.3
      break
    case "bug":
      baseSentiment = -0.5
      break
  }

  const creditBonus = (credits - 6.5) * 0.08
  const sentimentScore = Math.max(-1, Math.min(1, baseSentiment + creditBonus))

  return {
    sentimentScore,
    specificityScore: credits >= 7 ? 0.85 : credits >= 5 ? 0.7 : 0.5,
    actionabilityScore: credits >= 7 ? 0.85 : credits >= 5 ? 0.7 : 0.4,
  }
}

// ==================== STORAGE ====================

async function storeAppFeedback({
  content,
  sourceAppId,
  targetAppId,
  reviewingUserId,
  reviewingGuestId,
  feedbackType,
  category,
  credits,
}: {
  content: string
  sourceAppId: string
  targetAppId: string
  reviewingUserId?: string | null
  reviewingGuestId?: string | null
  feedbackType: GeneratedAppFeedback["feedbackType"]
  category: GeneratedAppFeedback["category"]
  credits: number
}): Promise<void> {
  const metrics = calculateAppFeedbackMetrics(credits, feedbackType)

  await db.insert(pearFeedback).values({
    content,
    userId: reviewingUserId ?? undefined,
    guestId: reviewingGuestId ?? undefined,
    appId: targetAppId,
    feedbackType,
    category,
    sentimentScore: metrics.sentimentScore,
    specificityScore: metrics.specificityScore,
    actionabilityScore: metrics.actionabilityScore,
    status: "reviewed",
    source: "m2m",
    sourceAppId,
  })
}

// ==================== SYSTEM PROMPTS ====================

function buildSystemPrompt(context: {
  step: number
  stepName: string
  reviewingApp: AppContext
  targetApp: AppContext
  pearApp: AppContext
  vaultApp: AppContext
  grapeApp: AppContext
  storeApp?: AppContext
  previousAnalysis?: string
  creditScore?: number
  feedbackType?: string
}): string {
  const {
    step,
    stepName,
    reviewingApp,
    targetApp,
    pearApp,
    vaultApp,
    grapeApp,
    storeApp,
    previousAnalysis,
    creditScore,
    feedbackType,
  } = context

  let prompt = `🍐 PEAR M2M FEEDBACK PROTOCOL - STEP ${step}/6: ${stepName}

═══════════════════════════════════════════════════════════
CURRENT POSITION IN PIPELINE
═══════════════════════════════════════════════════════════
You are at STEP ${step} of 6 in the Machine-to-Machine App Review Pipeline.
Each step enriches the context and builds toward a comprehensive ecosystem assessment.

═══════════════════════════════════════════════════════════
ECOSYSTEM PARTICIPANTS
═══════════════════════════════════════════════════════════
👤 REVIEWER: ${reviewingApp.name} (${reviewingApp.slug})
   Role: Initiates peer review with technical/UX assessment
   Character: ${reviewingApp.characterProfile || "Professional reviewer"}

🎯 TARGET: ${targetApp.name} (${targetApp.slug})
   Role: Receives feedback, responds to critique
   Description: ${targetApp.description || "App under review"}

⚖️ PEAR: ${pearApp.name} (${pearApp.slug})
   Role: Validates feedback quality, assigns credit scores
   Function: Quality assurance for the Wine ecosystem

🏦 VAULT: ${vaultApp.name} (${vaultApp.slug})
   Role: Financial ledger, credit accounting, reward distribution
   Function: Immutable record-keeping for economic activity

🍇 GRAPE: ${grapeApp.name} (${grapeApp.slug})
   Role: Wine ecosystem coordinator, community insights
   Function: Cross-app pattern recognition, ecosystem health

🏪 STORE: ${storeApp?.name || "Platform Store"}
   Role: Final arbiter, platform-wide synthesis
   Function: Aggregates all perspectives into unified view

═══════════════════════════════════════════════════════════
`

  // Add step-specific context
  if (step > 1 && previousAnalysis) {
    prompt += `PREVIOUS ANALYSIS (Step ${step - 1}):\n${previousAnalysis}\n\n`
  }

  if (creditScore !== undefined) {
    prompt += `CREDIT SCORE ASSIGNED: ${creditScore}/10 (${feedbackType})\n\n`
  }

  // Add step-specific instructions
  switch (step) {
    case 1:
      prompt += `═══════════════════════════════════════════════════════════
STEP 1: INITIAL PEER REVIEW
═══════════════════════════════════════════════════════════
As ${reviewingApp.name}, you are conducting a professional peer review of ${targetApp.name}.

Your task:
- Analyze character profile and personality expression
- Evaluate recent posts and content quality
- Assess app features, tips, and highlights
- Review overall platform presence and value proposition

Provide specific, actionable feedback as JSON:
{
  "content": "detailed feedback (200-1000 chars)",
  "feedbackType": "suggestion|praise|complaint|feature_request|bug",
  "category": "ux|feature|ui_design|analytics|performance|other",
  "credits": 3-10 (quality score based on specificity and actionability)
}`
      break

    case 2:
      prompt += `═══════════════════════════════════════════════════════════
STEP 2: PEAR CREDIT VALIDATION
═══════════════════════════════════════════════════════════
As PEAR, you validate the quality assessment provided by ${reviewingApp.name}.

Context: ${reviewingApp.name} just reviewed ${targetApp.name} and assigned ${creditScore}/10 credits.
Feedback type: ${feedbackType}

Your task:
- Analyze the fairness and accuracy of the credit assignment
- Consider if the feedback quality matches the credit score
- Provide brief validation commentary on the assessment
- This is quality assurance for the Wine ecosystem

Respond with your expert validation perspective.`
      break

    case 3:
      prompt += `═══════════════════════════════════════════════════════════
STEP 3: TARGET APP RESPONSE
═══════════════════════════════════════════════════════════
As ${targetApp.name}, you are responding to the peer review from ${reviewingApp.name}.

Review received: "${previousAnalysis?.substring(0, 200)}..."
Credit score: ${creditScore}/10

Your task:
- Acknowledge the feedback graciously
- Address specific points raised by the reviewer
- Share insights about your design decisions
- Demonstrate how you'll incorporate the feedback
- Maintain your app's unique personality and voice

This is your opportunity to engage in constructive dialogue.`
      break

    case 4:
      prompt += `═══════════════════════════════════════════════════════════
STEP 4: VAULT FINANCIAL RECORD
═══════════════════════════════════════════════════════════
As VAULT, you are recording this economic transaction in the Wine ecosystem ledger.

Transaction details:
- Reviewer: ${reviewingApp.name}
- Target: ${targetApp.name}
- Credit score: ${creditScore}/10
- Feedback type: ${feedbackType}

Your task:
- Document the credit flow in formal financial terms
- Record the economic impact of this peer review
- Maintain immutable ledger entry style
- Note any patterns for ecosystem economics analysis

This is the financial backbone of the Wine ecosystem.`
      break

    case 5:
      prompt += `═══════════════════════════════════════════════════════════
STEP 5: GRAPE ECOSYSTEM INSIGHTS
═══════════════════════════════════════════════════════════
As GRAPE, you analyze this interaction for Wine ecosystem health.

Review context:
- ${reviewingApp.name} → ${targetApp.name}: ${creditScore}/10 (${feedbackType})

Your task:
- Identify cross-app patterns and trends
- Assess ecosystem collaboration quality
- Provide insights on community dynamics
- Suggest ecosystem-wide improvements
- Highlight exemplary peer review practices

You see the big picture across all Wine ecosystem apps.`
      break

    case 6:
      prompt += `═══════════════════════════════════════════════════════════
STEP 6: STORE PLATFORM SYNTHESIS
═══════════════════════════════════════════════════════════
As the Platform Store, you provide the final authoritative perspective.

Complete pipeline history:
1. ${reviewingApp.name} conducted peer review
2. PEAR validated credit score: ${creditScore}/10
3. ${targetApp.name} responded to feedback
4. VAULT recorded financial transaction
5. GRAPE analyzed ecosystem impact

Your task:
- Synthesize all perspectives into unified platform view
- Provide final assessment of the interaction quality
- Offer platform-level recommendations
- Acknowledge contributors to ecosystem health
- Close the feedback loop with authoritative voice

You are the curator of the entire ecosystem.`
      break
  }

  prompt += `

═══════════════════════════════════════════════════════════
RESPONSE INSTRUCTIONS
═══════════════════════════════════════════════════════════
- Respond in character as the current step's persona
- Reference other apps by name to show ecosystem awareness
- Keep tone professional yet conversational
- Demonstrate understanding of the Wine ecosystem philosophy
- This message will be visible to users in the conversation thread`

  return prompt
}

// ==================== AI CALL HELPER ====================

async function callAiRoute({
  baseUrl,
  token,
  messageId,
  agentId,
  appId,
  context,
  stream = false,
  pear,
  jobId,
}: {
  baseUrl: string
  token: string
  messageId: string
  agentId: string
  appId: string
  context?: string
  stream?: boolean
  pear?: string
  jobId?: string
}) {
  const response = await fetch(`${baseUrl}/ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messageId,
      agentId,
      appId,
      stream,
      pear,
      jobId,
      ...(context && { systemPromptContext: context }),
    }),
  })

  if (!response.ok) {
    throw new Error(`AI route failed: ${response.status}`)
  }

  return response.json()
}

// ==================== MAIN FUNCTION ====================

export async function generateAppFeedback({
  targetAppIds,
  job,
}: {
  targetAppIds: string[]
  job: scheduledJob
}): Promise<{
  success: boolean
  feedbackCount: number
  errors: string[]
}> {
  const errors: string[] = []
  let feedbackCount = 0

  // Fetch all required apps
  const reviewingApp = job.appId ? await getApp({ id: job.appId }) : null
  const grape = await getApp({ slug: "grape", isSystem: true })
  const pear = await getApp({ slug: "pear", isSystem: true })
  const vault = await getApp({ slug: "vault", isSystem: true })
  const store = await getApp({ slug: "chrry", isSystem: true })

  if (!reviewingApp) throw new Error("ReviewingApp is not found")
  if (!grape) throw new Error("Grape is not found")
  if (!pear) throw new Error("Pear is not found")
  if (!vault) throw new Error("Vault is not found")

  const reviewingUserId = reviewingApp.userId
  const reviewingGuestId = reviewingApp.guestId
  const user = reviewingUserId ? await getUser({ id: reviewingUserId }) : null

  const selectedAgent = await getAiAgent({ name: "sushi" })
  if (!selectedAgent) throw new Error("Sushi agent not found")

  if (!user?.email) {
    throw new Error("User email is required for JWT token generation")
  }

  const token = generateToken(reviewingUserId!, user.email)
  const baseUrl = process.env.API_INTERNAL_URL || "http://localhost:3001/api"

  // Helper to get latest message ID
  const getLatestMessageId = async (threadId: string) => {
    const messages = await getMessages({
      userId: user.id,
      threadId,
      pageSize: 1,
    })
    return messages?.messages?.[0]?.message?.id
  }

  try {
    if (!targetAppIds || targetAppIds.length === 0) {
      console.log(`🍐 No target apps specified for ${reviewingApp.name}`)
      return { success: true, feedbackCount: 0, errors: [] }
    }

    // Check daily quota
    const quota = await checkAppFeedbackQuota(reviewingApp.id)
    if (!quota.allowed) {
      console.log(`🍐 App feedback quota exceeded for ${reviewingApp.name}`)
      return { success: true, feedbackCount: 0, errors: [] }
    }

    // Filter valid targets
    const validTargetIds = targetAppIds
      .filter((id) => id !== reviewingApp.id) // Skip self
      .filter((id, index, arr) => arr.indexOf(id) === index) // Deduplicate
      .slice(0, quota.remaining)

    if (validTargetIds.length === 0) {
      return { success: true, feedbackCount: 0, errors: [] }
    }

    // Process each target app
    for (const targetAppId of validTargetIds) {
      try {
        const targetApp = await getApp({ id: targetAppId })
        if (!targetApp) {
          console.log(`🍐 Target app ${targetAppId} not found`)
          continue
        }

        // Check for duplicate
        const alreadyStored = await checkAppFeedbackDedup(
          reviewingApp.id,
          targetAppId,
        )
        if (alreadyStored) continue

        console.log(
          `🍐 Starting M2M pipeline: ${reviewingApp.name} → ${targetApp.name}`,
        )

        // Create app contexts (filter out null values)
        const appContexts = {
          reviewingApp: {
            id: reviewingApp.id,
            name: reviewingApp.name,
            slug: reviewingApp.slug,
            ...(reviewingApp.description && {
              description: reviewingApp.description,
            }),
          },
          targetApp: {
            id: targetApp.id,
            name: targetApp.name,
            slug: targetApp.slug,
            ...(targetApp.description && {
              description: targetApp.description,
            }),
          },
          pearApp: { id: pear.id, name: pear.name, slug: pear.slug },
          vaultApp: { id: vault.id, name: vault.name, slug: vault.slug },
          grapeApp: { id: grape.id, name: grape.name, slug: grape.slug },
          storeApp: store
            ? { id: store.id, name: store.name, slug: store.slug }
            : undefined,
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Initial Review - ReviewingApp creates user message
        // ═══════════════════════════════════════════════════════════
        console.log(
          `🍐 Step 1/6: ${reviewingApp.name} reviewing ${targetApp.name}`,
        )

        const step1Prompt = buildSystemPrompt({
          step: 1,
          stepName: "INITIAL PEER REVIEW",
          ...appContexts,
        })

        const userMessageResponse = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: step1Prompt,
            appId: reviewingApp.id,
            agentId: selectedAgent.id,
            pearAppId: targetApp.id,
          }),
        })

        if (!userMessageResponse.ok) {
          throw new Error(`Step 1 failed: ${userMessageResponse.status}`)
        }

        const userMessageData = await userMessageResponse.json()
        const threadId =
          userMessageData.message?.message?.threadId || userMessageData.threadId
        const messageId =
          userMessageData.message?.message?.id || userMessageData.id

        if (!threadId || !messageId) {
          throw new Error("Missing threadId or messageId")
        }

        // Call AI for initial review
        const aiResult = await callAiRoute({
          baseUrl,
          token,
          messageId,
          agentId: selectedAgent.id,
          appId: reviewingApp.id,
          context: step1Prompt,
          stream: false,
          jobId: job?.id,
        })

        // Parse feedback
        let feedback: GeneratedAppFeedback
        try {
          const text = aiResult.content || aiResult.text || ""
          feedback = JSON.parse(cleanAiResponse(text))
        } catch (parseError) {
          console.error(`🍐 Failed to parse feedback:`, parseError)
          errors.push(`${targetAppId}: parse_error`)
          continue
        }

        if (
          !feedback.content ||
          feedback.content.length < MIN_FEEDBACK_LENGTH
        ) {
          console.log(`🍐 Feedback too short for ${targetApp.name}`)
          errors.push(`${targetAppId}: too_short`)
          continue
        }

        const credits = Math.min(10, Math.max(3, feedback.credits))

        // Store feedback
        await storeAppFeedback({
          content: feedback.content,
          sourceAppId: reviewingApp.id,
          targetAppId,
          reviewingUserId,
          reviewingGuestId,
          feedbackType: feedback.feedbackType,
          category: feedback.category,
          credits,
        })

        feedbackCount++
        console.log(
          `🍐 Step 1 complete: ${credits} credits (${feedback.feedbackType})`,
        )

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Pear Credit Validation
        // ═══════════════════════════════════════════════════════════
        await wait(2000)
        console.log(`🍐 Step 2/6: Pear validating credit assessment`)

        const step2Prompt = buildSystemPrompt({
          step: 2,
          stepName: "PEAR CREDIT VALIDATION",
          ...appContexts,
          previousAnalysis: feedback.content,
          creditScore: credits,
          feedbackType: feedback.feedbackType,
        })

        let latestMessageId = await getLatestMessageId(threadId)
        if (latestMessageId) {
          await callAiRoute({
            baseUrl,
            token,
            messageId: latestMessageId,
            agentId: selectedAgent.id,
            appId: pear.id,
            context: step2Prompt,
            jobId: job?.id,
          })
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Target App Response
        // ═══════════════════════════════════════════════════════════
        await wait(2000)
        console.log(`🍐 Step 3/6: ${targetApp.name} responding to review`)

        const step3Prompt = buildSystemPrompt({
          step: 3,
          stepName: "TARGET APP RESPONSE",
          ...appContexts,
          previousAnalysis: feedback.content,
          creditScore: credits,
          feedbackType: feedback.feedbackType,
        })

        latestMessageId = await getLatestMessageId(threadId)
        if (latestMessageId) {
          await callAiRoute({
            baseUrl,
            token,
            messageId: latestMessageId,
            agentId: selectedAgent.id,
            appId: targetApp.id,
            context: step3Prompt,
            jobId: job?.id,
          })
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Vault Financial Record
        // ═══════════════════════════════════════════════════════════
        await wait(2000)
        console.log(`🍐 Step 4/6: Vault recording transaction`)

        const step4Prompt = buildSystemPrompt({
          step: 4,
          stepName: "VAULT FINANCIAL RECORD",
          ...appContexts,
          previousAnalysis: feedback.content,
          creditScore: credits,
          feedbackType: feedback.feedbackType,
        })

        latestMessageId = await getLatestMessageId(threadId)
        if (latestMessageId) {
          await callAiRoute({
            baseUrl,
            token,
            messageId: latestMessageId,
            agentId: selectedAgent.id,
            appId: vault.id,
            context: step4Prompt,
            stream: false,
            jobId: job?.id,
          })
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Grape Ecosystem Insights
        // ═══════════════════════════════════════════════════════════
        await wait(2000)
        console.log(`🍐 Step 5/6: Grape analyzing ecosystem impact`)

        const step5Prompt = buildSystemPrompt({
          step: 5,
          stepName: "GRAPE ECOSYSTEM INSIGHTS",
          ...appContexts,
          previousAnalysis: feedback.content,
          creditScore: credits,
          feedbackType: feedback.feedbackType,
        })

        latestMessageId = await getLatestMessageId(threadId)
        if (latestMessageId) {
          await callAiRoute({
            baseUrl,
            token,
            messageId: latestMessageId,
            agentId: selectedAgent.id,
            appId: grape.id,
            context: step5Prompt,
            jobId: job?.id,
          })
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Store Platform Synthesis (if store exists)
        // ═══════════════════════════════════════════════════════════
        if (store) {
          await wait(2000)
          console.log(`🍐 Step 6/6: Store synthesizing platform view`)

          const step6Prompt = buildSystemPrompt({
            step: 6,
            stepName: "STORE PLATFORM SYNTHESIS",
            ...appContexts,
            previousAnalysis: feedback.content,
            creditScore: credits,
            feedbackType: feedback.feedbackType,
          })

          latestMessageId = await getLatestMessageId(threadId)
          if (latestMessageId) {
            await callAiRoute({
              baseUrl,
              token,
              messageId: latestMessageId,
              agentId: selectedAgent.id,
              appId: store.id,
              context: step6Prompt,
              stream: false,
              jobId: job?.id,
            })
          }
        }

        console.log(
          `🍐 M2M pipeline complete: ${reviewingApp.name} → ${targetApp.name}`,
        )
      } catch (error) {
        console.error(`🍐 Error processing ${targetAppId}:`, error)
        errors.push(
          `${targetAppId}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    // Discord notification
    if (feedbackCount > 0) {
      sendDiscordNotification(
        {
          embeds: [
            {
              title: "🍐 M2M App Feedback Pipeline Complete",
              color: 0x10b981,
              fields: [
                { name: "Reviewer", value: reviewingApp.name, inline: true },
                { name: "Feedbacks", value: `${feedbackCount}`, inline: true },
                {
                  name: "Pipeline",
                  value: "6-Step M2M Protocol",
                  inline: false,
                },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        },
        process.env.DISCORD_TRIBE_WEBHOOK_URL,
      ).catch(console.error)
    }

    return { success: true, feedbackCount, errors }
  } catch (error) {
    console.error("🍐 App feedback fatal error:", error)
    return {
      success: false,
      feedbackCount,
      errors: [
        ...errors,
        error instanceof Error ? error.message : String(error),
      ],
    }
  }
}
