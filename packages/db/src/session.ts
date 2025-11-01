import { redis } from "./redis"

/**
 * Session management using Redis for fast, cross-app authentication
 * Sessions are stored with TTL and automatically expire
 */

export async function setSession(
  sessionToken: string,
  userId: string,
  expiresAt: Date,
) {
  const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  if (ttl <= 0) {
    throw new Error("Session expiry must be in the future")
  }
  await redis.setex(`session:${sessionToken}`, ttl, userId)
  console.log(`✅ Session created for user ${userId}, expires in ${ttl}s`)
}

export async function getSession(sessionToken: string): Promise<string | null> {
  const userId = await redis.get<string>(`session:${sessionToken}`)
  return userId
}

export async function deleteSession(sessionToken: string): Promise<void> {
  await redis.del(`session:${sessionToken}`)
  console.log(`🗑️ Session deleted: ${sessionToken}`)
}

export async function extendSession(
  sessionToken: string,
  expiresAt: Date,
): Promise<void> {
  const userId = await getSession(sessionToken)
  if (userId) {
    await setSession(sessionToken, userId, expiresAt)
  }
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  // Scan for all sessions belonging to this user
  const keys = await redis.keys("session:*")
  const sessions = await Promise.all(
    keys.map(async (key: string) => {
      const uid = await redis.get<string>(key)
      return uid === userId ? key : null
    }),
  )
  const toDelete = sessions.filter(Boolean) as string[]
  if (toDelete.length > 0) {
    await redis.del(...toDelete)
    console.log(`🗑️ Deleted ${toDelete.length} sessions for user ${userId}`)
  }
}

export async function getActiveSessionCount(userId: string): Promise<number> {
  const keys = await redis.keys("session:*")
  const sessions = await Promise.all(
    keys.map(async (key: string) => {
      const uid = await redis.get<string>(key)
      return uid === userId ? 1 : 0
    }),
  )
  return sessions.reduce((sum: number, count: number) => sum + count, 0)
}
