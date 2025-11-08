"use client"

import React, { useEffect, useState } from "react"
import clsx from "clsx"
import styles from "./Moodify.module.scss"

import { API_URL, apiFetch } from "./utils"
import MoodSelector from "./MoodSelector"
import { useAppContext } from "./context/AppContext"
import { toast, useNavigation, usePlatform, useTheme } from "./platform"
import { useAuth } from "./context/providers"
import Loading from "./Loading"
import { ChartCandlestick } from "./icons"
import { useHasHydrated } from "./hooks"
import { moodType } from "./types"

export type Mood = moodType

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

  useEffect(() => {
    if (hasReports) {
      onOpenReports?.()
    }
  }, [hasReports])

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
