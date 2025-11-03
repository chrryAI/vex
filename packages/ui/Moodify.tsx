"use client"

import React, { useEffect, useRef, useState } from "react"
import clsx from "clsx"
import styles from "./Moodify.module.scss"
import {
  BrainCircuit,
  BrainCog,
  ChevronDown,
  CircleChevronDown,
  CircleX,
  Loader,
  LoaderCircle,
  MessageCircle,
  MousePointerClick,
  History,
  Send,
  SmilePlus,
  Circle,
  ChartCandlestick,
  Coins,
} from "lucide-react"
import { PiHandTap } from "react-icons/pi"
import { user, guest, message } from "./types"
import useSWR from "swr"
import { toast } from "react-hot-toast"
import { API_URL, FRONTEND_URL, pageSizes, replaceLinks } from "./utils"
import { v4 as uuid } from "uuid"

import ReactMarkdown from "react-markdown"
import MoodSelector from "./MoodSelector"
import { useAppContext } from "./context/AppContext"
import { useNavigation, usePlatform, useTheme } from "./platform"
import { useAuth } from "./context/providers"
import Loading from "./Loading"
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
    const response = await fetch(`${API_URL}/mood`, {
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
  onOpenChat,
  onOpenReports,
  hasReports,
}: {
  className?: string
  onOpenChat?: () => void
  onOpenReports?: () => void
  hasReports?: boolean
}) {
  const { isDrawerOpen } = useTheme()

  const { t } = useAppContext()
  const { push, searchParams } = useNavigation()
  const [isChatOpen, setIsChatOpenInternal] = useState<boolean | undefined>()

  const setIsChatOpen = (value: boolean) => {
    setIsChatOpenInternal(value)
    if (value) {
      setTimeout(() => {
        document.body.style.overflow = "hidden"
      }, 100)
      push("?moodReport=true")
    } else {
      setTimeout(() => {
        document.body.style.overflow = "auto"
      }, 100)
    }
  }

  const {
    user,
    guest,
    fetchMoods,
    token,
    isLoading: isLoadingMood,
    language,
    track: trackEvent,
    ...rest
  } = useAuth()

  const { os } = usePlatform()

  const firstName = user ? user?.name?.split(" ")[0] : ""

  const [mood, setMood] = useState<Mood | undefined>(rest.mood?.type)
  useEffect(() => {
    rest.mood?.type && setMood(rest.mood?.type)
  }, [rest.mood])

  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  const [isEnabled, setIsEnabled] = useState(!searchParams.get("editTask"))

  useEffect(() => {
    setIsEnabled(!searchParams.get("editTask"))
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

  useEffect(() => {
    isChatOpen === true
      ? trackEvent({ name: "chat_open" })
      : isChatOpen === false && trackEvent({ name: "chat_close" })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsChatOpen(false)
      }
    }
    // const handleKeyUp = (e: KeyboardEvent) => {
    //   if (e.key === " " && !isChatOpen) {
    //     e.preventDefault()
    //     setIsChatOpen(true)
    //   }
    // }

    window.addEventListener("keydown", handleKeyDown)
    // window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      // window.removeEventListener("keyup", handleKeyUp)
    }
  }, [isChatOpen])

  const { data: messagesData, isLoading: isLoadingMessages } = useSWR(
    token ? ["messages", until, token] : null,
    async () => {
      const params = new URLSearchParams({
        pageSize: (until * pageSizes.messages).toString(),
      })
      const response = await fetch(`${API_URL}/messages?${params}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        console.error(new Error("Failed to fetch messages"))
        // toast.error("Failed to fetch messages")
        return {
          messages: [],
          totalCount: 0,
          hasNextPage: false,
          nextPage: null,
        }
      }

      const messages = await response.json()

      return messages
    },
  )

  const messagesRef = useRef<HTMLDivElement>(null)

  const scrollToLastMessage = () => {
    setTimeout(() => {
      messagesRef.current?.scrollTo({
        top: messagesRef.current.scrollHeight,
        behavior: "smooth",
      })
    }, 200)
  }

  useEffect(() => {
    if (messagesData) {
      setMessages(messagesData)
    }
  }, [messagesData])

  useEffect(() => {
    if (isChatOpen) {
      onOpenChat?.()
      scrollToLastMessage()
    }
  }, [isChatOpen])

  const [hasNotification, setHasNotification] = useState(mood === "thinking")

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
    setIsChatOpen(true)
    setIsEditing(false)
  }

  const handleStartChat = () => {
    document.body.style.overflow = "hidden"
    setIsChatOpen(true)
  }
  const [newMessage, setNewMessage] = useState("")
  const [loadingNewMessage, setLoadingNewMessage] = useState(false)

  const chatBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        chatBoxRef.current &&
        !chatBoxRef.current.contains(event.target as Node)
      ) {
        setIsChatOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const [isEditing, setIsEditing] = useState(false)

  if (!isClient || !isEnabled) return null

  return (
    <div
      data-testid="moodify"
      className={clsx(
        styles.moodify,
        className,
        isChatOpen && styles.chatOpen,
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
                  push("?moodReport=true")
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
