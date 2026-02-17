import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { users } from "./schema"

/**
 * Better Auth Tables
 *
 * These tables are prefixed with `ba_` to run alongside existing NextAuth tables.
 * The `user` table from schema.ts is reused - no duplication!
 */

// Better Auth Sessions
export const baSessions = pgTable("ba_session", {
  id: text("id").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt", {
    mode: "date",
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", {
    mode: "date",
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
})

// Better Auth OAuth Accounts
export const baAccounts = pgTable(
  "ba_account",
  {
    id: text("id").primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("accountId").notNull(), // Provider's user ID
    providerId: text("providerId").notNull(), // "google", "apple", etc.
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    expiresAt: timestamp("expiresAt", {
      mode: "date",
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"), // For credentials provider
    createdAt: timestamp("createdAt", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    {
      // Unique constraint: one account per provider per user
      providerAccountKey: primaryKey({
        columns: [table.providerId, table.accountId],
      }),
    },
  ],
)

// Better Auth Verification Tokens
export const baVerifications = pgTable(
  "ba_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(), // Email or phone
    value: text("value").notNull(), // Token value
    expiresAt: timestamp("expiresAt", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("createdAt", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    {
      // Unique constraint: one active token per identifier
      identifierKey: primaryKey({
        columns: [table.identifier, table.value],
      }),
    },
  ],
)

// Export types
export type BaSession = typeof baSessions.$inferSelect
export type BaAccount = typeof baAccounts.$inferSelect
export type BaVerification = typeof baVerifications.$inferSelect
