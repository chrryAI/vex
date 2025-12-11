import { useState, useEffect, useCallback } from "react"
import { API_URL } from ".."

interface User {
  id: string
  email: string
  name: string | null
  image: string | null
}

interface AuthState {
  user: User | null
  loading: boolean
}

/**
 * Custom auth hook for password and OAuth authentication
 * Works cross-platform (web + React Native)
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  })

  /**
   * Fetch current session
   */
  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/auth/session`, {
        credentials: "include", // Include cookies for web
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setState({ user: data.user || null, loading: false })
      } else {
        setState({ user: null, loading: false })
      }
    } catch (error) {
      console.error("Session fetch error:", error)
      setState({ user: null, loading: false })
    }
  }, [])

  /**
   * Sign up with email/password
   */
  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      try {
        const response = await fetch(`${API_URL}/auth/signup/password`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password, name }),
        })

        if (response.ok) {
          const data = await response.json()
          setState({ user: data.user, loading: false })
          return { success: true, user: data.user }
        } else {
          const error = await response.json()
          return { success: false, error: error.error || "Sign up failed" }
        }
      } catch (error) {
        console.error("Sign up error:", error)
        return { success: false, error: "Sign up failed" }
      }
    },
    [],
  )

  /**
   * Sign in with email/password
   */
  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await fetch(`${API_URL}/auth/signin/password`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        })

        if (response.ok) {
          const data = await response.json()
          setState({ user: data.user, loading: false })
          return { success: true, user: data.user }
        } else {
          const error = await response.json()
          return { success: false, error: error.error || "Sign in failed" }
        }
      } catch (error) {
        console.error("Sign in error:", error)
        return { success: false, error: "Sign in failed" }
      }
    },
    [],
  )

  /**
   * Sign in with Google OAuth
   * Opens popup window for OAuth flow
   */
  const signInWithGoogle = useCallback(async () => {
    try {
      // Open OAuth popup
      const width = 500
      const height = 600
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      const popup = window.open(
        `${API_URL}/auth/signin/google`,
        "Google Sign In",
        `width=${width},height=${height},left=${left},top=${top}`,
      )

      // Listen for OAuth callback
      return new Promise((resolve) => {
        const checkPopup = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(checkPopup)
            // Refresh session after OAuth
            fetchSession().then(() => {
              resolve({ success: true })
            })
          }
        }, 500)
      })
    } catch (error) {
      console.error("Google sign in error:", error)
      return { success: false, error: "Google sign in failed" }
    }
  }, [fetchSession])

  /**
   * Sign in with Apple OAuth
   * Opens popup window for OAuth flow
   */
  const signInWithApple = useCallback(async () => {
    try {
      // Open OAuth popup
      const width = 500
      const height = 600
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      const popup = window.open(
        `${API_URL}/auth/signin/apple`,
        "Apple Sign In",
        `width=${width},height=${height},left=${left},top=${top}`,
      )

      // Listen for OAuth callback
      return new Promise((resolve) => {
        const checkPopup = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(checkPopup)
            // Refresh session after OAuth
            fetchSession().then(() => {
              resolve({ success: true })
            })
          }
        }, 500)
      })
    } catch (error) {
      console.error("Apple sign in error:", error)
      return { success: false, error: "Apple sign in failed" }
    }
  }, [fetchSession])

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    try {
      await fetch(`${API_URL}/auth/signout`, {
        method: "POST",
        credentials: "include",
      })

      setState({ user: null, loading: false })
      return { success: true }
    } catch (error) {
      console.error("Sign out error:", error)
      return { success: false, error: "Sign out failed" }
    }
  }, [])

  // Fetch session on mount
  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  return {
    user: state.user,
    loading: state.loading,
    signUp,
    signInWithPassword,
    signInWithGoogle,
    signInWithApple,
    signOut,
    refreshSession: fetchSession,
  }
}
