"use server"

import { createSystemLog } from "@repo/db"

export default async function log({
  level,
  message,
  object,
  userId,
  guestId,
}: {
  level: "info" | "warn" | "error"
  message: string
  object?: any
  userId?: string
  guestId?: string
}) {
  createSystemLog({
    level,
    message,
    object,
    userId,
    guestId,
  })
}
