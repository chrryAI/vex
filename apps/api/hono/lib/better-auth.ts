import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@repo/db"
import * as schema from "@repo/db/src/schema"
import * as betterAuthSchema from "@repo/db/src/better-auth-schema"

/**
 * Better Auth Configuration
 *
 * Maps to existing user table and uses prefixed tables for sessions/accounts
 */
export const auth = betterAuth({
  // Secret for encryption, signing, and hashing
  secret:
    process.env.BETTER_AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "development-secret-change-in-production",

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      // Map to existing user table
      user: schema.users,
      // Use prefixed Better Auth tables
      session: betterAuthSchema.baSessions,
      account: betterAuthSchema.baAccounts,
      verification: betterAuthSchema.baVerifications,
    },
  }),

  // Email & Password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Match NextAuth behavior
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days (matches NextAuth)
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // Social providers (OAuth)
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_WEB_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_WEB_CLIENT_SECRET!,
      // Match NextAuth Google config
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile",
        },
      },
      // Allow linking accounts with same email
      allowDangerousEmailAccountLinking: true,
    },

    apple: {
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
      // Match NextAuth Apple config
      authorization: {
        params: {
          scope: "name email",
          response_mode: "form_post",
        },
      },
      // Disable PKCE, use state (matches NextAuth)
      checks: ["state"],
      // Allow linking accounts with same email
      allowDangerousEmailAccountLinking: true,
    },
  },

  // Advanced options
  advanced: {
    // Use existing user ID format (UUID)
    generateId: () => {
      // Better Auth will use database default (uuid)
      return undefined
    },
    // Cross-subdomain cookies (matches NextAuth)
    crossSubDomainCookies: {
      enabled: true,
      domain: process.env.NODE_ENV === "production" ? ".chrry.ai" : undefined,
    },
  },

  // Base URL for callbacks - must match the API server
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",

  // Trust proxy headers (for production)
  trustedOrigins: [
    "https://chrry.ai",
    "https://*.chrry.ai",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
})

// Export types
export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
