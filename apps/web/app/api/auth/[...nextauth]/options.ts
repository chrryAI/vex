import { DrizzleAdapter } from "@auth/drizzle-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import AppleProvider from "next-auth/providers/apple"
import GoogleProvider from "next-auth/providers/google"
import DiscordProvider from "next-auth/providers/discord"
import jwt from "jsonwebtoken"

import { v4 as uuidv4 } from "uuid"
import { Adapter } from "next-auth/adapters"

import {
  createSystemLog,
  createUser,
  db,
  getUser,
  getStore,
  updateUser,
} from "@repo/db"
import { AuthOptions } from "next-auth"
import { isValidUsername } from "chrry/utils"
import { getSiteConfig } from "chrry/utils/siteConfig"
import captureException from "../../../../lib/captureException"
import { trackSignup } from "../../../../lib/ads"

const isDevelopment =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_NODE_ENV === "development"

// Generate unique username from name
async function generateUniqueUsername(
  fullName: string | null | undefined,
): Promise<string> {
  if (!fullName) return uuidv4()

  // Extract first name and clean it
  const firstNameRaw = fullName.split(" ")[0]
  if (!firstNameRaw) return uuidv4()

  const firstName = firstNameRaw.toLowerCase().replace(/[^a-z0-9]/g, "")

  // Early validation check
  if (!firstName || !isValidUsername(firstName)) return uuidv4()

  // Check if username exists (checks both users and stores)
  const exists = async (username: string): Promise<boolean> => {
    const existingUser = await getUser({ userName: username })
    if (existingUser) return true

    const existingStore = await getStore({ slug: username })
    if (existingStore?.store) return true

    return false
  }

  // Try the first name first
  let username = firstName
  if (!(await exists(username))) {
    return username // Available!
  }

  // If taken, try with numbers
  let counter = 1
  while (counter <= 999) {
    username = `${firstName}${counter}`

    if (!(await exists(username)) && isValidUsername(username)) {
      return username // Found available username
    }

    counter++
  }

  // Fallback to UUID if we've tried too many variations
  return uuidv4()
}

export const authOptions: AuthOptions = {
  adapter: DrizzleAdapter(db as any) as Adapter,
  providers: [
    // DiscordProvider({
    //   clientId: process.env.DISCORD_CLIENT_ID!,
    //   clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    // }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "text",
          placeholder: "example@gmail.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string
        const password = credentials?.password as string

        if (!email || !password) {
          return null
        }

        const user = await getUser({
          email,
        })

        if (!user || !user.password) {
          return null
        }

        const isAuthenticated = await bcrypt.compare(password, user.password)

        // Map database user to NextAuth User type
        return isAuthenticated
          ? {
              id: user.id,
              email: user.email,
              name: user.name ?? undefined,
              image: user.image ?? undefined,
            }
          : null
      },
    }),

    // https://chrry.ai/api/auth/callback/apple
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID!, // Hardcoded to match Apple Developer Services ID
      clientSecret: process.env.APPLE_CLIENT_SECRET!, // Use pre-generated token from .env
      authorization: {
        params: {
          scope: "name email",
          response_mode: "form_post",
        },
      },
      // Disable PKCE and use state parameter instead for better cross-domain compatibility
      checks: ["state"],
      profile(profile) {
        console.log("Apple profile data:", JSON.stringify(profile, null, 2))

        // Extract name from profile data
        let name = "Apple User"

        // Try to get name from different possible locations in the profile
        if (profile.name?.firstName && profile.name?.lastName) {
          name = `${profile.name.firstName} ${profile.name.lastName}`
        } else if (profile.name?.firstName) {
          name = profile.name.firstName
        } else if (profile.given_name && profile.family_name) {
          name = `${profile.given_name} ${profile.family_name}`
        } else if (profile.given_name) {
          name = profile.given_name
        } else if (profile.name) {
          name = profile.name
        }

        return {
          id: profile.sub,
          name: name,
          email: profile.email,
          image: undefined,
        }
      },
      allowDangerousEmailAccountLinking: true,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_WEB_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_WEB_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          // Always include calendar scope on localhost for testing
          scope: false
            ? "openid email profile https://www.googleapis.com/auth/calendar.events"
            : "openid email profile",
        },
      },
      async profile(profile: any) {
        // Check if user is in allowed list

        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: undefined, // Let users use default avatar and upload their own
        }
      },
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Extract hostname from baseUrl to get site-specific config
      try {
        const baseUrlObj = new URL(baseUrl)
        const siteConfig = getSiteConfig(baseUrlObj.hostname)
        const siteBaseUrl = siteConfig.url || baseUrl

        // If url is relative, prepend site-specific base URL
        if (url.startsWith("/")) {
          return `${siteBaseUrl}${url}`
        }

        // If url is absolute and on same domain, allow it
        const urlObj = new URL(url)
        if (urlObj.hostname === baseUrlObj.hostname) {
          return url
        }

        // Otherwise, redirect to site-specific base URL
        return siteBaseUrl
      } catch (error) {
        console.error("Redirect callback error:", error)
        return baseUrl
      }
    },
    async session({ session, user, token }: any) {
      try {
        if (token) {
          session.user = {
            ...session.user,
            ...token,
          }
          session.token = jwt.sign(token, process.env.NEXTAUTH_SECRET!)

          // Pass Google tokens to session for calendar access
          session.accessToken = token.accessToken
          session.refreshToken = token.refreshToken
          session.expiresAt = token.expiresAt
        }

        session.appleId = user?.appleId || token?.appleId

        return session
      } catch (error) {
        console.error("❌ Session callback error:", error)
        return session
      }
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "apple" && profile?.sub) {
        token.appleId = profile.sub
      }

      // Store Google tokens for calendar access on initial sign-in
      if (account?.provider === "google") {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        return token
      }

      // Refresh Google access token if expired
      if (token.refreshToken && token.expiresAt) {
        const expiresAt = token.expiresAt as number
        const now = Math.floor(Date.now() / 1000)

        // Refresh 5 minutes before expiry
        if (now > expiresAt - 300) {
          try {
            const response = await fetch(
              "https://oauth2.googleapis.com/token",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  client_id: process.env.GOOGLE_WEB_CLIENT_ID!,
                  client_secret: process.env.GOOGLE_WEB_CLIENT_SECRET!,
                  grant_type: "refresh_token",
                  refresh_token: token.refreshToken as string,
                }),
              },
            )

            const refreshedTokens = await response.json()

            if (!response.ok) {
              throw new Error(refreshedTokens.error || "Token refresh failed")
            }

            return {
              ...token,
              accessToken: refreshedTokens.access_token,
              expiresAt:
                Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
              refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
            }
          } catch (error) {
            console.error("Error refreshing access token:", error)
            // Return token as-is, user will need to re-authenticate
            return { ...token, error: "RefreshAccessTokenError" }
          }
        }
      }

      return token
    },
    async signIn({ user, account, profile }: any) {
      console.log("🔐 SignIn callback triggered:", {
        provider: account?.provider,
        email: user?.email,
        hasProfile: !!profile,
      })

      if (account?.provider === "apple" && profile?.sub) {
        // Try to find user by appleId
        let dbUser = await getUser({ appleId: profile.sub })
        if (!dbUser && user.email) {
          // Fallback: try to find by email
          dbUser = await getUser({ email: user.email })
        }
        if (!dbUser) {
          // Create user with appleId
          const createdUser = await createUser({
            email: user.email,
            appleId: profile.sub,
            name: profile.name,
            createdOn: new Date(),
            updatedOn: new Date(),
            userName: await generateUniqueUsername(profile.name || user.name),
            // ...other fields
          })

          // Track signup conversion (server-side, zero client tracking)
          if (createdUser?.id) {
            await trackSignup(createdUser.id).catch((err) =>
              console.error("Failed to track signup:", err),
            )
          }
        } else if (!dbUser.appleId) {
          // Update user to include appleId
          await updateUser({ ...dbUser, appleId: profile.sub })
        }
        return true
      }
      if (account?.provider === "google") {
        try {
          console.log("✅ Google OAuth callback received")

          if (!user.email) {
            console.error("❌ Google sign-in: No email provided")
            throw new Error("No email provided")
          }

          console.log("🔍 Google sign-in attempt:", {
            email: user.email,
            hasAccessToken: !!account.access_token,
            hasRefreshToken: !!account.refresh_token,
            scope: account.scope,
            userId: user.id,
          })

          // Check if user exists in database
          const dbUser = await getUser({ email: user.email })

          if (dbUser) {
            await updateUser({
              ...dbUser,
              emailVerified: new Date(),
              updatedOn: new Date(),
            })
            console.log("Google sign-in: Updated existing user", dbUser.id)

            // Update Google account scope if it changed (e.g., calendar scope added)
            const { getAccount, updateAccount } = await import("@repo/db")
            const existingAccount = await getAccount({
              userId: dbUser.id,
              provider: "google",
            })

            if (existingAccount && account.scope !== existingAccount.scope) {
              await updateAccount({
                ...existingAccount,
                scope: account.scope,
                access_token: account.access_token,
                refresh_token:
                  account.refresh_token || existingAccount.refresh_token,
                expires_at: account.expires_at,
              })
              console.log("Google sign-in: Updated account scope", {
                oldScope: existingAccount.scope,
                newScope: account.scope,
              })
            }
          } else {
            const createdUser = await createUser({
              email: user.email,
              name: user.name,
              image: user.image,
              createdOn: new Date(),
              updatedOn: new Date(),
              userName: await generateUniqueUsername(profile.name || user.name),
            })
            console.log("✅ Google sign-in: Created new user", createdUser?.id)

            // Track signup conversion (server-side, zero client tracking)
            if (createdUser?.id) {
              await trackSignup(createdUser.id).catch((err) =>
                console.error("Failed to track signup:", err),
              )
            }
          }

          console.log("✅ Google sign-in successful")
          return true
        } catch (error) {
          captureException(error)
          console.error("❌ Google signIn callback error:", error)
          console.error("❌ Error details:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          })

          // Return false to show error on sign-in page
          return false
        }
      }

      console.log("✅ SignIn callback completed successfully")
      return true
    },
  },
  session: {
    strategy: "jwt" as const,
  },
  logger: {
    error(code, metadata) {
      console.error("❌ NextAuth Error:", code)
      console.error("📋 Error metadata:", JSON.stringify(metadata, null, 2))
    },
    warn(code) {
      console.warn("⚠️ NextAuth Warning:", code)
    },
    debug(code, metadata) {
      if (code.includes("OAUTH") || code.includes("callback")) {
        console.log("🔍 NextAuth Debug:", code, metadata)
      }
    },
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/?signIn=login",
    error: "/?signIn=login&error=",
  },
  cookies: {
    sessionToken: {
      name: isDevelopment
        ? "next-auth.session-token"
        : "__Secure-next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: !isDevelopment,
        domain: isDevelopment ? undefined : ".chrry.ai", // ✅ Cross-subdomain in production
      },
    },
    callbackUrl: {
      name: isDevelopment
        ? "next-auth.callback-url"
        : "__Secure-next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: !isDevelopment,
        domain: isDevelopment ? undefined : ".chrry.ai", // ✅ Cross-subdomain in production
      },
    },
    csrfToken: {
      name: isDevelopment
        ? "next-auth.csrf-token"
        : "__Host-next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: !isDevelopment,
        // Note: __Host- prefix requires domain to be undefined for security
        domain: undefined,
      },
    },
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: isDevelopment ? "lax" : "none",
        path: "/",
        secure: !isDevelopment,
        domain: isDevelopment ? undefined : ".chrry.ai", // ✅ Cross-subdomain in production
      },
    },
    state: {
      name: "next-auth.state",
      options: {
        httpOnly: true,
        sameSite: isDevelopment ? "lax" : "none",
        path: "/",
        secure: !isDevelopment,
        maxAge: 900,
        domain: isDevelopment ? undefined : ".chrry.ai", // ✅ Cross-subdomain in production
      },
    },
  },
}
