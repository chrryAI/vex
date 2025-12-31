/**
 * Capacitor Social Login - Simple Google Auth
 * Using @capgo/capacitor-social-login
 */

import { SocialLogin } from "@capgo/capacitor-social-login"
import { toast } from "react-hot-toast"

let initialized = false

export async function initializeAuth(googleClientId: string) {
  if (initialized) return

  try {
    // Try initializing all providers
    await SocialLogin.initialize({
      google: {
        webClientId: googleClientId,
        iOSClientId: googleClientId,
      },
      apple: {
        clientId: "dev.chrry.vex",
      },
    })
    initialized = true
    console.log("✅ Social Auth initialized")
  } catch (error) {
    console.error("❌ Failed to initialize Social Auth:", error)

    // Fallback: Try initializing ONLY Apple if Google failed (likely due to missing plist)
    try {
      console.log("⚠️ Retrying with Apple only...")
      await SocialLogin.initialize({
        apple: {
          clientId: "dev.chrry.vex",
        },
      })
      initialized = true // Partially initialized
      console.log("✅ Apple Auth initialized (Google failed)")
      toast.error("Google Auth failed (missing plist?), but Apple is ready.")
    } catch (appleError) {
      console.error("❌ Failed to initialize Apple Auth too:", appleError)
      toast.error(
        `Auth Init Failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}

export async function googleSignIn() {
  if (!initialized) throw new Error("Auth not initialized")

  const result = await SocialLogin.login({
    provider: "google",
    options: {
      scopes: ["profile", "email"],
    },
  })

  // Cast to any for response handling
  const res = result.result as any

  return {
    token: res.accessToken?.token || res.idToken || "",
    email: res.profile?.email || "",
    name: res.profile?.name || "",
    imageUrl: res.profile?.imageUrl || "",
  }
}

export async function appleSignIn() {
  if (!initialized) throw new Error("Auth not initialized")

  const result = await SocialLogin.login({
    provider: "apple",
    options: {
      scopes: ["email", "name"],
    },
  })

  return {
    token: result.result.idToken || "",
    email: result.result.profile?.email || "",
    name: (result.result.profile?.givenName
      ? `${result.result.profile.givenName} ${result.result.profile.familyName || ""}`
      : ""
    ).trim(),
  }
}

export async function signOut() {
  await SocialLogin.logout({ provider: "google" })
  await SocialLogin.logout({ provider: "apple" })
}
