"use client"

/// <reference types="chrome" />

import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import A from "./a/A"
import { useAppContext } from "./context/AppContext"
import {
  useApp,
  useAuth,
  useChat,
  useNavigationContext,
} from "./context/providers"
import { useStyles } from "./context/StylesContext"
import { useEnableNotificationsStyles } from "./EnableNotifications.styles"
import Img from "./Image"
import { BellRing } from "./icons"
import { Button, Div, Span, usePlatform } from "./platform"
import type { customPushSubscription } from "./types"
import { apiFetch, getEnv } from "./utils"
import registerServiceWorker, {
  subscribeToPushNotifications,
} from "./utils/registerServiceWorker"
import Weather from "./Weather"

export default function EnableNotifications({
  text = "Notifications",
  onLocationClick,
}: {
  text?: string
  onLocationClick?: (location: string) => void
}) {
  const [isMounted, setIsMounted] = useState(false)

  const styles = useEnableNotificationsStyles()

  // Split contexts for better organization
  const { t } = useAppContext()

  const { isManagingApp, setAppStatus } = useApp()

  const { isExtension } = usePlatform()

  // Auth context
  const { user, token, guest, API_URL, accountApp, getAppSlug, app } = useAuth()

  // Platform context
  const { os, isStandalone, device } = usePlatform()

  const { setIsNewAppChat } = useChat()

  const { setShowAddToHomeScreen, pathname } = useNavigationContext()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const [swRegistration, setSwRegistration] =
    useState<ServiceWorkerRegistration | null>(null)

  const [isSubscribed, setIsSubscribed] = useState<boolean | undefined>(
    undefined,
  )

  async function addPushSubscription(
    subscription: PushSubscription,
    p256dh: ArrayBuffer,
    auth: ArrayBuffer,
  ) {
    const response = await apiFetch(`${API_URL}/pushSubscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(
            String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dh))),
          ),
          auth: btoa(
            String.fromCharCode.apply(null, Array.from(new Uint8Array(auth))),
          ),
        },
      }),
    })

    const result = await response.json()
    return result
  }

  const storeApp = accountApp

  const { utilities } = useStyles()

  const StoreApp = useCallback(
    ({ icon }: { icon?: boolean }) =>
      storeApp && (
        <A
          data-testid={`app-${storeApp.slug}`}
          className={`${icon ? "link" : "button transparent"}`}
          style={{
            ...(icon
              ? utilities.link.style
              : { ...utilities.button.style, ...utilities.transparent.style }),
            ...utilities.small.style,
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
          href={getAppSlug(storeApp)}
          onClick={(e) => {
            e.preventDefault()

            setIsNewAppChat({ item: storeApp })
            setAppStatus(undefined)
            if (e.metaKey || e.ctrlKey) {
              return
            }
          }}
        >
          <Img app={storeApp} showLoading={false} size={24} />
          <Span>{storeApp?.name}</Span>
        </A>
      ),
    [storeApp],
  )

  const [pushSubscription, setPushSubscription] =
    useState<customPushSubscription | null>()

  useEffect(() => {
    if (!token) return

    // Handle extension notifications - just check permission status
    if (isExtension) {
      if (typeof chrome !== "undefined" && chrome.notifications) {
        chrome.notifications.getPermissionLevel((level) => {
          setIsSubscribed(level === "granted")
        })
      } else {
        setIsSubscribed(false)
      }
      return
    }

    const isTauri =
      typeof window !== "undefined" &&
      ("__TAURI__" in window ||
        "__TAURI_INTERNALS__" in window ||
        "TAURI_EVENT_PLUGIN_INTERNALS" in window)
    const initializeServiceWorker = async () => {
      // Skip Service Worker registration in Electron/desktop environments
      // Service Workers are not needed and will fail due to origin mismatch
      if (
        typeof window !== "undefined" &&
        (isTauri || window.location.protocol === "file:")
      ) {
        return
      }

      // First check if notification permission is already granted
      if ("Notification" in window) {
        const permission = Notification.permission

        if (permission === "granted") {
          // If already granted, check for subscription
          const registration = await registerServiceWorker()
          if (registration) {
            setSwRegistration(registration)
            const subscription =
              await registration.pushManager.getSubscription()
            if (subscription) {
              const result = await apiFetch(`${API_URL}/pushSubscription`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ endpoint: subscription.endpoint }),
              })

              const data = await result.json()

              if (data.subscription) {
                setPushSubscription(data.subscription)
                setIsSubscribed(true)
                return
              } else {
                const p256dh = subscription.getKey("p256dh")
                const auth = subscription.getKey("auth")

                if ((user || guest) && p256dh && auth) {
                  const result = await addPushSubscription(
                    subscription,
                    p256dh,
                    auth,
                  )

                  if (!result.error && result.subscription) {
                    setPushSubscription(result.subscription)
                    setIsSubscribed(true)
                  } else {
                    toast.error(result.error)
                  }
                }

                return
              }
            } else {
              // Permission granted but no subscription - auto subscribe!
              const publicVapidKey = getEnv().VITE_VAPID_PUBLIC_KEY
              if (publicVapidKey) {
                try {
                  const newSubscription = await subscribeToPushNotifications(
                    registration,
                    publicVapidKey,
                  )
                  if (newSubscription) {
                    setIsSubscribed(true)
                    const p256dh = newSubscription.getKey("p256dh")
                    const auth = newSubscription.getKey("auth")
                    if (user && p256dh && auth) {
                      await addPushSubscription(newSubscription, p256dh, auth)
                    }
                    return
                  }
                } catch {
                  // Auto-subscribe failed, will show button for manual retry
                }
              }
            }
          }
        }
      }

      // If we get here, either permission isn't granted or no subscription exists (and auto-subscribe failed)
      const registration = await registerServiceWorker()
      if (registration) {
        setSwRegistration(registration)
        setIsSubscribed(false)
      }
    }

    initializeServiceWorker()
  }, [token])

  const handleSubscribe = async () => {
    // Handle extension notifications - just request permission, no database storage
    if (!isStandalone && (os === "ios" || os === "android")) {
      setShowAddToHomeScreen(true)
      return
    }
    if (swRegistration && !pushSubscription) {
      const publicVapidKey = getEnv().VITE_VAPID_PUBLIC_KEY

      if (!publicVapidKey) {
        toast.error("VAPID key missing - notifications cannot be enabled")
        return
      }

      try {
        const subscription = await subscribeToPushNotifications(
          swRegistration,
          publicVapidKey,
        )
        if (subscription) {
          setIsSubscribed(true)

          const p256dh = subscription.getKey("p256dh")
          const auth = subscription.getKey("auth")

          if (user && p256dh && auth) {
            addPushSubscription(subscription, p256dh, auth)
          }
          toast.success("Notifications enabled!")
        }
      } catch (subscribeError) {
        const errorMsg =
          subscribeError instanceof Error
            ? subscribeError.message
            : "Unknown error"
        if (errorMsg.includes("timeout")) {
          toast.error("Push service timeout - try again later")
        } else {
          toast.error("Failed to enable notifications")
        }
      }
    }
  }

  if (!isMounted || isManagingApp) return null

  // Show notification button for extensions if permission not granted, for web if service worker ready
  const shouldShow = !isExtension && !isSubscribed && !!swRegistration

  return (
    <Div style={styles.enableNotificationsContainer.style}>
      <Weather onLocationClick={onLocationClick} showLocation={!shouldShow} />
      {isMounted && shouldShow && (
        <Div style={styles.enableNotifications.style}>
          <Button
            data-testid="enableNotificationsButton"
            onClick={handleSubscribe}
            className={"small"}
            style={styles.enableNotificationsButton.style}
            disabled={!swRegistration}
          >
            <BellRing size={16} /> {t(text)}
          </Button>
        </Div>
      )}
    </Div>
  )
}
