import { and, authExchangeCodes, db, eq, gt } from "@repo/db"

export async function exchangeCodeForToken(
  code: string,
): Promise<string | null> {
  const now = new Date()

  const [result] = await db
    .update(authExchangeCodes)
    .set({ used: true })
    .where(
      and(
        eq(authExchangeCodes.code, code),
        eq(authExchangeCodes.used, false),
        gt(authExchangeCodes.expiresOn, now),
      ),
    )
    .returning()

  if (!result) return null

  return result.token
}
