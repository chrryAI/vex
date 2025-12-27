import { useState, useEffect } from "react"
import { API_URL, FRONTEND_URL } from "../utils"
import { isTauri } from "../platform/detection"

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Skip if window or addEventListener is not available (React Native)
    if (typeof window === "undefined" || !window.addEventListener) {
      return
    }

    function updateStatus() {
      // Skip navigator.onLine in Tauri - it's unreliable
      // We use API health checks instead
      if (!isTauri()) {
        setIsOnline(navigator.onLine)
      }
    }

    async function checkConnection() {
      try {
        // In Tauri, only check API health (no frontend server)
        if (isTauri()) {
          // Tauri: only check API
          const apiResponse = await fetch(`${API_URL}/health`, {
            method: "HEAD",
            cache: "no-store",
          }).catch(() => null)

          setIsOnline(apiResponse?.ok ?? false)
        } else {
          // Web/Extension: check both API and frontend health
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
        }
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
