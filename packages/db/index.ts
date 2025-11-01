import { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  accounts,
  affiliateLinks,
  affiliatePayouts,
  affiliateReferrals,
  aiAgents,
  calendarEvents,
  characterProfiles,
  cities,
  collaborations,
  creditTransactions,
  creditUsage,
  devices,
  documentChunks,
  GUEST_CREDITS_PER_MONTH,
  guests,
  invitations,
  memories,
  messageEmbeddings,
  messages,
  stores,
  pushSubscriptions,
  subscriptions,
  systemLogs,
  threads,
  threadSummaries,
  users,
  placeHolders,
  verificationTokens,
  instructions,
  apps,
  affiliateClicks,
  sharedExpenses,
  expenses,
  budgets,
  installs,
  teams,
  storeInstalls,
  appOrders,
  appExtend,
} from "./src/schema"
import { v4 as uuidv4 } from "uuid"
import * as schema from "./src/schema"
import { drizzle as postgresDrizzle } from "drizzle-orm/postgres-js"
import { generateApiKey } from "./src/utils/apiKey"
import {
  and,
  eq,
  inArray,
  or,
  desc,
  asc,
  count,
  sum,
  sql,
  gte,
  isNotNull,
  lte,
  isNull,
  ilike,
  max,
  exists,
} from "drizzle-orm"
import postgres from "postgres"

import * as dotenv from "dotenv"
import * as bcrypt from "bcrypt"
import { appWithStore } from "chrry/types"

dotenv.config()

export const TEST_MEMBER_EMAILS =
  process.env.TEST_MEMBER_EMAILS?.split(",") || []
export const TEST_GUEST_FINGERPRINTS =
  process.env.TEST_GUEST_FINGERPRINTS?.split(",") || []
export const TEST_MEMBER_FINGERPRINTS =
  process.env.TEST_MEMBER_FINGERPRINTS?.split(",") || []

// Define locally to avoid circular dependency issues with chrry/utils
export const OWNER_CREDITS = 999999

type OwnerCheck = {
  userId?: string | null
  guestId?: string | null
}

export const isOwner = (
  owner?: OwnerCheck,
  ctx?: { userId?: string | null; guestId?: string | null },
): boolean => {
  if (!owner || !ctx) return false
  if (owner.userId && ctx.userId === owner.userId) return true
  if (owner.guestId && ctx.guestId === owner.guestId) return true
  return false
}

declare global {
  // eslint-disable-next-line no-var -- only var works here
  // eslint-disable-next-line no-unused-vars
  var db: PostgresJsDatabase<typeof schema> | undefined
}
export type user = typeof users.$inferSelect
export type newUser = typeof users.$inferInsert

export type appOrder = typeof appOrders.$inferSelect
export type newAppOrder = typeof appOrders.$inferInsert

export type appExtend = typeof appExtend.$inferSelect
export type newAppExtend = typeof appExtend.$inferInsert

export type storeInstall = typeof storeInstalls.$inferSelect
export type newStoreInstall = typeof storeInstalls.$inferInsert

export type message = typeof messages.$inferSelect
export type newMessage = typeof messages.$inferInsert
export type sharedExpense = typeof sharedExpenses.$inferSelect
export type newSharedExpense = typeof sharedExpenses.$inferInsert
export type account = typeof accounts.$inferSelect
export type newAccount = typeof accounts.$inferInsert
export type affiliateClick = typeof affiliateClicks.$inferSelect
export type newAffiliateClick = typeof affiliateClicks.$inferInsert
export type verificationToken = typeof verificationTokens.$inferSelect
export type newVerificationToken = typeof verificationTokens.$inferInsert

export type store = typeof stores.$inferSelect
export type newStore = typeof stores.$inferInsert

export type guest = typeof guests.$inferSelect
export type newGuest = typeof guests.$inferInsert

export type subscription = typeof subscriptions.$inferSelect
export type newSubscription = typeof subscriptions.$inferInsert

export type device = typeof devices.$inferSelect
export type newDevice = typeof devices.$inferInsert

export type thread = typeof threads.$inferSelect
export type newThread = typeof threads.$inferInsert

export type aiAgent = typeof aiAgents.$inferSelect
export type newAiAgent = typeof aiAgents.$inferInsert

export type systemLog = typeof systemLogs.$inferSelect
export type newSystemLog = typeof systemLogs.$inferInsert

export type collaboration = typeof collaborations.$inferSelect
export type newCollaboration = typeof collaborations.$inferInsert

export type creditUsage = typeof creditUsage.$inferSelect
export type newCreditUsage = typeof creditUsage.$inferInsert

export type invitation = typeof invitations.$inferSelect
export type newInvitation = typeof invitations.$inferInsert

export type documentChunk = typeof documentChunks.$inferSelect
export type newDocumentChunk = typeof documentChunks.$inferInsert

export type messageEmbedding = typeof messageEmbeddings.$inferSelect
export type newMessageEmbedding = typeof messageEmbeddings.$inferInsert

export type threadSummary = typeof threadSummaries.$inferSelect
export type newThreadSummary = typeof threadSummaries.$inferInsert

export type memory = typeof memories.$inferSelect
export type newMemory = typeof memories.$inferInsert

export type characterProfile = typeof characterProfiles.$inferSelect
export type newCharacterProfile = typeof characterProfiles.$inferInsert

export type pushSubscription = typeof pushSubscriptions.$inferSelect
// export type newPushSubscription = typeof pushSubscriptions.$inferInsert;

export type creditTransaction = typeof creditTransactions.$inferSelect
export type newCreditTransaction = typeof creditTransactions.$inferInsert

export type calendarEvent = typeof calendarEvents.$inferSelect
export type newCalendarEvent = typeof calendarEvents.$inferInsert

export type city = typeof cities.$inferSelect
export type newCity = typeof cities.$inferInsert

export type affiliateReferral = typeof affiliateReferrals.$inferSelect
export type newAffiliateReferral = typeof affiliateReferrals.$inferInsert

export type affiliatePayout = typeof affiliatePayouts.$inferSelect
export type newAffiliatePayout = typeof affiliatePayouts.$inferInsert

export type affiliateLink = typeof affiliateLinks.$inferSelect
export type newAffiliateLink = typeof affiliateLinks.$inferInsert

export type placeHolder = typeof placeHolders.$inferSelect
export type newPlaceHolder = typeof placeHolders.$inferInsert

export type instruction = typeof instructions.$inferSelect
export type newInstruction = typeof instructions.$inferInsert

export type app = typeof apps.$inferSelect
export type newApp = typeof apps.$inferInsert

export type affiliateClicks = typeof affiliateClicks.$inferSelect
export type newAffiliateClicks = typeof affiliateClicks.$inferInsert

export type expense = typeof expenses.$inferSelect
export type newExpense = typeof expenses.$inferInsert

export type budget = typeof budgets.$inferSelect
export type newBudget = typeof budgets.$inferInsert

export type install = typeof installs.$inferSelect
export type newInstall = typeof installs.$inferInsert

export type team = typeof teams.$inferSelect
export type newTeam = typeof teams.$inferInsert

export type NewCustomPushSubscription = {
  endpoint: string
  createdOn: Date
  updatedOn: Date
  keys: {
    p256dh: string
    auth: string
  }
}

export type CustomPushSubscription = NewCustomPushSubscription & {
  id: string
}

export let db: PostgresJsDatabase<typeof schema>

export type messageActionType = {
  type: string
  params?: Record<string, any>
  times?: number // Number of times to repeat this action (for calendar navigation, etc.)
  completed?: boolean
  result?: unknown
  remember?: boolean
}

const NODE_ENV = process.env.NODE_ENV

const connectionString = process.env.DB_URL

if (!connectionString) {
  throw new Error(
    "DB_URL environment variable is not set. Please configure your database connection string.",
  )
}

const client = postgres(connectionString)

if (NODE_ENV !== "production") {
  if (!global.db) global.db = postgresDrizzle(client, { schema })
  db = global.db
} else {
  db = postgresDrizzle(client, { schema })
}

export function sanitizeSearchTerm(search: string): string {
  // Remove any non-alphanumeric characters except spaces
  return search.replace(/[^a-zA-Z0-9\s]/g, "")
}

export function formatSearchTerm(search: string): string {
  return sanitizeSearchTerm(search)
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => word + ":*")
    .join(" & ")
}

export function passwordToSalt(password: string) {
  const saltRounds = 10
  const hash = bcrypt.hashSync(password, saltRounds)
  return hash
}

// Privacy-friendly credit tracking functions
export async function logCreditUsage({
  userId,
  guestId,
  agentId,
  messageType,
  threadId,
  messageId,
  appId,
  // isWebSearchEnabled,
  ...rest
}: {
  userId?: string
  guestId?: string
  agentId: string
  creditCost: number
  messageType: "user" | "ai" | "image" | "search"
  threadId?: string
  messageId?: string
  appId?: string
  // isWebSearchEnabled?: boolean
}) {
  let creditCost = rest.creditCost || 1

  // // Additional credit for AI-enhanced web search
  // if (isWebSearchEnabled) {
  //   creditCost += 1
  // }
  try {
    await db!.insert(creditUsage).values({
      userId,
      guestId,
      agentId,
      creditCost,
      messageType,
      threadId,
      messageId,
      appId,
    })

    console.log("💰 Credit usage logged:", {
      user: (userId || guestId)?.substring(0, 8),
      agent: agentId.substring(0, 8),
      credits: creditCost,
      type: messageType,
    })
  } catch (error) {
    console.error("❌ Error logging credit usage:", error)
    // Don't throw - credit logging failure shouldn't block message creation
  }
}

// Calculate total credits spent by a user in a given month (privacy-friendly)
export async function getCreditsSpent({
  userId,
  guestId,
  month,
}: {
  userId?: string
  guestId?: string
  month?: number
}): Promise<number> {
  try {
    const currentDate = new Date()
    const targetMonth = month !== undefined ? month : currentDate.getMonth()
    const targetYear = currentDate.getFullYear()

    const startOfMonth = new Date(Date.UTC(targetYear, targetMonth, 1))
    const endOfMonth = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999),
    )

    // Get credits from the dedicated credit usage table
    const result = await db!
      .select({ totalCredits: sum(creditUsage.creditCost) })
      .from(creditUsage)
      .where(
        and(
          userId ? eq(creditUsage.userId, userId) : undefined,
          guestId ? eq(creditUsage.guestId, guestId) : undefined,
          gte(creditUsage.createdOn, startOfMonth),
          lte(creditUsage.createdOn, endOfMonth),
        ),
      )

    const totalCredits = Number(result[0]?.totalCredits) || 0

    console.log("💰 Total credits spent:", totalCredits)
    return totalCredits
  } catch (error) {
    console.error("❌ Error calculating credits spent:", error)
    return 0 // Return 0 on error to prevent blocking user
  }
}

// Get hourly usage count for rate limiting (privacy-friendly)
export async function getHourlyUsage({
  userId,
  guestId,
}: {
  userId?: string
  guestId?: string
}): Promise<number> {
  try {
    const oneHourAgo = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
        new Date().getUTCHours() - 1,
        new Date().getUTCMinutes(),
        new Date().getUTCSeconds(),
      ),
    )

    const result = await db!
      .select({ count: count() })
      .from(creditUsage)
      .where(
        and(
          userId ? eq(creditUsage.userId, userId) : undefined,
          guestId ? eq(creditUsage.guestId, guestId) : undefined,
          gte(creditUsage.createdOn, oneHourAgo),
        ),
      )

    const hourlyCount = result[0]?.count || 0

    console.log("⏰ Hourly usage:", {
      user: (userId || guestId)?.substring(0, 8),
      count: hourlyCount,
      since: oneHourAgo.toISOString(),
    })

    return hourlyCount
  } catch (error) {
    console.error("❌ Error calculating hourly usage:", error)
    return 0
  }
}
export const createSystemLog = async (systemLog: newSystemLog) => {
  let safeObject = systemLog.object
  if (systemLog.object instanceof Error) {
    safeObject = {
      ...systemLog.object, // include other enumerable properties, if any
      name: systemLog.object.name,
      message: systemLog.object.message,
      stack: systemLog.object.stack,
    }
  }

  try {
    const [inserted] = await db
      .insert(systemLogs)
      .values({
        ...systemLog,
        object: safeObject,
      })
      .returning()

    return inserted
  } catch (error) {
    console.error("Error creating system log:", error)
    return null
  }
}

export const getUser = async ({
  email,
  id,
  password,
  stripeSubscriptionId,
  stripeSessionId,
  verificationToken,
  appleId,
  fingerprint,
  userName,
  apiKey,
  app,
}: {
  email?: string
  id?: string
  password?: string
  stripeSubscriptionId?: string
  stripeSessionId?: string
  verificationToken?: string
  appleId?: string
  fingerprint?: string
  userName?: string
  apiKey?: string
  app?: app | null
}) => {
  const result = (
    await db
      .select()
      .from(users)
      .leftJoin(
        verificationTokens,
        eq(users.email, verificationTokens.identifier),
      )
      .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
      .where(
        and(
          fingerprint ? eq(users.fingerprint, fingerprint) : undefined,
          email ? eq(users.email, email) : undefined,
          id ? eq(users.id, id) : undefined,
          password ? eq(users.password, password) : undefined,
          stripeSubscriptionId
            ? and(
                eq(subscriptions.provider, "stripe"),
                eq(subscriptions.subscriptionId, stripeSubscriptionId),
              )
            : undefined,
          stripeSessionId
            ? and(
                eq(subscriptions.provider, "stripe"),
                eq(subscriptions.sessionId, stripeSessionId),
              )
            : undefined,
          verificationToken
            ? eq(verificationTokens.token, verificationToken)
            : undefined,
          appleId ? eq(users.appleId, appleId) : undefined,
          userName ? eq(users.userName, userName) : undefined,
          apiKey ? eq(users.apiKey, apiKey) : undefined,
        ),
      )
  ).at(0)

  const googleAccount = result
    ? await getAccount({ userId: result.user.id, provider: "google" })
    : undefined

  const appleAccount = result
    ? await getAccount({ userId: result.user.id, provider: "apple" })
    : undefined

  const now = new Date()
  const oneHourAgo = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() - 1,
      now.getUTCMinutes(),
      now.getUTCSeconds(),
    ),
  )

  const memoriesCount = result
    ? await getMemories({
        userId: result.user.id,
      }).then((res) => res.totalCount)
    : undefined

  const lastMessage = result
    ? await getMessages({
        userId: result.user.id,
        pageSize: 1,
      })
    : undefined

  const isAppOwner =
    result &&
    app &&
    isOwner(app, {
      userId: result.user.id,
    })

  const subscription = result
    ? await getSubscription({ userId: result.user.id })
    : undefined

  // Calculate credits spent
  const creditsSpent = result
    ? await getCreditsSpent({
        userId: result.user.id,
        month: new Date().getMonth(),
      })
    : 0

  // If user owns the app they're using, show infinite credits (999999)
  const creditsLeft = isAppOwner
    ? OWNER_CREDITS
    : Math.max(result ? result.user.credits - creditsSpent : 0, 0)

  return result
    ? {
        isLinkedToGoogle: !!googleAccount,
        isLinkedToApple: !!appleAccount,
        hasCalendarScope:
          googleAccount?.scope?.includes("calendar.events") ?? false,
        hasRefreshToken: !!googleAccount?.refresh_token,
        messagesLastHour: await getMessages({
          userId: result.user.id,
          createdAfter: oneHourAgo,
          aiAgent: true,
          pageSize: 1,
        }).then((res) => res.totalCount),
        creditsLeft,
        instructions: await getInstructions({
          userId: result.user.id,
          pageSize: 7, // 7 instructions per app
          perApp: true, // Get 7 per app (Atlas, Bloom, Peach, Vault, General) = 35 total
        }),
        placeHolder: await getPlaceHolder({
          userId: result.user.id,
        }),
        memoriesCount,
        characterProfiles: await getCharacterProfiles({
          userId: result.user.id,
          pinned: true,
        }),
        lastMessage: lastMessage?.messages.at(0)?.message,
        messageCount: lastMessage?.totalCount,

        subscription,
        ...result.user,
      }
    : undefined
}

export const getCharacterProfiles = async ({
  userId,
  guestId,
  visibility,
  pinned,
  threadId,
}: {
  userId?: string
  guestId?: string
  visibility?: "public" | "private"
  pinned?: boolean
  threadId?: string
}) => {
  const result = await db
    .select()
    .from(characterProfiles)
    .where(
      and(
        threadId ? eq(characterProfiles.threadId, threadId) : undefined,
        userId ? eq(characterProfiles.userId, userId) : undefined,
        guestId ? eq(characterProfiles.guestId, guestId) : undefined,
        visibility ? eq(characterProfiles.visibility, visibility) : undefined,
        pinned ? eq(characterProfiles.pinned, pinned) : undefined,
      ),
    )
  return result
}

export const getUsers = async ({
  page = 1,
  role,
  search,
  email,
  userName,
  isPublic,
  similarTo,
  ...rest
}: {
  search?: string
  email?: string
  pageSize?: number
  userName?: string
  role?: "user" | "admin"
  isPublic?: boolean
  similarTo?: string
  page?: number
} = {}) => {
  const pageSize = rest.pageSize || 100
  const formattedSearch =
    search && search.length >= 3 ? formatSearchTerm(search) : undefined

  // Create the search condition for full-text search including character profiles
  const searchCondition = formattedSearch
    ? sql`
              (
                setweight(to_tsvector('english', coalesce(${users.name}, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(${users.email}, '')), 'B')
              ) @@ to_tsquery('english', ${sql`${formattedSearch}`}::text)
              OR EXISTS (
                SELECT 1 FROM ${characterProfiles}
                WHERE ${characterProfiles.userId} = ${users.id}
                AND ${characterProfiles.visibility} = 'public'
                AND ${characterProfiles.pinned} = true
                AND (
                  to_tsvector('english', coalesce(${characterProfiles.name}, '')) @@ to_tsquery('english', ${sql`${formattedSearch}`}::text)
                  OR ${characterProfiles.tags}::text ILIKE ${`%${search}%`}
                )
              )
            `
    : undefined

  // Get similarTo character profile for matching
  const similarToProfile = similarTo
    ? await db
        .select()
        .from(characterProfiles)
        .where(eq(characterProfiles.id, similarTo))
        .limit(1)
        .then((profiles) => profiles[0])
    : undefined

  const conditionsArray = [
    role ? eq(users.role, role) : undefined,
    searchCondition ? searchCondition : undefined,
    email ? eq(users.email, email) : undefined,
    userName ? eq(users.userName, userName) : undefined,
    isPublic
      ? sql`${users.characterProfilesEnabled} = true AND EXISTS (
      SELECT 1 FROM ${characterProfiles} 
      WHERE ${characterProfiles.userId} = ${users.id} 
      AND ${characterProfiles.visibility} = 'public' 
      AND ${characterProfiles.pinned} = true
    )`
      : undefined,
  ]

  // Add similarTo matching condition
  if (similarToProfile) {
    // Use OR condition to match either exact name OR tag matches
    const nameMatch = sql`EXISTS (
      SELECT 1 FROM ${characterProfiles}
      WHERE ${characterProfiles.userId} = ${users.id}
      AND ${characterProfiles.visibility} = 'public'
      AND ${characterProfiles.pinned} = true
      AND ${characterProfiles.name} = ${similarToProfile.name}
    )`

    if (similarToProfile.tags?.length) {
      const tagsArray = similarToProfile.tags
      const tagMatch = sql`EXISTS (
        SELECT 1 FROM ${characterProfiles}
        WHERE ${characterProfiles.userId} = ${users.id}
        AND ${characterProfiles.visibility} = 'public'
        AND ${characterProfiles.pinned} = true
        AND (
          ${sql.join(
            tagsArray.map(
              (tag) => sql`${characterProfiles.tags}::jsonb ? ${tag}`,
            ),
            sql` OR `,
          )}
        )
      )`

      conditionsArray.push(sql`(${nameMatch} OR ${tagMatch})`)
    } else {
      conditionsArray.push(nameMatch)
    }
  }

  const conditions = and(...conditionsArray.filter(Boolean))

  const result = await db
    .select()
    .from(users)
    .where(conditions)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .orderBy(desc(users.createdOn))

  const totalCount =
    (
      await db
        .select({ count: count(users.id) })
        .from(users)
        .where(conditions)
    )[0]?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null

  return {
    users: await Promise.all(
      result.map(async (user) => await getUser({ id: user.id })),
    ),
    totalCount,
    hasNextPage,
    nextPage,
  }
}

export const createUser = async (user: newUser) => {
  // Generate API key if not provided
  // const apiKey =
  //   user.apiKey ||
  //   generateApiKey(
  //     process.env.NODE_ENV === "production" ? "production" : "development",
  //   )

  const [inserted] = await db
    .insert(users)
    .values({
      ...user,
      // apiKey,
    })
    .returning()

  return inserted ? await getUser({ id: inserted.id }) : undefined
}

export const createVerificationToken = async (token: newVerificationToken) => {
  const [inserted] = await db
    .insert(verificationTokens)
    .values(token)
    .returning()
  return inserted
}

export const updateUser = async (user: user) => {
  const [updated] = await db
    .update(users)
    .set(user)
    .where(eq(users.id, user.id))
    .returning()

  return updated ? await getUser({ id: user.id }) : undefined
}

export const deleteUser = async (id: string) => {
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning()

  return deleted
}

export const createMessage = async (message: newMessage) => {
  const [inserted] = await db.insert(messages).values(message).returning()

  const thread = inserted?.threadId
    ? await getThread({ id: inserted.threadId })
    : undefined
  // Log credit usage for AI messages (privacy-friendly tracking)
  if (inserted?.agentId && inserted?.creditCost > 0) {
    // Get agent info for credit calculation
    const agent = await db
      .select()
      .from(aiAgents)
      .where(eq(aiAgents.id, inserted.agentId))
      .limit(1)

    if (agent[0]) {
      const totalCreditCost = inserted.creditCost * agent[0].creditCost

      await logCreditUsage({
        appId: thread?.appId || undefined,
        userId: inserted.userId || undefined,
        guestId: inserted.guestId || undefined,
        agentId: inserted.agentId,
        creditCost: totalCreditCost,
        messageType: "ai",
        threadId: inserted.threadId || undefined,
        messageId: inserted.id,
        // isWebSearchEnabled: inserted.isWebSearchEnabled || false,
      })
    }
  }

  return inserted
}

export const getMessage = async ({
  id,
  userId,
  guestId,
  clientId,
}: {
  id?: string
  userId?: string
  guestId?: string
  clientId?: string
}) => {
  const result = (
    await db
      .select({
        message: messages,
        user: users,
        guest: guests,
        aiAgent: aiAgents,
        thread: threads,
      })
      .from(messages)
      .innerJoin(threads, eq(messages.threadId, threads.id))
      .leftJoin(users, eq(messages.userId, users.id))
      .leftJoin(guests, eq(messages.guestId, guests.id))
      .leftJoin(aiAgents, eq(messages.agentId, aiAgents.id))
      .where(
        and(
          id ? eq(messages.id, id) : undefined,
          userId ? eq(messages.userId, userId) : undefined,
          guestId ? eq(messages.guestId, guestId) : undefined,
          clientId ? eq(messages.clientId, clientId) : undefined,
        ),
      )
  ).at(0)

  return result
    ? {
        ...result,
        user: {
          id: result.user?.id,
          createdOn: result.user?.createdOn,
          updatedOn: result.user?.updatedOn,
          userName: result.user?.userName,
          name: result.user?.name,
          image: result.user?.image,
          // isOnline: result.user?.isOnline,
        },
      }
    : undefined
}

export const updateMessage = async (message: message) => {
  const [updated] = await db
    .update(messages)
    .set(message)
    .where(eq(messages.id, message.id))
    .returning()

  return updated
}

export const deleteMessage = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(messages)
    .where(eq(messages.id, id))
    .returning()

  return deleted
}

const normalizeMonth = (month?: number) => {
  if (month === undefined) return undefined
  return month + 1 // Convert from JS 0-11 to SQL 1-12
}

export const getMessages = async ({
  page = 1,
  userId,
  guestId,
  agentId,
  readOn,
  createdOn,
  aiAgent,
  threadId,
  month,
  likedBy,
  createdAfter,
  hasAttachments,
  isAsc,
  ...rest
}: {
  likedBy?: string
  page?: number
  pageSize?: number
  userId?: string
  guestId?: string
  agentId?: string | null
  readOn?: Date
  aiAgent?: boolean
  createdOn?: Date
  hasAttachments?: boolean
  threadId?: string
  month?: number // 1-12 representing January-December
  createdAfter?: Date
  isAsc?: boolean
} = {}) => {
  const pageSize = rest.pageSize || 100

  const conditionsArray = [
    userId ? eq(messages.userId, userId) : undefined,
    guestId ? eq(messages.guestId, guestId) : undefined,
    agentId
      ? eq(messages.agentId, agentId)
      : agentId === null
        ? isNull(messages.agentId)
        : undefined,
    readOn
      ? sql`DATE_TRUNC('day', ${messages.readOn}) = DATE_TRUNC('day', ${sql.raw(`'${readOn.toISOString()}'`)})`
      : undefined,
    createdOn
      ? sql`DATE_TRUNC('day', ${messages.createdOn}) = DATE_TRUNC('day', ${sql.raw(`'${createdOn.toISOString()}'`)})`
      : undefined,
    month !== undefined
      ? sql`EXTRACT(MONTH FROM ${messages.createdOn}) = ${normalizeMonth(month)}`
      : undefined,
    aiAgent ? isNotNull(messages.agentId) : undefined,
    threadId ? eq(messages.threadId, threadId) : undefined,
    createdAfter ? gte(messages.createdOn, createdAfter) : undefined,
    likedBy
      ? sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements(${messages.reactions}) AS reaction
          WHERE (reaction->>'userId' = ${likedBy} OR reaction->>'guestId' = ${likedBy})
          AND (reaction->>'like')::boolean = true
        )`
      : undefined,
    hasAttachments
      ? or(
          isNotNull(messages.files),
          isNotNull(messages.images),
          isNotNull(messages.video),
          isNotNull(messages.audio),
        )
      : undefined,
  ]

  const conditions = and(...conditionsArray.filter(Boolean))

  const result = await db
    .select({
      message: messages,
      user: users,
      guest: guests,
      aiAgent: aiAgents,
      thread: threads,
    })
    .from(messages)
    .where(conditions)
    .leftJoin(users, eq(messages.userId, users.id))
    .leftJoin(guests, eq(messages.guestId, guests.id))
    .leftJoin(aiAgents, eq(messages.agentId, aiAgents.id))
    .innerJoin(threads, eq(messages.threadId, threads.id))
    .orderBy(isAsc ? asc(messages.createdOn) : desc(messages.createdOn))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalCount =
    (
      await db
        .select({ count: count(messages.id) })
        .from(messages)
        .where(conditions)
    )[0]?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null

  return {
    messages: await Promise.all(
      result.map(async (message) => ({
        ...message,
        parentMessage: message.message.clientId
          ? await getMessage({
              clientId: message.message.id,
            }).then((res) => res?.message)
          : undefined,
        user: {
          id: message.user?.id,
          createdOn: message.user?.createdOn,
          updatedOn: message.user?.updatedOn,
          userName: message.user?.userName,
          name: message.user?.name,
          image: message.user?.image,
        },
      })),
    ),
    totalCount,
    hasNextPage,
    nextPage,
  }
}

export const getInvitations = async ({
  guestId,
  threadId,
}: {
  guestId?: string
  threadId?: string
}) => {
  const result = await db
    .select()
    .from(invitations)
    .where(
      and(
        guestId ? eq(invitations.guestId, guestId) : undefined,
        threadId ? eq(invitations.threadId, threadId) : undefined,
      ),
    )

  return result
}

export const getDocumentChunks = async ({
  guestId,
  threadId,
}: {
  guestId?: string
  threadId?: string
}) => {
  const result = await db
    .select()
    .from(documentChunks)
    .where(
      and(
        guestId ? eq(documentChunks.guestId, guestId) : undefined,
        threadId ? eq(documentChunks.threadId, threadId) : undefined,
      ),
    )

  return result
}

export const updateDocumentChunk = async (documentChunk: documentChunk) => {
  const [updated] = await db
    .update(documentChunks)
    .set(documentChunk)
    .where(eq(documentChunks.id, documentChunk.id))
    .returning()

  return updated
}

export const getDevices = async ({
  guestId,
  userId,
  fingerprint,
  page = 1,
  pageSize = 10,
}: {
  guestId?: string
  userId?: string
  fingerprint?: string
  page?: number
  pageSize?: number
} = {}) => {
  const conditionsArray = [
    guestId ? eq(devices.guestId, guestId) : undefined,
    userId ? eq(devices.userId, userId) : undefined,
    fingerprint ? eq(devices.fingerprint, fingerprint) : undefined,
  ]

  const conditions = and(...conditionsArray.filter(Boolean))

  const result = await db
    .select()
    .from(devices)
    .where(conditions)
    .orderBy(desc(devices.createdOn))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalCount =
    (
      await db
        .select({ count: count(devices.id) })
        .from(devices)
        .where(conditions)
    ).at(0)?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null

  return {
    devices: result,
    totalCount,
    hasNextPage,
    nextPage,
  }
}

export const deleteDevice = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(devices)
    .where(eq(devices.id, id))
    .returning()

  return deleted
}

export const getDevice = async ({
  guestId,
  userId,
  fingerprint,
}: {
  guestId?: string
  userId?: string
  fingerprint?: string
}) => {
  const [result] = await db
    .select()
    .from(devices)
    .where(
      and(
        guestId ? eq(devices.guestId, guestId) : undefined,
        userId ? eq(devices.userId, userId) : undefined,
        fingerprint ? eq(devices.fingerprint, fingerprint) : undefined,
      ),
    )

  return result
}

export const updateDevice = async (device: device) => {
  const [updated] = await db
    .update(devices)
    .set(device)
    .where(eq(devices.id, device.id))
    .returning()

  return updated
}

export const deleteDocumentChunk = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(documentChunks)
    .where(eq(documentChunks.id, id))
    .returning()

  return deleted
}

const getReactions = async ({
  guestId,
  userId,
}: {
  guestId?: string
  userId?: string
}) => {
  const result = await db
    .select()
    .from(messages)
    .where(
      and(
        isNotNull(messages.reactions),
        guestId
          ? sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${messages.reactions}) AS elem WHERE elem->>'guestId' = ${guestId})`
          : undefined,
        userId
          ? sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${messages.reactions}) AS elem WHERE elem->>'userId' = ${userId})`
          : undefined,
      ),
    )

  return result.map((msg) => ({
    id: msg.id,
    reactions: msg.reactions,
  }))
}

const getBookmarks = async ({
  guestId,
  userId,
}: {
  guestId?: string
  userId?: string
}) => {
  const result = await db
    .select()
    .from(threads)
    .where(
      and(
        isNotNull(threads.bookmarks),
        guestId
          ? sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${threads.bookmarks}) AS elem WHERE elem->>'guestId' = ${guestId})`
          : undefined,
        userId
          ? sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${threads.bookmarks}) AS elem WHERE elem->>'userId' = ${userId})`
          : undefined,
      ),
    )

  return result.map((thread) => ({
    id: thread.id,
    bookmarks: thread.bookmarks,
  }))
}

const updateReactions = async ({
  guestId,
  userId,
  messageId,
}: {
  guestId?: string
  userId?: string
  messageId: string
}) => {
  if (!guestId || !userId) return

  const [updated] = await db
    .update(messages)
    .set({
      reactions: sql`(
        SELECT jsonb_agg(
          CASE 
            WHEN elem->>'guestId' = ${guestId}
            THEN jsonb_set(elem, '{userId}', ${JSON.stringify(userId)}) - 'guestId'
            ELSE elem
          END
        )
        FROM jsonb_array_elements(reactions) AS elem
      )`,
    })
    .where(eq(messages.id, messageId))
    .returning()

  return updated
}

const updateBookmarks = async ({
  guestId,
  userId,
  threadId,
}: {
  guestId?: string
  userId?: string
  threadId: string
}) => {
  if (!guestId || !userId) return

  const [updated] = await db
    .update(threads)
    .set({
      bookmarks: sql`(
        SELECT jsonb_agg(
          CASE 
            WHEN elem->>'guestId' = ${guestId}
            THEN jsonb_set(elem, '{userId}', ${JSON.stringify(userId)}) - 'guestId'
            ELSE elem
          END
        )
        FROM jsonb_array_elements(bookmarks) AS elem
      )`,
    })
    .where(eq(threads.id, threadId))
    .returning()

  return updated
}

export const updatePushSubscription = async (
  pushSubscription: pushSubscription,
) => {
  const [updated] = await db
    .update(pushSubscriptions)
    .set(pushSubscription)
    .where(eq(pushSubscriptions.id, pushSubscription.id))
    .returning()

  return updated
}

export const deletePushSubscription = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.id, id))
    .returning()

  return deleted
}

export const deleteMessageEmbedding = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(messageEmbeddings)
    .where(eq(messageEmbeddings.id, id))
    .returning()

  return deleted
}

export const getMessageEmbeddings = async ({
  guestId,
  userId,
}: {
  guestId?: string
  userId?: string
}) => {
  const result = await db
    .select()
    .from(messageEmbeddings)
    .where(
      and(
        guestId ? eq(messageEmbeddings.guestId, guestId) : undefined,
        userId ? eq(messageEmbeddings.userId, userId) : undefined,
      ),
    )

  return result
}

export const updateMessageEmbedding = async (
  messageEmbedding: messageEmbedding,
) => {
  const [updated] = await db
    .update(messageEmbeddings)
    .set(messageEmbedding)
    .where(eq(messageEmbeddings.id, messageEmbedding.id))
    .returning()

  return updated
}

export async function migrateUser({
  user,
  guest,
}: {
  user: user
  guest: guest
}) {
  const limit = 100000
  if (!guest || !user) return
  if (guest.migratedToUser || user.migratedFromGuest) return

  // Migrate threads§
  const threads = await getThreads({
    guestId: guest.id,
    pageSize: limit,
    publicBookmarks: false,
  })

  const { id: userId } = user

  await Promise.all(
    threads.threads.map(async (thread) => {
      await updateThread({
        ...thread,
        userId,
        guestId: null,
      })
    }),
  )

  const instructions = await getInstructions({ guestId: guest.id })
  await Promise.all(
    instructions.map(async (instruction) => {
      await updateInstruction({
        ...instruction,
        userId,
        guestId: null,
      })
    }),
  )

  const calendarEvents = await getCalendarEvents({ guestId: guest.id })
  await Promise.all(
    calendarEvents.map(async (calendarEvent) => {
      await updateCalendarEvent({
        ...calendarEvent,
        userId,
        guestId: null,
      })
    }),
  )

  // Migrate expenses (Vault)
  const guestExpenses = await getExpenses({
    guestId: guest.id,
    pageSize: limit,
  })
  await Promise.all(
    guestExpenses.expenses.map(async (expense) => {
      await updateExpense({
        ...expense,
        userId,
        guestId: null,
      })
    }),
  )

  const budgets = await getBudgets({
    guestId: guest.id,
    pageSize: limit,
  })

  await Promise.all(
    budgets.budgets.map(async (budget) => {
      await updateBudget({
        ...budget,
        userId,
        guestId: null,
      })
    }),
  )

  const placeHolders = await getPlaceHolders({ guestId: guest.id })
  await Promise.all(
    placeHolders.map(async (placeHolder) => {
      await updatePlaceHolder({
        ...placeHolder,
        userId,
        guestId: null,
      })
    }),
  )

  // Migrate messages
  const messages = await getMessages({ guestId: guest.id, pageSize: limit })
  await Promise.all(
    messages.messages.map(async (message) => {
      await updateMessage({
        ...message.message,
        userId,
        guestId: null,
      })
    }),
  )

  // Migrate subscription (required by Apple App Store guidelines)
  const guestSubscription = await getSubscription({ guestId: guest.id })
  if (guestSubscription) {
    await updateSubscription({
      ...guestSubscription,
      userId,
    })
  }

  const creditUsage = await getCreditUsage({ guestId: guest.id })
  await Promise.all(
    creditUsage.map(async (creditUsage) => {
      await updateCreditUsage({
        ...creditUsage,
        guestId: null,
        userId,
      })
    }),
  )

  const creditTransactions = await getCreditTransactions({ guestId: guest.id })
  await Promise.all(
    creditTransactions.map(async (creditTransaction) => {
      await updateCreditTransaction({
        ...creditTransaction,
        guestId: null,
        userId,
      })
    }),
  )

  const invitations = await getInvitations({ guestId: guest.id })
  await Promise.all(
    invitations.map(async (invitation) => {
      await updateInvitation({
        ...invitation,
        guestId: null,
        userId,
      })
    }),
  )

  const documentChunks = await getDocumentChunks({ guestId: guest.id })
  await Promise.all(
    documentChunks.map(async (documentChunk) => {
      await updateDocumentChunk({
        ...documentChunk,
        guestId: null,
        userId,
      })
    }),
  )

  const devices = await getDevices({ guestId: guest.id })
  await Promise.all(
    devices.devices.map(async (device) => {
      await updateDevice({
        ...device,
        guestId: null,
        userId,
      })
    }),
  )

  const pushSubscriptions = await getPushSubscriptions({ guestId: guest.id })
  await Promise.all(
    pushSubscriptions.map(async (pushSubscription) => {
      await updatePushSubscription({
        id: pushSubscription.id,
        userId,
        guestId: null,
        endpoint: pushSubscription.endpoint,
        p256dh: pushSubscription.keys.p256dh,
        auth: pushSubscription.keys.auth,
        createdOn: pushSubscription.createdOn,
        updatedOn: pushSubscription.updatedOn,
      })
    }),
  )

  const threadSummaries = await getThreadSummaries({
    guestId: guest.id,
    pageSize: limit,
  })
  await Promise.all(
    threadSummaries.threadSummaries.map(async (threadSummary) => {
      await updateThreadSummary({
        ...threadSummary,
        guestId: null,
        userId,
      })
    }),
  )

  const memories = await getMemories({ guestId: guest.id, pageSize: limit })
  await Promise.all(
    memories.memories.map(async (memory) => {
      await updateMemory({
        ...memory,
        guestId: null,
        userId,
      })
    }),
  )

  const characterProfiles = await getCharacterProfiles({ guestId: guest.id })
  await Promise.all(
    characterProfiles.map(async (characterProfile) => {
      await updateCharacterProfile({
        ...characterProfile,
        guestId: null,
        userId,
      })
    }),
  )

  if (
    !user?.suggestions?.instructions?.length &&
    guest?.suggestions?.instructions?.length
  ) {
    await updateUser({
      ...user,
      suggestions: {
        instructions: guest?.suggestions?.instructions,
      },
    })
  }

  const messageEmbeddings = await getMessageEmbeddings({ guestId: guest.id })
  await Promise.all(
    messageEmbeddings.map(async (messageEmbedding) => {
      await updateMessageEmbedding({
        ...messageEmbedding,
        guestId: null,
        userId,
      })
    }),
  )

  const reactions = await getReactions({ guestId: guest.id })
  await Promise.all(
    reactions.map(async (reaction) => {
      await updateReactions({
        guestId: guest.id,
        userId,
        messageId: reaction.id,
      })
    }),
  )

  const bookmarks = await getBookmarks({ guestId: guest.id })
  await Promise.all(
    bookmarks.map(async (bookmark) => {
      await updateBookmarks({
        guestId: guest.id,
        userId,
        threadId: bookmark.id,
      })
    }),
  )

  // Migrate guest-created apps
  const guestApps = await getApps({ guestId: guest.id, pageSize: limit })
  await Promise.all(
    guestApps.items.map(async (app) => {
      await updateApp({
        ...(app as app),
        guestId: null,
        userId,
      })
    }),
  )

  // Migrate app orders
  const guestAppOrders = await getAppOrders({ guestId: guest.id })
  await Promise.all(
    guestAppOrders.map(async (appOrder) => {
      await updateAppOrder({
        ...appOrder.items,
        guestId: null,
        userId,
      })
    }),
  )

  // Migrate guest stores
  const guestStores = await getStores({ guestId: guest.id })
  await Promise.all(
    guestStores.stores.map(async (store) => {
      await updateStore({
        ...store.store,
        guestId: null,
        userId,
      })
    }),
  )

  // Migrate affiliate clicks
  const guestAffiliateClicks = await getAffiliateClicks({ guestId: guest.id })
  await Promise.all(
    guestAffiliateClicks?.map(async (click) => {
      await updateAffiliateClick({
        ...click,
        guestId: null,
        userId,
      })
    }),
  )

  const guestCredits =
    guest.credits > GUEST_CREDITS_PER_MONTH
      ? guest.credits
      : GUEST_CREDITS_PER_MONTH

  const finalCredits = guestCredits > user.credits ? guestCredits : user.credits

  const updatedUser = await updateUser({
    ...user,
    credits: finalCredits,
    migratedFromGuest: true,
  })

  const updatedGuest = await updateGuest({
    ...guest,
    credits: 0,
    migratedToUser: true,
    fingerprint: uuidv4(),
  })

  return { user: updatedUser, guest: updatedGuest }
}

export const createAccount = async (account: newAccount) => {
  const [inserted] = await db.insert(accounts).values(account).returning()
  return inserted
}

export const createGuest = async (guest: newGuest) => {
  const [inserted] = await db.insert(guests).values(guest).returning()
  return inserted ? await getGuest({ id: inserted.id }) : undefined
}

export const getGuest = async ({
  id,
  ip,
  fingerprint,
  isBot,
  email,
  app,
}: {
  id?: string
  ip?: string
  fingerprint?: string
  isBot?: boolean
  email?: string
  app?: app | null
}) => {
  const conditionsArray = [
    id ? eq(guests.id, id) : undefined,
    ip ? eq(guests.ip, ip) : undefined,
    fingerprint ? eq(guests.fingerprint, fingerprint) : undefined,
    isBot ? eq(guests.isBot, isBot) : undefined,
    email ? eq(guests.email, email) : undefined,
  ]

  const conditions = and(...conditionsArray.filter(Boolean))

  const result = (await db.select().from(guests).where(conditions)).at(0)

  const now = new Date()
  const oneHourAgo = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() - 1,
      now.getUTCMinutes(),
      now.getUTCSeconds(),
    ),
  )
  const memoriesCount = result
    ? await getMemories({
        guestId: result.id,
      }).then((res) => res.totalCount)
    : undefined

  const lastMessage = result
    ? await getMessages({
        guestId: result.id,
        pageSize: 1,
      })
    : undefined

  const isAppOwner =
    result &&
    app &&
    isOwner(app, {
      guestId: result.id,
    })

  // Calculate credits spent
  const creditsSpent = result
    ? await getCreditsSpent({
        guestId: result.id,
        month: new Date().getMonth(),
      })
    : 0

  // If guest owns the app they're using, show infinite credits (999999)
  const creditsLeft = isAppOwner
    ? OWNER_CREDITS
    : Math.max(result ? result.credits - creditsSpent : 0, 0)

  return result
    ? {
        ...result,
        memoriesCount,
        messagesLastHour: await getMessages({
          guestId: result.id,
          createdAfter: oneHourAgo,
          aiAgent: true,
          pageSize: 1,
        }).then((res) => res.totalCount),
        creditsLeft,
        instructions: await getInstructions({
          guestId: result.id,
          pageSize: 7, // 7 instructions per app
          perApp: true, // Get 7 per app (Atlas, Bloom, Peach, Vault, General) = 35 total
        }),
        placeHolder: await getPlaceHolder({
          guestId: result.id,
        }),
        characterProfiles: await getCharacterProfiles({
          guestId: result.id,
          pinned: true,
        }),
        lastMessage: lastMessage?.messages.at(0)?.message,
        messageCount: lastMessage?.totalCount,
        subscription: await getSubscription({ guestId: result.id }),
      }
    : null
}

export const updateGuest = async (guest: guest) => {
  const [updated] = await db
    .update(guests)
    .set(guest)
    .where(eq(guests.id, guest.id))
    .returning()

  return updated
}

export const deleteGuest = async ({ id }: { id: string }) => {
  const [deleted] = await db.delete(guests).where(eq(guests.id, id)).returning()

  return deleted
}

export const getGuests = async ({
  page = 1,
  ...rest
}: {
  page?: number
  pageSize?: number
} = {}) => {
  const pageSize = rest.pageSize || 100
  const result = await db
    .select()
    .from(guests)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .orderBy(desc(guests.createdOn))

  const totalCount =
    (await db.select({ count: count(guests.id) }).from(guests))[0]?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null

  return {
    guests: result,
    totalCount,
    hasNextPage,
    nextPage,
  }
}

export const getSubscription = async ({
  userId,
  guestId,
  subscriptionId,
  sessionId,
}: {
  userId?: string
  guestId?: string
  subscriptionId?: string
  sessionId?: string
}) => {
  if (!userId && !guestId && !subscriptionId && !sessionId) {
    throw new Error(
      "At least one of userId, subscriptionId, or sessionId is required",
    )
  }

  const result = (
    await db
      .select()
      .from(subscriptions)
      .where(
        and(
          guestId ? eq(subscriptions.guestId, guestId) : undefined,
          userId ? eq(subscriptions.userId, userId) : undefined,
          subscriptionId
            ? eq(subscriptions.subscriptionId, subscriptionId)
            : undefined,
          sessionId ? eq(subscriptions.sessionId, sessionId) : undefined,
        ),
      )
  ).at(0)

  return result
}

export const getSubscriptions = async ({
  userId,
  guestId,
}: {
  userId?: string
  guestId?: string
}) => {
  const result = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        userId ? eq(subscriptions.userId, userId) : undefined,
        guestId ? eq(subscriptions.guestId, guestId) : undefined,
      ),
    )

  return result
}

export const createSubscription = async (subscription: newSubscription) => {
  const [inserted] = await db
    .insert(subscriptions)
    .values(subscription)
    .returning()
  return inserted
}

export const updateSubscription = async (subscription: subscription) => {
  const [updated] = await db
    .update(subscriptions)
    .set(subscription)
    .where(eq(subscriptions.id, subscription.id))
    .returning()

  return updated
}

export const deleteSubscription = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(subscriptions)
    .where(eq(subscriptions.id, id))
    .returning()

  return deleted
}

export const createDevice = async (device: newDevice) => {
  const [inserted] = await db.insert(devices).values(device).returning()
  return inserted
}

export async function upsertDevice(deviceData: newDevice) {
  const { fingerprint, guestId, ...updateData } = deviceData

  const device = await getDevice({ fingerprint })

  if (device) {
    await updateDevice({
      ...device,
      ...updateData,
    })
    return device
  }

  await createDevice(deviceData)
}

export const createThread = async (thread: newThread) => {
  const [inserted] = await db.insert(threads).values(thread).returning()
  return inserted
}

export const getThread = async ({
  id,
  userId,
  guestId,
  isMainThread,
  appId,
}: {
  id?: string
  userId?: string
  guestId?: string
  isMainThread?: boolean
  appId?: string
}) => {
  const [result] = await db
    .select()
    .from(threads)
    .where(
      and(
        id ? eq(threads.id, id) : undefined,
        appId ? eq(threads.appId, appId) : undefined,
        isMainThread ? eq(threads.isMainThread, isMainThread) : undefined,
        userId ? eq(threads.userId, userId) : undefined,
        guestId ? eq(threads.guestId, guestId) : undefined,
      ),
    )
    .leftJoin(apps, eq(threads.appId, apps.id))
    .leftJoin(users, eq(threads.userId, users.id))
    .leftJoin(guests, eq(threads.guestId, guests.id))
    .leftJoin(characterProfiles, eq(threads.id, characterProfiles.threadId))
    .limit(1)

  return result
    ? {
        ...result.threads,
        user: {
          id: result.user?.id,
          name: result.user?.name,
          userName: result.user?.userName,
          createdOn: result.user?.createdOn,
          updatedOn: result.user?.updatedOn,
          image: result.user?.image,
          // activeOn: result.user?.activeOn,
          // isOnline: result.user?.isOnline,
        } as user | null,
        guest: result.guest,
        collaborations: await getCollaborations({
          threadId: result.threads.id,
        }),
        characterProfile: await getCharacterProfile({
          threadId: result.threads.id,
        }),
        summary: await getThreadSummary({
          threadId: result.threads.id,
        }),
        placeHolder: await getPlaceHolder({
          threadId: result.threads.id,
        }),
        app: result.threads.appId
          ? await getApp({
              id: result.threads.appId,
              userId,
              guestId,
            })
          : undefined,
      }
    : undefined
}

export const getCharacterProfile = async ({
  threadId,
}: {
  threadId: string
}) => {
  const [result] = await db
    .select()
    .from(characterProfiles)
    .where(eq(characterProfiles.threadId, threadId))

  return result
}

export const updateCharacterProfile = async (
  characterProfile: characterProfile,
) => {
  const [updated] = await db
    .update(characterProfiles)
    .set(characterProfile)
    .where(eq(characterProfiles.id, characterProfile.id))
    .returning()

  return updated
}

export const getThreads = async ({
  page = 1,
  pageSize = 100,
  search,
  guestId,
  isIncognito,
  userId,
  starred,
  sort,
  visibility,
  userName,
  collaborationStatus,
  myPendingCollaborations,
  publicBookmarks = true,
  appId,
  appIds,
}: {
  page?: number
  pageSize?: number
  search?: string
  guestId?: string
  isIncognito?: boolean
  userId?: string
  starred?: boolean
  visibility?: ("public" | "private")[]
  sort?: "bookmark" | "date"
  collaborationStatus?: ("active" | "pending")[]
  userName?: string
  myPendingCollaborations?: boolean // I'm pending on others' threads
  publicBookmarks?: boolean
  appId?: string
  appIds?: string[]
}) => {
  // const user = userId ? await getUser({ id: userId }) : undefined
  // const guest = guestId ? await getGuest({ id: guestId }) : undefined
  // If appId is provided, check if it's the store's main app and get all sub-app IDs
  let finalAppIds = appIds
  if (appId && !appIds) {
    const app = await getApp({ id: appId })
    if (app) {
      // Only aggregate threads if this IS the store's main app
      if (app?.store?.appId === appId) {
        finalAppIds = app?.store?.apps?.map((a) => a.id)
      }
    }
  }

  const formattedSearch =
    search && search.length >= 3 ? formatSearchTerm(search) : undefined

  // Get collaboration threads if userId or userName is provided
  const collaborationThreadIds =
    !collaborationStatus && !myPendingCollaborations
      ? []
      : userId || userName
        ? (
            await db
              .select({ threadId: collaborations.threadId })
              .from(collaborations)
              .leftJoin(users, eq(collaborations.userId, users.id))
              .where(
                and(
                  userId ? eq(collaborations.userId, userId) : undefined,
                  userName ? eq(users.userName, userName) : undefined,
                  myPendingCollaborations
                    ? eq(collaborations.status, "pending")
                    : collaborationStatus
                      ? inArray(collaborations.status, collaborationStatus)
                      : eq(collaborations.status, "active"),
                ),
              )
          ).map((c) => c.threadId)
        : undefined

  // Get bookmarked thread IDs for public threads when viewing another user's profile
  const bookmarkedThreadIds = !publicBookmarks
    ? []
    : userId || userName
      ? (
          await db
            .select({ id: threads.id })
            .from(threads)
            .where(
              and(
                eq(threads.visibility, "public"),
                sql`EXISTS (
                SELECT 1 FROM jsonb_array_elements(${threads.bookmarks}) AS bookmark
                WHERE ${userId ? sql`bookmark->>'userId' = ${userId}` : sql`bookmark->>'guestId' = ${guestId || ""}`}
              )`,
              ),
            )
            .orderBy(desc(threads.updatedOn))
        ) // Add this line to sort by most recently updated
          .map((t) => t.id)
      : undefined

  // Check if we're filtering by specific collaboration status (not showing all)
  const isFilteringByCollaborationStatus =
    collaborationStatus?.length === 1 &&
    (collaborationStatus[0] === "pending" ||
      collaborationStatus[0] === "active")

  const conditionsArray = [
    finalAppIds && finalAppIds.length > 0
      ? inArray(threads.appId, finalAppIds)
      : appId
        ? eq(threads.appId, appId)
        : undefined,
    formattedSearch
      ? sql`to_tsvector('english', ${messages.content}) @@ to_tsquery('english', ${formattedSearch})`
      : undefined,
    guestId
      ? myPendingCollaborations
        ? // Guests cannot have pending collaborations - return empty result
          sql`false`
        : eq(threads.guestId, guestId)
      : undefined,
    userId
      ? myPendingCollaborations
        ? // Only show threads where I'm a pending collaborator (not threads I own)
          collaborationThreadIds && collaborationThreadIds.length > 0
          ? inArray(threads.id, collaborationThreadIds)
          : sql`false`
        : isFilteringByCollaborationStatus
          ? // Only show collaboration threads with specific status
            collaborationThreadIds && collaborationThreadIds.length > 0
            ? inArray(threads.id, collaborationThreadIds)
            : sql`false`
          : // Show all threads (owned + collaboration + bookmarked)
            or(
              eq(threads.userId, userId),
              collaborationThreadIds && collaborationThreadIds.length > 0
                ? inArray(threads.id, collaborationThreadIds)
                : sql`false`,
              bookmarkedThreadIds && bookmarkedThreadIds.length > 0
                ? inArray(threads.id, bookmarkedThreadIds)
                : sql`false`,
            )
      : undefined,
    isIncognito !== undefined
      ? eq(threads.isIncognito, isIncognito)
      : undefined,
    starred ? eq(threads.star, 1) : undefined,
    visibility ? inArray(threads.visibility, visibility) : undefined,
    userName
      ? myPendingCollaborations
        ? // Only show threads where this user is a pending collaborator
          collaborationThreadIds && collaborationThreadIds.length > 0
          ? inArray(threads.id, collaborationThreadIds)
          : sql`false`
        : isFilteringByCollaborationStatus
          ? // Only show collaboration threads with specific status
            collaborationThreadIds && collaborationThreadIds.length > 0
            ? inArray(threads.id, collaborationThreadIds)
            : sql`false`
          : // Show all threads (owned + collaboration)
            or(
              eq(users.userName, userName),
              collaborationThreadIds && collaborationThreadIds.length > 0
                ? inArray(threads.id, collaborationThreadIds)
                : sql`false`,
            )
      : undefined,
  ].filter(Boolean)

  if (search && search.length >= 3) {
    // Subquery for thread IDs with FTS on messages.content
    const subquery = db
      .select({ threadId: messages.threadId })
      .from(messages)
      .where(and(...conditionsArray))

    // Main query: threads whose id is in subquery
    const result = await db
      .select()
      .from(threads)
      .where(inArray(threads.id, subquery))
      .leftJoin(users, eq(threads.userId, users.id))
      .leftJoin(apps, eq(threads.appId, apps.id))
      .orderBy(
        ...(sort === "bookmark"
          ? [
              // Main thread first for app owners
              appId || (finalAppIds && finalAppIds.length > 0)
                ? sql`CASE WHEN ${threads.isMainThread} = true THEN 0 ELSE 1 END`
                : sql`1`,
              sql`CASE WHEN ${threads.bookmarks} IS NULL THEN 1 ELSE 0 END`,
              desc(
                sql`jsonb_array_length(COALESCE(${threads.bookmarks}, '[]'::jsonb))`,
              ),
              desc(threads.createdOn),
            ]
          : [
              // Main thread first for app owners
              appId || (finalAppIds && finalAppIds.length > 0)
                ? sql`CASE WHEN ${threads.isMainThread} = true THEN 0 ELSE 1 END`
                : sql`1`,
              desc(threads.createdOn),
            ]),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    // Count for pagination
    const totalCount =
      (
        await db
          .select({ count: count(threads.id) })
          .from(threads)
          .leftJoin(users, eq(threads.userId, users.id))
          .leftJoin(apps, eq(threads.appId, apps.id))
          .where(
            inArray(
              threads.id,
              db
                .select({ threadId: messages.threadId })
                .from(messages)
                .where(and(...conditionsArray)),
            ),
          )
      )[0]?.count ?? 0

    const hasNextPage = totalCount > page * pageSize
    const nextPage = hasNextPage ? page + 1 : null

    return {
      threads: await Promise.all(
        result.map(async (thread) => ({
          ...thread.threads,
          user: thread.user
            ? {
                id: thread.user?.id,
                name: thread.user?.name,
                userName: thread.user?.userName,
                createdOn: thread.user?.createdOn,
                updatedOn: thread.user?.updatedOn,
                characterProfiles: await getCharacterProfiles({
                  userId: thread.user?.id,
                  visibility: "public",
                }),
                // activeOn: thread.user?.activeOn,
                // isOnline: thread.user?.isOnline,
              }
            : null,
          collaborations: await getCollaborations({
            threadId: thread.threads.id,
          }),
          lastMessage: (
            await getMessages({
              pageSize: 1,
              threadId: thread.threads.id,
            })
          ).messages.at(0)?.message,
        })),
      ),
      totalCount,
      hasNextPage,
      nextPage,
    }
  } else {
    const result = await db
      .select()
      .from(threads)
      .where(and(...conditionsArray))
      .leftJoin(users, eq(threads.userId, users.id))
      .leftJoin(apps, eq(threads.appId, apps.id))
      .orderBy(
        ...(sort === "bookmark"
          ? [
              // Main thread first for app owners
              appId || (finalAppIds && finalAppIds.length > 0)
                ? sql`CASE WHEN ${threads.isMainThread} = true THEN 0 ELSE 1 END`
                : sql`1`,
              sql`CASE WHEN ${threads.bookmarks} IS NULL THEN 1 ELSE 0 END`,
              desc(
                sql`jsonb_array_length(COALESCE(${threads.bookmarks}, '[]'::jsonb))`,
              ),
              desc(threads.createdOn),
            ]
          : [
              // Main thread first for app owners
              appId || (finalAppIds && finalAppIds.length > 0)
                ? sql`CASE WHEN ${threads.isMainThread} = true THEN 0 ELSE 1 END`
                : sql`1`,
              desc(threads.createdOn),
            ]),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    const totalCount =
      (
        await db
          .select({ count: count(threads.id) })
          .from(threads)
          .leftJoin(users, eq(threads.userId, users.id))
          .leftJoin(apps, eq(threads.appId, apps.id))
          .where(and(...conditionsArray))
      )[0]?.count ?? 0

    const hasNextPage = totalCount > page * pageSize
    const nextPage = hasNextPage ? page + 1 : null

    return {
      threads: await Promise.all(
        result.map(async (thread) => ({
          ...thread.threads,
          user: thread.user
            ? {
                id: thread.user?.id,
                createdOn: thread.user?.createdOn,
                updatedOn: thread.user?.updatedOn,
                userName: thread.user?.userName,
                name: thread.user?.name,
                characterProfiles: await getCharacterProfiles({
                  userId: thread.user?.id,
                  visibility: "public",
                }),
              }
            : null,

          collaborations: await getCollaborations({
            threadId: thread.threads.id,
          }),
          lastMessage: (
            await getMessages({
              pageSize: 1,
              threadId: thread.threads.id,
            })
          ).messages.at(0)?.message,
        })),
      ),
      totalCount,
      hasNextPage,
      nextPage,
    }
  }
}

export const updateThread = async (thread: thread) => {
  const [updated] = await db
    .update(threads)
    .set(thread)
    .where(eq(threads.id, thread.id))
    .returning()

  return updated ? getThread({ id: updated.id }) : undefined
}

export const deleteThread = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(threads)
    .where(eq(threads.id, id))
    .returning()

  return deleted
}

export const createAiAgent = async (agent: newAiAgent) => {
  const [inserted] = await db.insert(aiAgents).values(agent).returning()
  return inserted
}

export const getAiAgents = async ({
  state,
  userId,
  guestId,
  include: appId,
}: {
  state?: ("active" | "testing" | "inactive")[]
  userId?: string
  guestId?: string
  include?: string
} = {}) => {
  const result = await db
    .select()
    .from(aiAgents)
    .where(
      and(
        state ? inArray(aiAgents.state, state) : undefined,
        userId ? eq(aiAgents.userId, userId) : undefined,
        guestId ? eq(aiAgents.guestId, guestId) : undefined,
        appId
          ? or(isNull(aiAgents.appId), eq(aiAgents.appId, appId))
          : undefined,
      ),
    )
    .orderBy(aiAgents.order)
  return result
}

export const getAiAgent = async ({
  id,
  name,
}: {
  id?: string
  name?: "deepSeek" | "chatGPT" | "claude" | "gemini" | "flux" | "perplexity"
}) => {
  const [result] = await db
    .select()
    .from(aiAgents)
    .where(
      and(
        id ? eq(aiAgents.id, id) : undefined,
        name ? eq(aiAgents.name, name) : undefined,
      ),
    )
    .limit(1)
  return result
}

export const createCollaboration = async (collaboration: newCollaboration) => {
  const [inserted] = await db
    .insert(collaborations)
    .values(collaboration)
    .returning()
  return inserted
}

export const getCollaborations = async ({
  threadId,
  status,
  userId,
}: {
  threadId: string
  status?: ("pending" | "revoked" | "rejected" | "active")[]
  userId?: string
}) => {
  const result = await db
    .select({
      thread: threads,
      user: users,
      collaboration: collaborations,
    })
    .from(collaborations)
    .innerJoin(users, eq(collaborations.userId, users.id))
    .innerJoin(threads, eq(collaborations.threadId, threads.id))
    .where(
      and(
        userId ? eq(collaborations.userId, userId) : undefined,
        eq(collaborations.threadId, threadId),
        status ? inArray(collaborations.status, status) : undefined,
      ),
    )
  return result
}

export const getCollaboration = async ({
  id,
  userId,
  threadId,
}: {
  id?: string
  userId?: string
  threadId?: string
}) => {
  if (!id && !userId && !threadId) {
    throw new Error("Missing id or userId")
  }
  const [result] = await db
    .select()
    .from(collaborations)
    .where(
      and(
        id ? eq(collaborations.id, id) : undefined,
        userId ? eq(collaborations.userId, userId) : undefined,
        threadId ? eq(collaborations.threadId, threadId) : undefined,
      ),
    )
  return result
}

export const updateCollaboration = async (collaboration: collaboration) => {
  const [updated] = await db
    .update(collaborations)
    .set(collaboration)
    .where(eq(collaborations.id, collaboration.id))
    .returning()

  return updated
}

export const deleteCollaboration = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(collaborations)
    .where(eq(collaborations.id, id))
    .returning()

  return deleted
}

export const getCreditUsage = async ({
  userId,
  guestId,
  fromDate,
}: {
  userId?: string
  guestId?: string
  fromDate?: Date
}) => {
  const result = await db
    .select()
    .from(creditUsage)
    .where(
      and(
        userId ? eq(creditUsage.userId, userId) : undefined,
        guestId ? eq(creditUsage.guestId, guestId) : undefined,
        fromDate ? gte(creditUsage.createdOn, fromDate) : undefined,
      ),
    )
    .orderBy(desc(creditUsage.createdOn))

  return result
}

export const updateCreditUsage = async (data: creditUsage) => {
  const [updated] = await db
    .update(creditUsage)
    .set(data)
    .where(eq(creditUsage.id, data.id))
    .returning()

  return updated
}

export const deleteCreditUsage = async ({
  id,
  guestId,
  userId,
}: {
  id?: string
  guestId?: string
  userId?: string
}) => {
  if (!id && !guestId && !userId) {
    throw new Error("Missing id or guestId or userId")
  }
  const [deleted] = await db
    .delete(creditUsage)
    .where(
      and(
        id ? eq(creditUsage.id, id) : undefined,
        guestId ? eq(creditUsage.guestId, guestId) : undefined,
        userId ? eq(creditUsage.userId, userId) : undefined,
      ),
    )
    .returning()

  return deleted
}

export async function createPushSubscription({
  userId,
  subscription,
  guestId,
}: {
  userId?: string
  subscription: NewCustomPushSubscription
  guestId?: string
}) {
  const [result] = await db
    .insert(pushSubscriptions)
    .values({
      userId,
      guestId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .returning()

  return result
    ? await getPushSubscription({
        id: result.id,
      })
    : undefined
}

export async function getPushSubscription({
  id,
  userId,
  endpoint,
  guestId,
}: {
  id?: string
  userId?: string
  endpoint?: string
  guestId?: string
}): Promise<CustomPushSubscription | undefined> {
  try {
    const [subscription] = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          guestId ? eq(pushSubscriptions.guestId, guestId) : undefined,
          id ? eq(pushSubscriptions.id, id) : undefined,
          userId ? eq(pushSubscriptions.userId, userId) : undefined,
          endpoint ? eq(pushSubscriptions.endpoint, endpoint) : undefined,
        ),
      )
      .orderBy(desc(pushSubscriptions.createdOn))
      .limit(1)

    if (!subscription) {
      return
    }

    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
      id: subscription.id,
      createdOn: subscription.createdOn,
      updatedOn: subscription.updatedOn,
    }
  } catch (error) {
    console.error("Error retrieving push subscription:", error)
    return
  }
}

export async function getPushSubscriptions({
  userId,
  guestId,
}: {
  userId?: string
  guestId?: string
}): Promise<CustomPushSubscription[]> {
  const result = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        userId ? eq(pushSubscriptions.userId, userId) : undefined,
        guestId ? eq(pushSubscriptions.guestId, guestId) : undefined,
      ),
    )
    .orderBy(desc(pushSubscriptions.createdOn))

  return result.map((subscription) => {
    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
      id: subscription.id,
      createdOn: subscription.createdOn,
      updatedOn: subscription.updatedOn,
    }
  })
}

export async function createInvitation(invitation: newInvitation) {
  const [inserted] = await db.insert(invitations).values(invitation).returning()

  return inserted
}

export async function getInvitation({
  email,
  threadId,
}: {
  email: string
  threadId?: string
}) {
  const [result] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        threadId ? eq(invitations.threadId, threadId) : undefined,
      ),
    )
    .innerJoin(threads, eq(invitations.threadId, threads.id))
    .limit(1)
  return result?.invitations
}

export async function updateInvitation(invitation: invitation) {
  const [updated] = await db
    .update(invitations)
    .set(invitation)
    .where(eq(invitations.id, invitation.id))
    .returning()

  return updated
}

export async function deleteInvitation({ id }: { id: string }) {
  const [deleted] = await db
    .delete(invitations)
    .where(eq(invitations.id, id))
    .returning()

  return deleted
}

export async function createCharacterTag(characterTag: newCharacterProfile) {
  const [inserted] = await db
    .insert(characterProfiles)
    .values(characterTag)
    .returning()

  return inserted
}

export async function getCharacterTag({ id }: { id: string }) {
  const [result] = await db
    .select()
    .from(characterProfiles)
    .where(eq(characterProfiles.id, id))
  return result
}

export async function updateCharacterTag(characterTag: characterProfile) {
  const [updated] = await db
    .update(characterProfiles)
    .set(characterTag)
    .where(eq(characterProfiles.id, characterTag.id))
    .returning()

  return updated
}

export async function deleteCharacterTag({ id }: { id: string }) {
  const [deleted] = await db
    .delete(characterProfiles)
    .where(eq(characterProfiles.id, id))
    .returning()

  return deleted
}

export async function getCharacterTags({ agentId }: { agentId: string }) {
  const result = await db
    .select()
    .from(characterProfiles)
    .where(eq(characterProfiles.agentId, agentId))
  return result
}

export async function createMemory(memory: newMemory) {
  const [inserted] = await db.insert(memories).values(memory).returning()

  return inserted
}

export async function getMemory({
  id,
  userId,
  guestId,
}: {
  id?: string
  userId?: string
  guestId?: string
}) {
  const [result] = await db
    .select()
    .from(memories)
    .where(
      and(
        id ? eq(memories.id, id) : undefined,
        userId ? eq(memories.userId, userId) : undefined,
        guestId ? eq(memories.guestId, guestId) : undefined,
      ),
    )
  return result
}
export async function updateMemory(memory: memory) {
  const [updated] = await db
    .update(memories)
    .set(memory)
    .where(eq(memories.id, memory.id))
    .returning()

  return updated
}
export async function deleteMemory({ id }: { id: string }) {
  const [deleted] = await db
    .delete(memories)
    .where(eq(memories.id, id))
    .returning()

  return deleted
}

// Reinforce a memory after it's recalled (spaced repetition)
export async function reinforceMemory(
  memoryId: string,
  contextCategory?: string,
) {
  await db
    .update(memories)
    .set({
      usageCount: sql`${memories.usageCount} + 1`,
      importance: sql`${memories.importance} + 
        CASE 
          WHEN ${contextCategory ? sql`${memories.category} = ${contextCategory}` : sql`false`} THEN 0.2 
          ELSE 0.05 
        END`,
      lastUsedAt: new Date(),
    })
    .where(eq(memories.id, memoryId))
}

// Apply decay periodically (e.g. via cron job or background task)
export async function decayMemories() {
  await db.execute(sql`
    UPDATE memories
    SET importance = importance * 
      CASE 
        WHEN "lastUsedAt" > NOW() - INTERVAL '7 days' THEN 1.0
        WHEN "lastUsedAt" > NOW() - INTERVAL '30 days' THEN 0.9
        WHEN "lastUsedAt" > NOW() - INTERVAL '90 days' THEN 0.8
        ELSE 0.6
      END
  `)
}

export async function getMemories({
  userId,
  guestId,
  appId,
  pageSize = 500,
  page = 1,
  orderBy = "createdOn",
  excludeThreadId,
  scatterAcrossThreads = false,
}: {
  userId?: string
  guestId?: string
  appId?: string
  pageSize?: number
  page?: number
  orderBy?: "createdOn" | "importance"
  excludeThreadId?: string
  scatterAcrossThreads?: boolean
}) {
  const conditions = []

  if (userId) {
    conditions.push(eq(memories.userId, userId))
  }

  if (guestId) {
    conditions.push(eq(memories.guestId, guestId))
  }

  if (appId) {
    conditions.push(eq(memories.appId, appId))
  }

  // Exclude memories from current thread
  if (excludeThreadId) {
    conditions.push(sql`${memories.sourceThreadId} != ${excludeThreadId}`)
  }

  if (scatterAcrossThreads && orderBy === "importance") {
    // Smart scatter: Get ONE memory per thread using Drizzle subquery
    // Use window function to rank memories within each thread, then take top 1
    const rankedMemories = db.$with("ranked_memories").as(
      db
        .select({
          id: memories.id,
          userId: memories.userId,
          guestId: memories.guestId,
          appId: memories.appId,
          content: memories.content,
          title: memories.title,
          tags: memories.tags,
          category: memories.category,
          importance: memories.importance,
          usageCount: memories.usageCount,
          lastUsedAt: memories.lastUsedAt,
          embedding: memories.embedding,
          sourceThreadId: memories.sourceThreadId,
          sourceMessageId: memories.sourceMessageId,
          metadata: memories.metadata,
          createdOn: memories.createdOn,
          updatedOn: memories.updatedOn,
          rn: sql<number>`ROW_NUMBER() OVER (
              PARTITION BY ${memories.sourceThreadId} 
              ORDER BY 
                (${memories.importance} * 
                  CASE 
                    WHEN ${memories.createdOn} > NOW() - INTERVAL '7 days' THEN 1.5
                    WHEN ${memories.createdOn} > NOW() - INTERVAL '30 days' THEN 1.2
                    WHEN ${memories.createdOn} > NOW() - INTERVAL '90 days' THEN 1.0
                    ELSE 0.7
                  END
                ) DESC,
                ${memories.createdOn} DESC
            )`.as("rn"),
        })
        .from(memories)
        .where(and(...conditions)),
    )

    const result = await db
      .with(rankedMemories)
      .select({
        id: rankedMemories.id,
        userId: rankedMemories.userId,
        guestId: rankedMemories.guestId,
        appId: rankedMemories.appId,
        content: rankedMemories.content,
        title: rankedMemories.title,
        tags: rankedMemories.tags,
        category: rankedMemories.category,
        importance: rankedMemories.importance,
        usageCount: rankedMemories.usageCount,
        lastUsedAt: rankedMemories.lastUsedAt,
        embedding: rankedMemories.embedding,
        sourceThreadId: rankedMemories.sourceThreadId,
        sourceMessageId: rankedMemories.sourceMessageId,
        metadata: rankedMemories.metadata,
        createdOn: rankedMemories.createdOn,
        updatedOn: rankedMemories.updatedOn,
      })
      .from(rankedMemories)
      .where(eq(rankedMemories.rn, 1))
      .orderBy(desc(rankedMemories.createdOn))
      .limit(pageSize)

    const totalCount =
      (
        await db
          .select({ count: count(memories.id) })
          .from(memories)
          .where(and(...conditions))
      )[0]?.count ?? 0

    const hasNextPage = totalCount > page * pageSize
    const nextPage = hasNextPage ? page + 1 : null
    return {
      memories: result,
      totalCount,
      hasNextPage,
      nextPage,
    }
  }

  // Standard query (no scatter)
  const result = await db
    .select()
    .from(memories)
    .where(and(...conditions))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .orderBy(
      orderBy === "createdOn"
        ? desc(memories.createdOn)
        : sql`(${memories.importance} * 
            CASE 
              WHEN ${memories.createdOn} > NOW() - INTERVAL '7 days' THEN 1.5
              WHEN ${memories.createdOn} > NOW() - INTERVAL '30 days' THEN 1.2
              WHEN ${memories.createdOn} > NOW() - INTERVAL '90 days' THEN 1.0
              ELSE 0.7
            END) DESC`,
    )

  const totalCount =
    (
      await db
        .select({ count: count(memories.id) })
        .from(memories)
        .where(and(...conditions))
    )[0]?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null
  return {
    memories: result,
    totalCount,
    hasNextPage,
    nextPage,
  }
}

export async function getAccount({
  userId,
  provider,
}: {
  userId: string
  provider: string
}) {
  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)))
    .limit(1)

  return account[0]
}

export const updateAccount = async (account: account) => {
  const [updated] = await db
    .update(accounts)
    .set(account)
    .where(
      and(
        eq(accounts.provider, account.provider),
        eq(accounts.providerAccountId, account.providerAccountId),
      ),
    )
    .returning()

  return updated
}

export async function createThreadSummary(threadSummary: newThreadSummary) {
  const [inserted] = await db
    .insert(threadSummaries)
    .values(threadSummary)
    .returning()

  return inserted
}

export async function getThreadSummary({
  id,
  userId,
  guestId,
  threadId,
}: {
  id?: string
  userId?: string
  guestId?: string
  threadId?: string
}) {
  const [result] = await db
    .select()
    .from(threadSummaries)
    .where(
      and(
        threadId ? eq(threadSummaries.threadId, threadId) : undefined,
        id ? eq(threadSummaries.id, id) : undefined,
        userId ? eq(threadSummaries.userId, userId) : undefined,
        guestId ? eq(threadSummaries.guestId, guestId) : undefined,
      ),
    )
  return result
}

export const getThreadSummaries = async ({
  guestId,
  userId,
  threadId,
  pageSize = 500,
  page = 1,
  hasMemories = false,
}: {
  guestId?: string
  userId?: string
  threadId?: string
  pageSize?: number
  page?: number
  hasMemories?: boolean
}) => {
  const conditions = []

  if (userId) {
    conditions.push(eq(threadSummaries.userId, userId))
  }

  if (guestId) {
    conditions.push(eq(threadSummaries.guestId, guestId))
  }

  if (threadId) {
    conditions.push(eq(threadSummaries.threadId, threadId))
  }

  if (hasMemories) {
    conditions.push(
      exists(
        db
          .select()
          .from(memories)
          .where(eq(memories.sourceThreadId, threadSummaries.threadId)),
      ),
    )
  }

  const result = await db
    .select()
    .from(threadSummaries)
    .where(and(...conditions))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .orderBy(desc(threadSummaries.createdOn))

  const totalCount =
    (
      await db
        .select({ count: count(threadSummaries.id) })
        .from(threadSummaries)
        .where(and(...conditions))
    )[0]?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null
  return {
    threadSummaries: result,
    totalCount,
    hasNextPage,
    nextPage,
  }
}

export async function updateThreadSummary(threadSummary: threadSummary) {
  const [updated] = await db
    .update(threadSummaries)
    .set(threadSummary)
    .where(eq(threadSummaries.id, threadSummary.id))
    .returning()

  return updated
}
export async function deleteThreadSummary({ id }: { id: string }) {
  const [deleted] = await db
    .delete(threadSummaries)
    .where(eq(threadSummaries.id, id))
    .returning()

  return deleted
}

export async function createCreditTransaction(
  creditTransaction: newCreditTransaction,
) {
  const [inserted] = await db
    .insert(creditTransactions)
    .values(creditTransaction)
    .returning()

  return inserted
}

export async function updateCreditTransaction(
  creditTransaction: creditTransaction,
) {
  const [updated] = await db
    .update(creditTransactions)
    .set(creditTransaction)
    .where(eq(creditTransactions.id, creditTransaction.id))
    .returning()

  return updated
}
export async function deleteCreditTransaction({ id }: { id: string }) {
  const [deleted] = await db
    .delete(creditTransactions)
    .where(eq(creditTransactions.id, id))
    .returning()

  return deleted
}

export async function getCreditTransactions({
  id,
  userId,
  guestId,
  fromDate,
  type,
}: {
  id?: string
  userId?: string
  guestId?: string
  fromDate?: Date
  type?: "purchase" | "subscription"
}) {
  const result = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        id ? eq(creditTransactions.id, id) : undefined,
        userId ? eq(creditTransactions.userId, userId) : undefined,
        guestId ? eq(creditTransactions.guestId, guestId) : undefined,
        fromDate ? gte(creditTransactions.createdOn, fromDate) : undefined,
        type ? eq(creditTransactions.type, type) : undefined,
      ),
    )
    .orderBy(desc(creditTransactions.createdOn))
  return result
}

export async function createCalendarEvent(calendarEvent: newCalendarEvent) {
  const [inserted] = await db
    .insert(calendarEvents)
    .values(calendarEvent)
    .returning()

  return inserted
}

export async function updateCalendarEvent(calendarEvent: calendarEvent) {
  const [updated] = await db
    .update(calendarEvents)
    .set(calendarEvent)
    .where(eq(calendarEvents.id, calendarEvent.id))
    .returning()

  return updated
}

export async function deleteCalendarEvent({ id }: { id: string }) {
  const [deleted] = await db
    .delete(calendarEvents)
    .where(eq(calendarEvents.id, id))
    .returning()

  return deleted
}

export async function getCalendarEvents({
  id,
  userId,
  guestId,
  startTime,
  endTime,
}: {
  id?: string
  userId?: string
  guestId?: string
  startTime?: Date
  endTime?: Date
}) {
  const result = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        id ? eq(calendarEvents.id, id) : undefined,
        userId ? eq(calendarEvents.userId, userId) : undefined,
        guestId ? eq(calendarEvents.guestId, guestId) : undefined,
        startTime ? gte(calendarEvents.startTime, startTime) : undefined,
        endTime ? lte(calendarEvents.endTime, endTime) : undefined,
      ),
    )
    .orderBy(desc(calendarEvents.startTime))
  return result
}

export async function getCalendarEvent({
  id,
  userId,
  guestId,
}: {
  id: string
  userId?: string
  guestId?: string
}) {
  const [result] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        id ? eq(calendarEvents.id, id) : undefined,
        userId ? eq(calendarEvents.userId, userId) : undefined,
        guestId ? eq(calendarEvents.guestId, guestId) : undefined,
      ),
    )
  return result
}

export const getCities = async ({
  name,
  country,
  pageSize = 30,
  page = 1,
  ...rest
}: {
  name?: string
  country?: string
  search?: string
  pageSize?: number
  page?: number
}) => {
  const search =
    rest.search?.length && rest.search.length >= 3 ? rest.search : undefined

  function sanitizeSearchTerm(search: string): string {
    return search.replace(/[^a-zA-Z0-9\s]/g, "")
  }

  function formatSearchTerm(search: string): string {
    return sanitizeSearchTerm(search)
      .split(" ")
      .filter((word) => word.length > 0)
      .map((word) => word + ":*")
      .join(" & ")
  }

  const formattedSearch = search ? formatSearchTerm(search) : undefined

  const matchQuery = search
    ? sql`
    (
      setweight(to_tsvector('english', coalesce(${cities.name}, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(${cities.country}, '')), 'B')
    ) @@ to_tsquery('english', ${sql`${formattedSearch}`}::text)
  `
    : undefined

  const rankQuery = search
    ? sql`
      ts_rank(
        setweight(to_tsvector('english', coalesce(${cities.name}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${cities.country}, '')), 'B'),
        to_tsquery('english', ${sql`${formattedSearch}`}::text)
      )
    `
    : undefined

  // Create base ordering array with required items
  const orderBy = [
    sql`
      CASE
        WHEN ${cities.name} ~ '^[a-zA-Z]+$' THEN 0
        ELSE 1
      END
    `,
    desc(cities.population), // Order by population DESC after other criteria
    cities.name,
  ]

  // Add priority ordering for name and country matches
  if (name || country) {
    orderBy.unshift(
      sql`
        CASE 
          WHEN ${
            name && country
              ? sql`LOWER(${cities.name}) = LOWER(${name}) AND LOWER(${cities.country}) = LOWER(${country})`
              : name
                ? sql`LOWER(${cities.name}) = LOWER(${name})`
                : sql`LOWER(${cities.country}) = LOWER(${country})`
          } THEN 0
          WHEN ${
            name && country
              ? sql`LOWER(${cities.name}) = LOWER(${name})`
              : sql`FALSE`
          } THEN 1
          ELSE 2
        END
      `,
    )
  }

  // Add rank ordering if search is provided
  if (rankQuery) {
    orderBy.unshift(desc(rankQuery))
  }

  const whereConditions = [
    matchQuery,
    name ? ilike(cities.name, `%${name}%`) : undefined,
    !matchQuery && country ? eq(cities.country, country) : undefined,
  ].filter(
    (condition): condition is typeof condition => condition !== undefined,
  )

  return db
    .select()
    .from(cities)
    .orderBy(...orderBy)
    .where(or(...whereConditions))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
}

export const getAffiliateLinks = async ({ userId }: { userId: string }) => {
  return db
    .select()
    .from(affiliateLinks)
    .where(eq(affiliateLinks.userId, userId))
}

export const getAffiliateReferrals = async ({
  affiliateLinkId,
  page = 1,
  pageSize = 30,
  status,
}: {
  affiliateLinkId: string
  page?: number
  pageSize?: number
  status?: "pending" | "converted" | "paid"
}) => {
  const whereConditions = [
    eq(affiliateReferrals.affiliateLinkId, affiliateLinkId),
    status ? eq(affiliateReferrals.status, status) : undefined,
  ]
  const result = await db
    .select()
    .from(affiliateReferrals)
    .where(and(...whereConditions))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalCount =
    (
      await db
        .select({ count: count(affiliateReferrals.id) })
        .from(affiliateReferrals)
        .where(and(...whereConditions))
    )[0]?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null

  return { result, totalCount, nextPage }
}

export const getAffiliatePayouts = async ({
  affiliateLinkId,
  status,
  page = 1,
  pageSize = 30,
}: {
  affiliateLinkId: string
  status?: ("pending" | "processing" | "completed" | "failed")[]
  page?: number
  pageSize?: number
}) => {
  const whereConditions = [
    eq(affiliatePayouts.affiliateLinkId, affiliateLinkId),
    status?.length ? inArray(affiliatePayouts.status, status) : undefined,
  ]
  const result = await db
    .select()
    .from(affiliatePayouts)
    .where(and(...whereConditions))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalCount =
    (
      await db
        .select({ count: count(affiliatePayouts.id) })
        .from(affiliatePayouts)
        .where(and(...whereConditions))
    )[0]?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null

  return { result, totalCount, nextPage }
}

export const getAffiliateLink = async ({
  id,
  code,
  userId,
}: {
  id?: string
  code?: string
  userId?: string
}) => {
  if (!id && !code && !userId) {
    throw new Error("Missing id or code")
  }

  const [result] = await db
    .select()
    .from(affiliateLinks)
    .where(
      and(
        userId ? eq(affiliateLinks.userId, userId) : undefined,
        id ? eq(affiliateLinks.id, id) : undefined,
        code ? eq(affiliateLinks.code, code) : undefined,
      ),
    )

  return result
}

export const getAffiliateReferral = async ({
  id,
  affiliateLinkId,
}: {
  id?: string
  affiliateLinkId?: string
}) => {
  if (!id && !affiliateLinkId) {
    throw new Error("Missing id or affiliateLinkId")
  }

  const [result] = await db
    .select()
    .from(affiliateReferrals)
    .where(
      and(
        id ? eq(affiliateReferrals.id, id) : undefined,
        affiliateLinkId
          ? eq(affiliateReferrals.affiliateLinkId, affiliateLinkId)
          : undefined,
      ),
    )

  return result
}

export const getAffiliatePayout = async ({ id }: { id: string }) => {
  const [result] = await db
    .select()
    .from(affiliatePayouts)
    .where(eq(affiliatePayouts.id, id))

  return result
}

export const createAffiliateLink = async (affiliateLink: newAffiliateLink) => {
  const [inserted] = await db
    .insert(affiliateLinks)
    .values(affiliateLink)
    .returning()

  return inserted
}

export const createAffiliateReferral = async (
  affiliateReferral: newAffiliateReferral,
) => {
  const [inserted] = await db
    .insert(affiliateReferrals)
    .values(affiliateReferral)
    .returning()

  return inserted
}

export const createAffiliatePayout = async (
  affiliatePayout: newAffiliatePayout,
) => {
  const [inserted] = await db
    .insert(affiliatePayouts)
    .values(affiliatePayout)
    .returning()

  return inserted
}

export const updateAffiliateLink = async (affiliateLink: affiliateLink) => {
  const [updated] = await db
    .update(affiliateLinks)
    .set(affiliateLink)
    .where(eq(affiliateLinks.id, affiliateLink.id))
    .returning()

  return updated
}

export const updateAffiliateReferral = async (
  affiliateReferral: affiliateReferral,
) => {
  const [updated] = await db
    .update(affiliateReferrals)
    .set(affiliateReferral)
    .where(eq(affiliateReferrals.id, affiliateReferral.id))
    .returning()

  return updated
}

export const createAffiliateClick = async (
  affiliateClick: newAffiliateClicks,
) => {
  const [inserted] = await db
    .insert(affiliateClicks)
    .values(affiliateClick)
    .returning()

  return inserted
}

export const getAffiliateClick = async ({
  affiliateLinkId,
  userId,
  guestId,
}: {
  affiliateLinkId: string
  userId?: string | null
  guestId?: string | null
}) => {
  const [result] = await db
    .select()
    .from(affiliateClicks)
    .where(
      and(
        affiliateLinkId
          ? eq(affiliateClicks.affiliateLinkId, affiliateLinkId)
          : undefined,
        userId ? eq(affiliateClicks.userId, userId) : undefined,
        guestId ? eq(affiliateClicks.guestId, guestId) : undefined,
      ),
    )
    .limit(1)

  return result
}

export const getAffiliateClicks = async ({
  affiliateLinkId,
  userId,
  guestId,
}: {
  affiliateLinkId?: string
  userId?: string | null
  guestId?: string | null
}) => {
  const result = await db
    .select()
    .from(affiliateClicks)
    .where(
      and(
        affiliateLinkId
          ? eq(affiliateClicks.affiliateLinkId, affiliateLinkId)
          : undefined,
        userId ? eq(affiliateClicks.userId, userId) : undefined,
        guestId ? eq(affiliateClicks.guestId, guestId) : undefined,
      ),
    )

  return result
}

export const updateAffiliateClick = async (affiliateClick: affiliateClick) => {
  const [updated] = await db
    .update(affiliateClicks)
    .set(affiliateClick)
    .where(eq(affiliateClicks.id, affiliateClick.id))
    .returning()

  return updated
}

export const updateAffiliatePayout = async (
  affiliatePayout: affiliatePayout,
) => {
  const [updated] = await db
    .update(affiliatePayouts)
    .set(affiliatePayout)
    .where(eq(affiliatePayouts.id, affiliatePayout.id))
    .returning()

  return updated
}

export const deleteAffiliateLink = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(affiliateLinks)
    .where(eq(affiliateLinks.id, id))
    .returning()

  return deleted
}

export const deleteAffiliateReferral = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(affiliateReferrals)
    .where(eq(affiliateReferrals.id, id))
    .returning()

  return deleted
}

export const deleteAffiliatePayout = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(affiliatePayouts)
    .where(eq(affiliatePayouts.id, id))
    .returning()

  return deleted
}

export const createPlaceHolder = async (placeHolder: newPlaceHolder) => {
  const [inserted] = await db
    .insert(placeHolders)
    .values(placeHolder)
    .returning()

  return inserted
}

export const updatePlaceHolder = async (placeHolder: placeHolder) => {
  const [updated] = await db
    .update(placeHolders)
    .set(placeHolder)
    .where(eq(placeHolders.id, placeHolder.id))
    .returning()

  return updated
}

export const deletePlaceHolder = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(placeHolders)
    .where(eq(placeHolders.id, id))
    .returning()

  return deleted
}

export const getPlaceHolders = async ({
  threadId,
  userId,
  guestId,
}: {
  threadId?: string
  userId?: string
  guestId?: string
}) => {
  const result = await db
    .select()
    .from(placeHolders)
    .where(
      and(
        threadId ? eq(placeHolders.threadId, threadId) : undefined,
        userId ? eq(placeHolders.userId, userId) : undefined,
        guestId ? eq(placeHolders.guestId, guestId) : undefined,
      ),
    )
    .orderBy(desc(placeHolders.createdOn))

  return result
}

export const getPlaceHolder = async ({
  id,
  threadId,
  userId,
  guestId,
  appId,
}: {
  id?: string
  threadId?: string
  userId?: string
  guestId?: string
  appId?: string
}) => {
  const [placeholder] = await db
    .select()
    .from(placeHolders)
    .where(
      and(
        id ? eq(placeHolders.id, id) : undefined,
        threadId
          ? eq(placeHolders.threadId, threadId)
          : isNull(placeHolders.threadId),
        userId ? eq(placeHolders.userId, userId) : undefined,
        guestId ? eq(placeHolders.guestId, guestId) : undefined,
        appId ? eq(placeHolders.appId, appId) : undefined,
      ),
    )
    .orderBy(desc(placeHolders.createdOn))

  return placeholder
}

export const getPlaceHolderByThreadId = async ({
  threadId,
}: {
  threadId: string
}) => {
  const [placeholder] = await db
    .select()
    .from(placeHolders)
    .where(eq(placeHolders.threadId, threadId))

  return placeholder
}

export const createInstruction = async (instruction: newInstruction) => {
  const [inserted] = await db
    .insert(instructions)
    .values(instruction)
    .returning()

  return inserted
}

export const updateInstruction = async (instruction: instruction) => {
  const [updated] = await db
    .update(instructions)
    .set(instruction)
    .where(eq(instructions.id, instruction.id))
    .returning()

  return updated
}

export const deleteInstruction = async ({ id }: { id: string }) => {
  const [deleted] = await db
    .delete(instructions)
    .where(eq(instructions.id, id))
    .returning()

  return deleted
}

export const getInstructions = async ({
  userId,
  guestId,
  appId,
  pageSize = 7,
  page = 1,
  perApp = false, // NEW: Get 7 per app instead of total
}: {
  threadId?: string
  userId?: string
  guestId?: string
  appId?: string
  pageSize?: number
  page?: number
  perApp?: boolean // NEW: Distribute pageSize across all apps
}) => {
  // If perApp is true, get pageSize instructions per app
  if (perApp) {
    const allApps = await getApps({
      userId,
      guestId,
      pageSize: 50,
      page,
    })
    const appIds = [null, ...allApps.items.map((app) => app.id)] // null = general instructions

    const instructionsByApp = await Promise.all(
      appIds.map(async (currentAppId) => {
        const conditions = []

        if (userId) {
          conditions.push(eq(instructions.userId, userId))
        }

        if (guestId) {
          conditions.push(eq(instructions.guestId, guestId))
        }

        if (currentAppId) {
          conditions.push(eq(instructions.appId, currentAppId))
        } else {
          conditions.push(isNull(instructions.appId))
        }

        return await db
          .select()
          .from(instructions)
          .where(and(...conditions))
          .orderBy(desc(instructions.createdOn))
          .limit(pageSize) // pageSize per app (e.g., 7 per app)
      }),
    )

    // Flatten and return (e.g., 7 × 5 = 35 instructions)
    return instructionsByApp.flat()
  }

  // Original behavior: single query with total limit
  const conditions = []

  if (appId) {
    conditions.push(eq(instructions.appId, appId))
  }

  if (userId) {
    conditions.push(eq(instructions.userId, userId))
  }

  if (guestId) {
    conditions.push(eq(instructions.guestId, guestId))
  }

  const result = await db
    .select()
    .from(instructions)
    .where(and(...conditions))
    .orderBy(desc(instructions.createdOn))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return result
}

export const createApp = async (app: newApp) => {
  const [inserted] = await db.insert(apps).values(app).returning()

  return inserted
}

export const createPureApp = async (app: newApp) => {
  const [inserted] = await db.insert(apps).values(app).returning()

  return inserted
    ? await getPureApp({
        id: inserted.id,
        userId: app.userId || undefined,
        guestId: app.guestId || undefined,
        isSafe: false,
      })
    : undefined
}

export const updatePureApp = async (app: app) => {
  const [updated] = await db
    .update(apps)
    .set(app)
    .where(eq(apps.id, app.id))
    .returning()

  return updated
    ? await getPureApp({
        id: updated.id,
        userId: app.userId || undefined,
        guestId: app.guestId || undefined,
        isSafe: false,
      })
    : undefined
}

export const updateApp = async (app: app) => {
  const [updated] = await db
    .update(apps)
    .set(app)
    .where(eq(apps.id, app.id))
    .returning()

  return updated
    ? await getApp({
        id: updated.id,
        userId: app.userId || undefined,
        guestId: app.guestId || undefined,
        isSafe: false,
      })
    : undefined
}

export const createOrUpdateApp = async ({
  app,
  extends: extendsList,
}: {
  app: newApp
  extends?: string[]
}) => {
  // Check if app exists
  const existingApp = app.id ? await getPureApp({ id: app.id }) : null

  let result

  if (existingApp) {
    // Update existing app
    const [updated] = await db
      .update(apps)
      .set(app)
      .where(eq(apps.id, app.id!))
      .returning()

    result = updated
      ? await getPureApp({
          id: updated.id,
          userId: app.userId || undefined,
          guestId: app.guestId || undefined,
          isSafe: false,
        })
      : undefined
  } else {
    // Create new app
    const [inserted] = await db.insert(apps).values(app).returning()
    result = inserted
      ? await getPureApp({
          id: inserted.id,
          userId: app.userId || undefined,
          guestId: app.guestId || undefined,
          isSafe: false,
        })
      : undefined
  }
  if (!result) {
    return
  }

  // Handle extends relationships
  if (extendsList && extendsList.length > 0) {
    // Delete existing extends relationships
    await db.delete(appExtend).where(eq(appExtend.appId, result.id))

    // Insert new extends relationships
    const extendsData = extendsList.map((toId) => ({
      appId: result!.id,
      toId,
    }))

    await db.insert(appExtend).values(extendsData)
    console.log(`✅ Created ${extendsData.length} extends relationships`)

    // Install extended apps to the same store
    if (result.storeId) {
      // Get existing store installs for extended apps
      const existingInstalls = await db
        .select()
        .from(storeInstalls)
        .where(eq(storeInstalls.storeId, result.storeId))

      const existingAppIds = new Set(
        existingInstalls.map((install) => install.appId),
      )

      // Install only new extended apps (avoid duplicates)
      const newInstalls = extendsList
        .filter((appId) => !existingAppIds.has(appId))
        .map((appId) => ({
          storeId: result!.storeId!,
          appId,
        }))

      if (newInstalls.length > 0) {
        await db.insert(storeInstalls).values(newInstalls)
        console.log(`✅ Installed ${newInstalls.length} extended apps to store`)
      }
    }
  }

  return result
}

export const deleteApp = async ({ id }: { id: string }) => {
  const [deleted] = await db.delete(apps).where(eq(apps.id, id)).returning()

  return deleted
}

export const updateInstallOrder = async ({
  appId,
  userId,
  guestId,
  order,
}: {
  appId: string
  userId?: string
  guestId?: string
  order: number
}) => {
  const conditions = [eq(installs.appId, appId)]

  if (userId) {
    conditions.push(eq(installs.userId, userId))
  }

  if (guestId) {
    conditions.push(eq(installs.guestId, guestId))
  }

  const [updated] = await db
    .update(installs)
    .set({ order })
    .where(and(...conditions))
    .returning()

  return updated
}

export const getApp = async ({
  name,
  id,
  slug,
  userId,
  guestId,
  storeId,
  isSafe = true,
  depth = 0,
}: {
  name?: "Atlas" | "Peach" | "Vault" | "Bloom"
  id?: string
  slug?: string
  userId?: string
  guestId?: string
  storeId?: string
  isSafe?: boolean
  depth?: number
}): Promise<appWithStore | undefined> => {
  // Build app identification conditions
  const appConditions = []

  if (name) {
    appConditions.push(
      eq(apps.name, name as "Atlas" | "Peach" | "Vault" | "Bloom"),
    )
  }

  if (slug) {
    appConditions.push(eq(apps.slug, slug))
  }

  if (id) {
    appConditions.push(eq(apps.id, id))
  }

  // Build access conditions (can user/guest access this app?)
  // Skip access check when searching by ID (direct lookup)
  const accessConditions = id
    ? undefined
    : or(
        // User's own apps
        userId ? eq(apps.userId, userId) : undefined,
        // Guest's own apps
        guestId ? eq(apps.guestId, guestId) : undefined,
        // System apps (no owner)
        and(isNull(apps.userId), isNull(apps.guestId)),
        // Installed apps (via installs table)
        // userId || guestId
        //   ? exists(
        //       db
        //         .select()
        //         .from(installs)
        //         .where(
        //           and(
        //             eq(installs.appId, apps.id),
        //             userId ? eq(installs.userId, userId) : undefined,
        //             guestId ? eq(installs.guestId, guestId) : undefined,
        //             isNull(installs.uninstalledAt),
        //           ),
        //         ),
        //     )
        //   : undefined,
      )

  const [app] = await db
    .select({
      app: apps,
      user: users,
      guest: guests,
    })
    .from(apps)
    .leftJoin(users, eq(apps.userId, users.id))
    .leftJoin(guests, eq(apps.guestId, guests.id))
    .where(
      and(
        appConditions.length > 0 ? and(...appConditions) : undefined,
        accessConditions,
      ),
    )

  if (!app) return undefined

  // Determine which store to use:
  // 1. If storeId provided, check if app belongs to that store context
  // 2. App belongs if: installed via storeInstalls OR in parent store chain
  // 3. If belongs, use provided storeId (domain store context)
  // 4. Otherwise, use app's own storeId
  let targetStoreId = app.app.storeId

  if (storeId && storeId !== app.app.storeId) {
    // Check if app is installed in the provided store
    const [installation] = await db
      .select()
      .from(storeInstalls)
      .where(
        and(
          eq(storeInstalls.storeId, storeId),
          eq(storeInstalls.appId, app.app.id),
        ),
      )
      .limit(1)

    // Check if app's store is in the parent chain of provided store
    const [providedStore] = await db
      .select({ parentStoreId: stores.parentStoreId })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1)

    let isInParentChain = false
    let currentParentId = providedStore?.parentStoreId
    while (currentParentId && !isInParentChain) {
      if (currentParentId === app.app.storeId) {
        isInParentChain = true
      } else {
        const [parentStore] = await db
          .select({ parentStoreId: stores.parentStoreId })
          .from(stores)
          .where(eq(stores.id, currentParentId))
          .limit(1)
        currentParentId = parentStore?.parentStoreId || null
      }
    }

    // If installed or in parent chain, use the provided store context
    if (installation || isInParentChain) {
      targetStoreId = storeId
    }
  }

  const storeData = targetStoreId
    ? await getStore({ id: targetStoreId, userId, guestId, depth })
    : undefined

  // Build store with apps array for hyperlink navigation
  const storeWithApps = storeData
    ? {
        ...storeData.store,
        title: storeData.store.name, // Use name as title
        apps: storeData.apps,
        app: storeData.app, // Include the store's base app
      }
    : undefined

  return {
    ...(isSafe ? (toSafeApp({ app: app.app }) as app) : app.app),
    extends: await getAppExtends({
      appId: app.app.id,
    }),
    user: app.user,
    guest: app.guest,
    store: storeWithApps,
    placeHolder: await getPlaceHolder({
      appId: app.app.id,
      userId,
      guestId,
    }),
  } as appWithStore
}
export const getPureApp = async ({
  name,
  id,
  slug,
  userId,
  guestId,
  storeId,
  isSafe = true,
  depth = 0,
}: {
  name?: "Atlas" | "Peach" | "Vault" | "Bloom" | "Vex"
  id?: string
  slug?: string
  userId?: string
  guestId?: string
  storeId?: string
  isSafe?: boolean
  depth?: number
}): Promise<app | undefined> => {
  // Build app identification conditions
  const appConditions = []

  if (name) {
    appConditions.push(
      eq(apps.name, name as "Atlas" | "Peach" | "Vault" | "Bloom"),
    )
  }

  if (slug) {
    appConditions.push(eq(apps.slug, slug))
  }

  if (id) {
    appConditions.push(eq(apps.id, id))
  }

  // Build access conditions (can user/guest access this app?)
  // Skip access check when searching by ID (direct lookup)
  const accessConditions = id
    ? undefined
    : or(
        // User's own apps
        userId ? eq(apps.userId, userId) : undefined,
        // Guest's own apps
        guestId ? eq(apps.guestId, guestId) : undefined,
        // System apps (no owner)
        and(isNull(apps.userId), isNull(apps.guestId)),
        // Installed apps (via installs table)
        userId || guestId
          ? exists(
              db
                .select()
                .from(installs)
                .where(
                  and(
                    eq(installs.appId, apps.id),
                    userId ? eq(installs.userId, userId) : undefined,
                    guestId ? eq(installs.guestId, guestId) : undefined,
                    isNull(installs.uninstalledAt),
                  ),
                ),
            )
          : undefined,
      )

  const [app] = await db
    .select({
      app: apps,
      user: users,
      guest: guests,
    })
    .from(apps)
    .leftJoin(users, eq(apps.userId, users.id))
    .leftJoin(guests, eq(apps.guestId, guests.id))
    .where(
      and(
        appConditions.length > 0 ? and(...appConditions) : undefined,
        accessConditions,
      ),
    )

  if (!app) return undefined

  // Determine which store to use:
  // 1. If storeId provided, check if app belongs to that store context
  // 2. App belongs if: installed via storeInstalls OR in parent store chain
  // 3. If belongs, use provided storeId (domain store context)
  // 4. Otherwise, use app's own storeId
  let targetStoreId = app.app.storeId

  if (storeId && storeId !== app.app.storeId) {
    // Check if app is installed in the provided store
    const [installation] = await db
      .select()
      .from(storeInstalls)
      .where(
        and(
          eq(storeInstalls.storeId, storeId),
          eq(storeInstalls.appId, app.app.id),
        ),
      )
      .limit(1)

    // Check if app's store is in the parent chain of provided store
    const [providedStore] = await db
      .select({ parentStoreId: stores.parentStoreId })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1)

    let isInParentChain = false
    let currentParentId = providedStore?.parentStoreId
    while (currentParentId && !isInParentChain) {
      if (currentParentId === app.app.storeId) {
        isInParentChain = true
      } else {
        const [parentStore] = await db
          .select({ parentStoreId: stores.parentStoreId })
          .from(stores)
          .where(eq(stores.id, currentParentId))
          .limit(1)
        currentParentId = parentStore?.parentStoreId || null
      }
    }

    // If installed or in parent chain, use the provided store context
    if (installation || isInParentChain) {
      targetStoreId = storeId
    }
  }

  const storeData = targetStoreId
    ? await getStore({ id: targetStoreId, userId, guestId, depth })
    : undefined

  // Build store with apps array for hyperlink navigation
  const storeWithApps = storeData
    ? {
        ...storeData.store,
        title: storeData.store.name, // Use name as title
        apps: storeData.apps,
        app: storeData.app, // Include the store's base app
      }
    : undefined

  return {
    ...(isSafe ? (toSafeApp({ app: app.app }) as app) : app.app),
  } as app
}

export function toSafeApp({ app }: { app: app }) {
  const result: Partial<app> = {
    id: app.id,
    name: app.name,
    tools: app.tools,
    title: app.title,
    slug: app.slug,
    visibility: app.visibility,
    capabilities: app.capabilities,
    description: app.description,
    icon: app.icon,
    themeColor: app.themeColor,
    createdOn: app.createdOn,
    updatedOn: app.updatedOn,
    defaultModel: app.defaultModel,
    highlights: app.highlights,
    images: app.images,
    features: app.features,
    userId: app.userId,
    guestId: app.guestId,
    backgroundColor: app.backgroundColor,
    onlyAgent: app.onlyAgent,
    tips: app.tips,
    tipsTitle: app.tipsTitle,
    storeId: app.storeId,
    extend: app.extend,
    pricing: app.pricing,
    tier: app.tier,
    placeholder: app.placeholder,
  }

  return result
}

export function toSafeUser({ user }: { user: user }) {
  const result: Partial<user> = {
    id: user.id,
    name: user.name,
    userName: user?.userName,
    image: user?.image,
    // email: user?.email,
    role: user.role,
    // createdOn: user.createdOn,
    // updatedOn: user.updatedOn,
  }

  return result
}

export function toSafeGuest({ guest }: { guest: guest }) {
  const result: Partial<guest> = {
    id: guest.id,
    activeOn: guest.activeOn,
    ip: guest.ip,
    // country: guest.country,
    // city: guest.city,
    // fingerprint: guest.fingerprint,
    // email: guest.email,
    // weather: guest.weather,
    // timezone: guest.timezone,
    // createdOn: guest.createdOn,
    // updatedOn: guest.updatedOn,
  }

  return result
}

export const getApps = async (
  {
    userId,
    guestId,
    isSafe = true,
    page = 1,
    storeId,
    pageSize = 50,
  }: {
    userId?: string
    guestId?: string
    isSafe?: boolean
    page?: number
    storeId?: string
    pageSize?: number
  } = {
    isSafe: true,
  },
): Promise<{
  items: appWithStore[]
  totalCount: number
  hasNextPage: boolean
  nextPage: number | null
}> => {
  // Get store's default app and build parent store chain if storeId provided
  let storeDefaultAppId: string | undefined
  let storeIds: string[] = []

  if (storeId) {
    const store = await db
      .select({ appId: stores.appId, parentStoreId: stores.parentStoreId })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1)

    storeDefaultAppId = store[0]?.appId || undefined
    storeIds.push(storeId)

    // Build parent store chain (walk up the tree)
    let currentParentId = store[0]?.parentStoreId
    while (currentParentId) {
      storeIds.push(currentParentId)
      const parentStore = await db
        .select({ parentStoreId: stores.parentStoreId })
        .from(stores)
        .where(eq(stores.id, currentParentId))
        .limit(1)
      currentParentId = parentStore[0]?.parentStoreId || null
    }
  }

  const conditions = and(
    // Filter by storeId if provided - include apps from store chain OR installed apps
    storeId
      ? or(
          // Apps in current store or any parent store
          storeIds.length > 0 ? inArray(apps.storeId, storeIds) : undefined,
          // Apps installed via storeInstalls
          exists(
            db
              .select()
              .from(storeInstalls)
              .where(
                and(
                  eq(storeInstalls.storeId, storeId),
                  eq(storeInstalls.appId, apps.id),
                ),
              ),
          ),
        )
      : undefined,
    // Access conditions: user's apps OR guest's apps OR public system apps
    storeId
      ? undefined // If filtering by store, show all apps in that store
      : or(
          userId ? eq(apps.userId, userId) : undefined,
          guestId ? eq(apps.guestId, guestId) : undefined,
          // Public system apps (no owner)
          and(isNull(apps.userId), isNull(apps.guestId)),
        ),
  )

  // Get apps with custom ordering information
  // Order by: 1. Store default app, 2. Chrry, 3. Custom app order (per store+user/guest), 4. Store install display order, 5. Creation date
  const result = await db
    .select({
      app: apps,
      store: stores,
      appOrder: appOrders,
      storeInstall: storeInstalls,
    })
    .from(apps)
    .innerJoin(stores, eq(apps.storeId, stores.id))
    .leftJoin(
      appOrders,
      and(
        eq(appOrders.appId, apps.id),
        storeId ? eq(appOrders.storeId, storeId) : undefined,
        userId ? eq(appOrders.userId, userId) : undefined,
        guestId ? eq(appOrders.guestId, guestId) : undefined,
      ),
    )
    .leftJoin(
      storeInstalls,
      and(
        eq(storeInstalls.appId, apps.id),
        storeId ? eq(storeInstalls.storeId, storeId) : undefined,
      ),
    )
    .where(conditions)
    .orderBy(
      // 1. Store default app first (if storeId provided)
      ...(storeDefaultAppId
        ? [
            desc(
              sql`CASE WHEN ${apps.id} = ${storeDefaultAppId} THEN 1 ELSE 0 END`,
            ),
          ]
        : []),
      // 2. Chrry second
      desc(sql`CASE WHEN ${apps.slug} = 'chrry' THEN 1 ELSE 0 END`),
      // 3. Custom app order (0, 1, 2, 3...), nulls last
      sql`${appOrders.order} ASC NULLS LAST`,
      // 4. Store install display order (0, 1, 2, 3...), nulls last
      sql`${storeInstalls.displayOrder} ASC NULLS LAST`,
      // 5. Creation date for apps without custom order
      desc(apps.createdOn),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  // Count total
  const totalCount =
    (
      await db
        .select({ count: count(apps.id) })
        .from(apps)
        .where(conditions)
    )[0]?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null

  // Extract apps from result with store data
  const appsData = result.map((appRow) => ({
    ...appRow.app,
    store: appRow.store,
  }))

  // For nested store.apps, use empty array to prevent circular references
  // The top-level apps list already contains all apps from the store chain
  return {
    items: (
      await Promise.all(
        appsData.map(async (app) => {
          if (!app) return undefined

          const storeWithApps = app.store
            ? {
                ...app.store,
                apps: [], // Empty to prevent circular references
                app: null, // Set to null to prevent circular references
              }
            : app.store

          return {
            ...(isSafe ? toSafeApp({ app }) : app),
            extends: await getAppExtends({
              appId: app.id,
            }),
            store: storeWithApps,
          } as appWithStore
        }),
      )
    ).filter(Boolean) as appWithStore[],
    totalCount,
    hasNextPage,
    nextPage,
  }
}

// App Installation Functions
export const getInstall = async ({
  appId,
  userId,
  guestId,
}: {
  appId: string
  userId?: string
  guestId?: string
}) => {
  const [install] = await db
    .select()
    .from(installs)
    .where(
      and(
        eq(installs.appId, appId),
        userId ? eq(installs.userId, userId) : undefined,
        guestId ? eq(installs.guestId, guestId) : undefined,
        isNull(installs.uninstalledAt),
      ),
    )
    .limit(1)

  return install
}

export const installApp = async ({
  appId,
  userId,
  guestId,
  order = 0,
  isPinned = false,
}: {
  appId: string
  userId?: string
  guestId?: string
  order?: number
  isPinned?: boolean
}) => {
  // Check if already installed
  const existing = await db
    .select()
    .from(installs)
    .where(
      and(
        eq(installs.appId, appId),
        userId ? eq(installs.userId, userId) : undefined,
        guestId ? eq(installs.guestId, guestId) : undefined,
        isNull(installs.uninstalledAt),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    return existing[0] // Already installed
  }

  // Install the app
  const [installed] = await db
    .insert(installs)
    .values({
      appId,
      userId,
      guestId,
      order,
      isPinned,
    })
    .returning()

  // Increment install count on app
  await db
    .update(apps)
    .set({
      installCount: sql`${apps.installCount} + 1`,
    })
    .where(eq(apps.id, appId))

  return installed
}

export const uninstallApp = async ({
  appId,
  userId,
  guestId,
}: {
  appId: string
  userId?: string
  guestId?: string
}) => {
  const [uninstalled] = await db
    .update(installs)
    .set({
      uninstalledAt: new Date(),
    })
    .where(
      and(
        eq(installs.appId, appId),
        userId ? eq(installs.userId, userId) : undefined,
        guestId ? eq(installs.guestId, guestId) : undefined,
        isNull(installs.uninstalledAt),
      ),
    )
    .returning()

  // Decrement install count on app
  if (uninstalled) {
    await db
      .update(apps)
      .set({
        installCount: sql`${apps.installCount} - 1`,
      })
      .where(eq(apps.id, appId))
  }

  return uninstalled
}

export const autoInstallDefaultApps = async ({
  userId,
  guestId,
}: {
  userId?: string
  guestId?: string
}) => {
  // Get all default system apps (no userId and no guestId)
  const defaultApps = await db
    .select()
    .from(apps)
    .where(and(isNull(apps.userId), isNull(apps.guestId)))

  // Install each default app
  const installations = await Promise.all(
    defaultApps.map((app, index) =>
      installApp({
        appId: app.id,
        userId,
        guestId,
        order: index, // Order by creation date
        isPinned: false,
      }),
    ),
  )

  return installations
}

// Vault - Expense Tracking Functions
export async function createExpense(expense: newExpense) {
  const [inserted] = await db.insert(expenses).values(expense).returning()
  return inserted
}

export type budgetCategory =
  | "food"
  | "transport"
  | "entertainment"
  | "shopping"
  | "bills"
  | "health"
  | "education"
  | "travel"
  | "other"

export async function getExpenses({
  id,
  userId,
  guestId,
  threadId,
  category,
  startDate,
  endDate,
  page = 1,
  pageSize = 100,
}: {
  id?: string
  userId?: string
  guestId?: string
  threadId?: string
  category?: budgetCategory
  startDate?: Date
  endDate?: Date
  page?: number
  pageSize?: number
}) {
  const conditions = and(
    id ? eq(expenses.id, id) : undefined,
    userId ? eq(expenses.userId, userId) : undefined,
    guestId ? eq(expenses.guestId, guestId) : undefined,
    threadId ? eq(expenses.threadId, threadId) : undefined,
    category ? eq(expenses.category, category) : undefined,
    startDate ? gte(expenses.date, startDate) : undefined,
    endDate ? lte(expenses.date, endDate) : undefined,
  )

  const result = await db
    .select()
    .from(expenses)
    .where(conditions)
    .orderBy(desc(expenses.date))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalCount =
    (
      await db
        .select({ count: count(expenses.id) })
        .from(expenses)
        .where(conditions)
    )[0]?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null

  return {
    expenses: result,
    totalCount,
    hasNextPage,
    nextPage,
  }
}

export async function getExpense({
  id,
  userId,
  guestId,
}: {
  id: string
  userId?: string
  guestId?: string
}) {
  const [result] = await db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.id, id),
        userId ? eq(expenses.userId, userId) : undefined,
        guestId ? eq(expenses.guestId, guestId) : undefined,
      ),
    )
  return result
}

export async function updateExpense(expense: expense) {
  const [updated] = await db
    .update(expenses)
    .set({ ...expense, updatedOn: new Date() })
    .where(eq(expenses.id, expense.id))
    .returning()
  return updated
}

export async function deleteExpense({ id }: { id: string }) {
  const [deleted] = await db
    .delete(expenses)
    .where(eq(expenses.id, id))
    .returning()
  return deleted
}

// Vault - Budget Functions
export async function createBudget(budget: newBudget) {
  const [inserted] = await db.insert(budgets).values(budget).returning()
  return inserted
}

export async function getBudgets({
  userId,
  category,
  isActive,
  page = 1,
  pageSize = 100,
  guestId,
}: {
  userId?: string
  category?: budgetCategory
  isActive?: boolean
  page?: number
  pageSize?: number
  guestId?: string
}) {
  const conditions = and(
    userId ? eq(budgets.userId, userId) : undefined,
    category ? eq(budgets.category, category) : undefined,
    isActive !== undefined ? eq(budgets.isActive, isActive) : undefined,
    guestId ? eq(budgets.guestId, guestId) : undefined,
  )

  const result = await db
    .select()
    .from(budgets)
    .where(conditions)
    .orderBy(desc(budgets.createdOn))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalCount =
    (
      await db
        .select({ count: count(budgets.id) })
        .from(budgets)
        .where(conditions)
    )[0]?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null

  return {
    budgets: result,
    totalCount,
    hasNextPage,
    nextPage,
  }
}

export async function updateBudget(budget: budget) {
  const [updated] = await db
    .update(budgets)
    .set({ ...budget, updatedOn: new Date() })
    .where(eq(budgets.id, budget.id))
    .returning()
  return updated
}

export async function deleteBudget({ id }: { id: string }) {
  const [deleted] = await db
    .delete(budgets)
    .where(eq(budgets.id, id))
    .returning()
  return deleted
}

export async function createSharedExpense(sharedExpense: newSharedExpense) {
  const [result] = await db
    .insert(sharedExpenses)
    .values(sharedExpense)
    .returning()
  return result
}

export async function getSharedExpenses({
  expenseId,
  threadId,
  page = 1,
  pageSize = 100,
}: {
  expenseId?: string
  threadId?: string
  page?: number
  pageSize?: number
}) {
  const conditions = and(
    expenseId ? eq(sharedExpenses.expenseId, expenseId) : undefined,
    threadId ? eq(sharedExpenses.threadId, threadId) : undefined,
  )

  const result = await db
    .select()
    .from(sharedExpenses)
    .where(conditions)
    .orderBy(desc(sharedExpenses.createdOn))

  const totalCount =
    (
      await db
        .select({ count: count(sharedExpenses.id) })
        .from(sharedExpenses)
        .where(conditions)
    )[0]?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null

  return {
    sharedExpenses: result,
    totalCount,
    hasNextPage,
    nextPage,
  }
}

export async function updateSharedExpense(sharedExpense: sharedExpense) {
  const [updated] = await db
    .update(sharedExpenses)
    .set({ ...sharedExpense, updatedOn: new Date() })
    .where(eq(sharedExpenses.id, sharedExpense.id))
    .returning()
  return updated
}

export async function deleteSharedExpense({ id }: { id: string }) {
  const [deleted] = await db
    .delete(sharedExpenses)
    .where(eq(sharedExpenses.id, id))
    .returning()
  return deleted
}

export async function createStore(store: newStore) {
  const [result] = await db.insert(stores).values(store).returning()
  return result
}

export async function getStores({
  page = 1,
  pageSize = 100,
  userId,
  guestId,
  appId,
  isSafe = false,
  includePublic = true,
}: {
  page?: number
  pageSize?: number
  userId?: string
  guestId?: string
  appId?: string
  isSafe?: boolean
  includePublic?: boolean
}) {
  const conditions = and(
    // If includePublic is true, return public stores OR user's stores
    includePublic
      ? or(
          eq(stores.visibility, "public"),
          userId ? eq(stores.userId, userId) : undefined,
          guestId ? eq(stores.guestId, guestId) : undefined,
        )
      : or(
          userId ? eq(stores.userId, userId) : undefined,
          guestId ? eq(stores.guestId, guestId) : undefined,
        ),
    appId ? eq(stores.appId, appId) : undefined,
  )

  const result = await db
    .select()
    .from(stores)
    .leftJoin(users, eq(stores.userId, users.id))
    .leftJoin(guests, eq(stores.guestId, guests.id))
    .leftJoin(teams, eq(stores.teamId, teams.id))
    .leftJoin(apps, eq(stores.appId, apps.id))
    .where(conditions)
    .orderBy(
      // 1. User's own store first (1 if own, 0 if not) - descending so 1 comes first
      desc(
        sql`CASE 
          WHEN ${stores.userId} = ${userId || null} OR ${stores.guestId} = ${guestId || null} 
          THEN 1 
          ELSE 0 
        END`,
      ),
      // 2. Chrry second (1 if chrry, 0 if not) - descending so 1 comes first
      desc(sql`CASE WHEN ${stores.slug} = 'chrry' THEN 1 ELSE 0 END`),
      // 3. Then by creation date
      desc(stores.createdOn),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalCount =
    (
      await db
        .select({ count: count(stores.id) })
        .from(stores)
        .where(conditions)
    )[0]?.count ?? 0

  const hasNextPage = totalCount > page * pageSize
  const nextPage = hasNextPage ? page + 1 : null

  // Clean up result structure
  const cleanedStores = await Promise.all(
    result.map(async (row) => {
      // Check if current user is the owner
      const isOwner =
        (userId && row.stores.userId === userId) ||
        (guestId && row.stores.guestId === guestId)

      const appsResult = await getApps({
        pageSize: 20,
        page: 1,
        userId: userId,
        guestId: guestId,
        storeId: row.stores.id,
      })

      return {
        store: row.stores,
        user:
          row.user && isSafe && !isOwner
            ? toSafeUser({ user: row.user })
            : row.user,
        guest:
          row.guest && isSafe && !isOwner
            ? toSafeGuest({ guest: row.guest })
            : row.guest,
        team: row.teams,
        app: row.app,
        apps: await Promise.all(
          appsResult.items.map((app) => getApp({ id: app.id })!),
        ),
      }
    }),
  )

  return {
    stores: cleanedStores,
    totalCount,
    hasNextPage,
    nextPage,
  }
}

export async function getStore({
  id,
  slug,
  userId,
  guestId,
  domain,
  isSafe = false,
  appId,
  depth = 0,
  parentStoreId,
}: {
  id?: string
  slug?: string
  userId?: string
  guestId?: string
  domain?: string
  isSafe?: boolean
  appId?: string
  depth?: number
  parentStoreId?: string | null
}) {
  // Map vex.chrry.ai and askvex.com to the vex store
  let effectiveSlug = slug
  let effectiveDomain = domain

  if (domain && !slug) {
    if (["https://vex.chrry.ai"].includes(domain)) {
      effectiveSlug = "lifeOS"
    }
  }

  const conditions = [
    appId ? eq(stores.appId, appId) : undefined,
    id ? eq(stores.id, id) : undefined,
    parentStoreId === null
      ? isNull(stores.parentStoreId)
      : parentStoreId
        ? eq(stores.parentStoreId, parentStoreId)
        : undefined,
    effectiveSlug ? eq(stores.slug, effectiveSlug) : undefined,
    effectiveDomain ? eq(stores.domain, effectiveDomain) : undefined,
  ].filter(Boolean) // Remove undefined values

  const [result] = await db
    .select()
    .from(stores)
    .leftJoin(users, eq(stores.userId, users.id))
    .leftJoin(guests, eq(stores.guestId, guests.id))
    .leftJoin(teams, eq(stores.teamId, teams.id))
    .leftJoin(apps, eq(stores.appId, apps.id))
    .where(and(...conditions))
    .orderBy(desc(stores.createdOn))
    .limit(1)

  if (!result) return undefined

  // Check if current user is the owner
  const isOwner =
    (userId && result.stores.userId === userId) ||
    (guestId && result.stores.guestId === guestId)

  const appsResult = await getApps({
    userId,
    guestId,
    storeId: result.stores.id,
  })

  // Populate nested store.apps if depth > 0
  let appsWithNestedStores = appsResult.items
  if (depth > 0) {
    console.log(`📦 Populating nested apps for store with depth: ${depth}`)
    appsWithNestedStores = await Promise.all(
      appsResult.items.map(async (appItem) => {
        // Recursively fetch nested store apps (depth - 1)
        const nestedStoreData = await getStore({
          id: appItem.store?.id,
          userId,
          guestId,
          depth: depth - 1,
        })

        console.log(
          `  ↳ ${appItem.name}: fetched ${nestedStoreData?.apps?.length || 0} apps from store ${appItem?.store?.name}`,
        )

        return {
          ...appItem,
          store: appItem.store
            ? {
                ...appItem.store,
                apps: nestedStoreData?.apps || [],
                app: null, // Set to null to prevent circular references
              }
            : appItem.store,
        } as appWithStore
      }),
    )
  }

  // Build appWithStore if app exists
  const appWithStore = result.app
    ? ({
        ...result.app,
        store: {
          ...result.stores,
          apps: appsWithNestedStores,
          app: null, // Set to null to prevent circular references
        },
        extends: await getAppExtends({
          appId: result.app.id,
        }),
      } as appWithStore)
    : undefined

  return {
    store: result.stores,
    user:
      result.user && isSafe && !isOwner
        ? toSafeUser({ user: result.user })
        : result.user,
    guest:
      result.guest && isSafe && !isOwner
        ? toSafeGuest({ guest: result.guest })
        : result.guest,
    team: result.teams,
    app: appWithStore,
    apps: appsWithNestedStores,
  }
}

export async function updateStore(store: store) {
  const [updated] = await db
    .update(stores)
    .set({ ...store, updatedOn: new Date() })
    .where(eq(stores.id, store.id))
    .returning()

  return updated
}

export async function deleteStore({ id }: { id: string }) {
  const [deleted] = await db.delete(stores).where(eq(stores.id, id)).returning()
  return deleted
}

// Export app functions

export async function createStoreInstall(storeInstall: newStoreInstall) {
  const [result] = await db
    .insert(storeInstalls)
    .values(storeInstall)
    .returning()
  return result
}

export async function getStoreInstall({
  id,
  storeId,
  appId,
}: {
  id?: string
  storeId?: string
  appId?: string
}) {
  const conditions = and(
    id ? eq(storeInstalls.id, id) : undefined,
    storeId ? eq(storeInstalls.storeId, storeId) : undefined,
    appId ? eq(storeInstalls.appId, appId) : undefined,
  )

  const result = await db
    .select()
    .from(storeInstalls)
    .where(conditions)
    .orderBy(desc(storeInstalls.installedAt))
    .limit(1)

  return result[0]
}

export async function updateStoreInstall(storeInstall: storeInstall) {
  const [updated] = await db
    .update(storeInstalls)
    .set({ ...storeInstall, updatedOn: new Date() })
    .where(eq(storeInstalls.id, storeInstall.id))
    .returning()
  return updated
}

export async function deleteStoreInstall({ id }: { id: string }) {
  const [deleted] = await db
    .delete(storeInstalls)
    .where(eq(storeInstalls.id, id))
    .returning()
  return deleted
}

export async function createAppExtend(data: newAppExtend) {
  const [result] = await db.insert(appExtend).values(data).returning()
  return result
}

export async function getAppExtends({ appId }: { appId: string }) {
  const result = await db
    .select({
      app: apps,
    })
    .from(appExtend)
    .innerJoin(apps, eq(appExtend.toId, apps.id))
    .where(eq(appExtend.appId, appId))

  // Return apps with extends property set to empty array to prevent infinite recursion
  return result.map((r) => ({ ...r.app, extends: [] }))
}

export async function deleteAppExtend({ appId }: { appId: string }) {
  const [deleted] = await db
    .delete(appExtend)
    .where(eq(appExtend.appId, appId))
    .returning()
  return deleted
}

export async function createAppOrder(data: newAppOrder) {
  const [result] = await db.insert(appOrders).values(data).returning()
  return result
}

export async function getAppOrders({
  storeId,
  userId,
  guestId,
}: {
  storeId?: string
  userId?: string
  guestId?: string
}) {
  const conditions = []
  if (storeId) conditions.push(eq(appOrders.storeId, storeId))
  if (userId) conditions.push(eq(appOrders.userId, userId))
  if (guestId) conditions.push(eq(appOrders.guestId, guestId))

  const result = await db
    .select()
    .from(appOrders)
    .innerJoin(apps, eq(appOrders.appId, apps.id))
    .where(and(...conditions))
    .orderBy(appOrders.order)

  return result.map((r) => ({
    ...r.app,
    order: r.appOrders.order,
    items: r.appOrders,
  }))
}

export async function updateAppOrder({
  appId,
  storeId,
  userId,
  guestId,
  order,
}: appOrder) {
  const conditions = [eq(appOrders.appId, appId)]
  if (storeId) conditions.push(eq(appOrders.storeId, storeId))
  if (userId) conditions.push(eq(appOrders.userId, userId))
  if (guestId) conditions.push(eq(appOrders.guestId, guestId))

  const [updated] = await db
    .update(appOrders)
    .set({ order, updatedOn: new Date() })
    .where(and(...conditions))
    .returning()

  return updated
}

export async function deleteAppOrder({
  appId,
  storeId,
  userId,
  guestId,
}: {
  appId: string
  storeId?: string
  userId?: string
  guestId?: string
}) {
  const conditions = [eq(appOrders.appId, appId)]
  if (storeId) conditions.push(eq(appOrders.storeId, storeId))
  if (userId) conditions.push(eq(appOrders.userId, userId))
  if (guestId) conditions.push(eq(appOrders.guestId, guestId))

  const [deleted] = await db
    .delete(appOrders)
    .where(and(...conditions))
    .returning()

  return deleted
}

// Export API key utilities
export { generateApiKey, isValidApiKey, getApiKeyEnv } from "./src/utils/apiKey"
