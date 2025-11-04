"use client"

import React, { useEffect, useRef, useState } from "react"
import clsx from "clsx"
import styles from "./Moodify.module.scss"

import { user, guest, message } from "./types"
import { API_URL, apiFetch } from "./utils"
import MoodSelector from "./MoodSelector"
import { useAppContext } from "./context/AppContext"
import { toast, useNavigation, usePlatform, useTheme } from "./platform"
import { useAuth } from "./context/providers"
import Loading from "./Loading"
import { ChartCandlestick } from "./icons"
import { useHasHydrated } from "./hooks"
export type Mood =
  | "happy"
  | "sad"
  | "angry"
  | "astonished"
  | "inlove"
  | "thinking"

export const emojiMap: Record<Mood, string> = {
  happy: "😊",
  sad: "😢",
  angry: "😠",
  astonished: "😲",
  inlove: "😍",
  thinking: "🤔",
}

export async function updateMood({
  type,
  token,
  language,
}: {
  type: Mood
  token: string
  language: string
}) {
  try {
    const response = await apiFetch(`${API_URL}/mood`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type, language }),
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error(new Error("Error updating mood:"), error)
    throw error
  }
}

export default function Moodify({
  className,
  onOpenReports,
  hasReports,
}: {
  className?: string
  onOpenReports?: () => void
  hasReports?: boolean
}) {
  const { isDrawerOpen } = useTheme()

  const { t } = useAppContext()
  const { searchParams, addParams, removeParams } = useNavigation()

  const {
    user,
    guest,
    fetchMoods,
    token,
    isLoading: isLoadingMood,
    language,
    track: trackEvent,
    fetchMood,
    ...rest
  } = useAuth()

  useEffect(() => {
    token && fetchMood()
  }, [token])

  const { os } = usePlatform()

  const [mood, setMood] = useState<Mood | undefined>(rest.mood?.type)
  useEffect(() => {
    rest.mood?.type && setMood(rest.mood?.type)
  }, [rest.mood])

  const isHydrated = useHasHydrated()

  const [isEnabled, setIsEnabled] = useState(!searchParams.get("editTask"))

  useEffect(() => {
    setIsEnabled(!!searchParams.get("editTask"))
  }, [searchParams])

  const [messages, setMessages] = useState<{
    messages: {
      user: user | null
      guest: guest | null
      messages: message
    }[]
    totalCount: number
    hasNextPage: boolean
    nextPage: number | null
  }>({
    messages: [],
    totalCount: 0,
    hasNextPage: false,
    nextPage: null,
  })

  useEffect(() => {
    if (hasReports) {
      onOpenReports?.()
    }
  }, [hasReports])

  const [until, setUntil] = useState<number>(1)

  const messagesRef = useRef<HTMLDivElement>(null)

  const scrollToLastMessage = () => {
    setTimeout(() => {
      messagesRef.current?.scrollTo({
        top: messagesRef.current.scrollHeight,
        behavior: "smooth",
      })
    }, 200)
  }

  // useEffect(() => {
  //   if (isChatOpen) {
  //     if (hasNotification && mood !== "thinking") {
  //       setHasNotification(false)
  //     }
  //   }
  // }, [isChatOpen, hasNotification, mood])

  const moodMessages: Record<Mood, string> = {
    happy: t("mood_happy"),
    sad: t("mood_sad"),
    angry: t("mood_angry"),
    astonished: t("mood_astonished"),
    inlove: t("mood_inlove"),
    thinking: t("mood_thinking"),
  }

  const handleMoodClick = (selectedMood: Mood) => {
    setMood(selectedMood)
    setIsEditing(false)
  }

  const [isEditing, setIsEditing] = useState(false)

  if (!isEnabled) return null

  if (!isHydrated) return null

  return (
    <div
      data-testid="moodify"
      className={clsx(
        styles.moodify,
        className,
        os && styles[os],
        isDrawerOpen && styles.drawerOpen,
      )}
    >
      <>
        <div className={styles.content}>
          <div className={styles.tryMoodTracker}>
            <button
              data-testid="moodify-reports-button"
              style={{ fontSize: 12 }}
              className="link"
              onClick={() => onOpenReports?.()}
            >
              {t("Mood reports")}
            </button>
            <ChartCandlestick className={styles.chartCandlestick} size={11} />
          </div>
          <div className={styles.salutation}>
            {t("Hi, how do you feel today?")}
          </div>
          {isLoadingMood ? (
            <div className={styles.loadingMood}>
              <Loading />
            </div>
          ) : (
            <MoodSelector
              className={styles.moodSelector}
              mood={mood}
              onMoodChange={async (mood) => {
                if (!mood || !token) return
                setMood(mood)

                const result = await updateMood({
                  type: mood,
                  token: token,
                  language,
                })

                if (!result || result.error) {
                  console.error(
                    new Error(result?.error || "Failed to update mood"),
                  )

                  toast.error("Failed to update mood")
                } else {
                  await fetchMoods()
                  addParams({ moodReport: "true" })
                }
              }}
            />
          )}
        </div>
        {/* <div className={styles.startChat}>
            <button
              data-testid="moodify-start-chat-button"
              aria-label="Open chat"
              className={styles.startChatButton}
              onClick={handleStartChat}
            >
              <MessageCircle size={12} />
              {t("Want to chat")}?
            </button>
          </div> */}
      </>
    </div>
  )
}
