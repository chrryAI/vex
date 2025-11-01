import { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  accounts,
  aiAgents,
  collaborations,
  devices,
  guests,
  messages,
  pushSubscriptions,
  subscriptions,
  systemLogs,
  threads,
  users,
  verificationTokens,
} from "./schema"
import * as schema from "./schema"
import { drizzle as postgresDrizzle } from "drizzle-orm/postgres-js"
import {
  and,
  eq,
  inArray,
  or,
  desc,
  count,
  sql,
  gte,
  isNotNull,
  lte,
} from "drizzle-orm"
import postgres from "postgres"

import * as dotenv from "dotenv"
import * as bcrypt from "bcrypt"

dotenv.config()

declare global {
  // eslint-disable-next-line no-var -- only var works here
  // eslint-disable-next-line no-unused-vars
  var db: PostgresJsDatabase<typeof schema> | undefined
}

// export type user = typeof users.$inferSelect
// export type newUser = typeof users.$inferInsert

export type message = typeof messages.$inferSelect
export type newMessage = typeof messages.$inferInsert

export type account = typeof accounts.$inferSelect
export type newAccount = typeof accounts.$inferInsert

export type verificationToken = typeof verificationTokens.$inferSelect
export type newVerificationToken = typeof verificationTokens.$inferInsert

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

export type user = typeof users.$inferSelect
export type newUser = typeof users.$inferInsert

export type pushSubscription = typeof pushSubscriptions.$inferSelect

export type NewCustomPushSubscription = {
  endpoint: string
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

const client = postgres(connectionString, {
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
})

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

// Calculate total credits spent by a user in a given month
export async function getCreditsSpent({
  userId,
  month,
}: {
  userId: string
  month?: number
}): Promise<number> {
  try {
    const currentDate = new Date()
    const targetMonth = month !== undefined ? month : currentDate.getMonth()
    const targetYear = currentDate.getFullYear()

    const startOfMonth = new Date(targetYear, targetMonth, 1)
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999)

    // Get all AI messages for the user in the specified month
    const userMessages = await db!
      .select()
      .from(messages)
      .innerJoin(aiAgents, eq(messages.agentId, aiAgents.id))
      .where(
        and(
          eq(messages.userId, userId),
          isNotNull(messages.agentId), // Only AI messages
          gte(messages.createdOn, startOfMonth),
          lte(messages.createdOn, endOfMonth),
        ),
      )

    // return userMessages.length

    // Calculate total credits: sum of (message.creditCost * agent.creditCost)
    const totalCredits = userMessages.reduce((total, msg) => {
      return total + msg.messages.creditCost * msg.aiAgents.creditCost
    }, 0)

    return totalCredits
  } catch (error) {
    console.error("❌ Error calculating credits spent:", error)
    return 0 // Return 0 on error to prevent blocking user
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
  userName,
}: {
  email?: string
  id?: string
  password?: string
  stripeSubscriptionId?: string
  stripeSessionId?: string
  verificationToken?: string
  appleId?: string
  userName?: string
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
        ),
      )
  ).at(0)

  const googleAccount = result
    ? (
        await db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.provider, "google"),
              eq(accounts.userId, result.user.id),
            ),
          )
      ).at(0)
    : undefined

  const appleAccount = result
    ? (
        await db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.provider, "apple"),
              eq(accounts.userId, result.user.id),
            ),
          )
      ).at(0)
    : undefined

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  return result
    ? {
        isLinkedToGoogle: !!googleAccount,
        isLinkedToApple: !!appleAccount,
        creditsLeft: Math.max(
          result.user.credits -
            (await getCreditsSpent({
              userId: result.user.id,
              month: new Date().getMonth(),
            })),
          0,
        ),
        ...result.user,
      }
    : undefined
}

export const getUsers = async ({
  page = 1,
  role,
  search,
  ...rest
}: {
  search?: string
  pageSize?: number
  role?: "user" | "admin"
  page?: number
} = {}) => {
  const pageSize = rest.pageSize || 100
  const formattedSearch =
    search && search.length >= 3 ? formatSearchTerm(search) : undefined

  // Create the search condition for full-text search
  const searchCondition = formattedSearch
    ? sql`
              (
                setweight(to_tsvector('english', coalesce(${users.name}, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(${users.email}, '')), 'B')
              ) @@ to_tsquery('english', ${sql`${formattedSearch}`}::text)
            `
    : undefined

  // Create the ranking expression for ordering by relevance
  const rankExpression = formattedSearch
    ? sql`
              ts_rank(
                setweight(to_tsvector('english', coalesce(${users.name}, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(${users.email}, '')), 'B'),
                to_tsquery('english', ${sql`${formattedSearch}`}::text)
              )
            `
    : undefined

  const conditionsArray = [
    role ? eq(users.role, role) : undefined,
    searchCondition ? searchCondition : undefined,
  ]

  const conditions = and(...conditionsArray.filter(Boolean))

  const result = await db
    .select()
    .from(users)
    .where(conditions)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .orderBy(
      ...(formattedSearch && rankExpression ? [rankExpression] : []),
      desc(users.role),
      desc(users.createdOn),
    )

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
    users: result.map((user) => ({ ...user, password: null })),
    totalCount,
    hasNextPage,
    nextPage,
  }
}

export const getGuest = async ({
  id,
  ip,
  fingerprint,
  isBot,
}: {
  id?: string
  ip?: string
  fingerprint?: string
  isBot?: boolean
}) => {
  const conditionsArray = [
    id ? eq(guests.id, id) : undefined,
    ip ? eq(guests.ip, ip) : undefined,
    fingerprint ? eq(guests.fingerprint, fingerprint) : undefined,
    isBot ? eq(guests.isBot, isBot) : undefined,
  ]

  const conditions = and(...conditionsArray.filter(Boolean))

  const result = (await db.select().from(guests).where(conditions)).at(0)

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  return result
    ? {
        ...result,
      }
    : null
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

export const getThread = async ({
  id,
  userId,
  guestId,
}: {
  id: string
  userId?: string
  guestId?: string
}) => {
  const [result] = await db
    .select()
    .from(threads)
    .where(
      and(
        eq(threads.id, id),
        userId ? eq(threads.userId, userId) : undefined,
        guestId ? eq(threads.guestId, guestId) : undefined,
      ),
    )
    .leftJoin(guests, eq(threads.guestId, guests.id))
    .leftJoin(users, eq(threads.userId, users.id))
    .limit(1)

  return result
    ? {
        ...result.threads,
        guest: result.guest,
        user: result.user,
        collaborations: await getCollaborations({
          threadId: result.threads.id,
        }),
      }
    : undefined
}

export const updateCollaboration = async (collaboration: collaboration) => {
  const [updated] = await db
    .update(collaborations)
    .set(collaboration)
    .where(eq(collaborations.id, collaboration.id))
    .returning()

  return updated
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

export const updateGuest = async (guest: guest) => {
  const [updated] = await db
    .update(guests)
    .set({ isOnline: guest.isOnline, activeOn: guest.activeOn })
    .where(eq(guests.id, guest.id))
    .returning()

  return updated
}

export const updateUser = async (user: user) => {
  const [updated] = await db
    .update(users)
    .set({ isOnline: user.isOnline, activeOn: user.activeOn })
    .where(eq(users.id, user.id))
    .returning()

  return updated
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
    }
  })
}

export async function deletePushSubscription({ id }: { id: string }) {
  const [deleted] = await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.id, id))
    .returning()

  return deleted
}
