import { useState, useEffect } from "react"
import { API_URL, FRONTEND_URL } from "../utils"

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true, // default to true on server
  )
  useEffect(() => {
    // Skip if window or addEventListener is not available (React Native)
    if (typeof window === "undefined" || !window.addEventListener) {
      return
    }

    function updateStatus() {
      setIsOnline(navigator.onLine)
    }

    async function checkConnection() {
      try {
        // Check both API and frontend health
        const [apiResponse, webResponse] = await Promise.all([
          fetch(`${API_URL}/health`, {
            method: "HEAD",
            cache: "no-store",
          }).catch(() => null),
          fetch(`${FRONTEND_URL}/api/health`, {
            method: "HEAD",
            cache: "no-store",
          }).catch(() => null),
        ])

        // Both API and web must be online
        const apiOnline = apiResponse?.ok ?? false
        const webOnline = webResponse?.ok ?? false

        setIsOnline(apiOnline && webOnline)
      } catch {
        setIsOnline(false)
      }
    }

    window.addEventListener("online", updateStatus)
    window.addEventListener("offline", updateStatus)
    window.addEventListener("focus", checkConnection)

    // Initial check in case navigator.onLine is wrong
    checkConnection()

    // Recheck every 30s to detect server outages
    const interval = setInterval(checkConnection, 30000)

    return () => {
      if (window.removeEventListener) {
        window.removeEventListener("online", updateStatus)
        window.removeEventListener("offline", updateStatus)
      }
      clearInterval(interval)
    }
  }, [])

  return isOnline
}
