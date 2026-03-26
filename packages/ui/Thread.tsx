"use client"

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useAppContext } from "./context/AppContext"
import {
  useApp,
  useAuth,
  useChat,
  useNavigationContext,
} from "./context/providers"
import { useStyles } from "./context/StylesContext"
import Donut from "./Donut"
import HipChat from "./HipChat"
import { useHasHydrated, useThreadMetadata } from "./hooks"
import { useThreadPresence } from "./hooks/useThreadPresence"
import { useUserScroll } from "./hooks/useUserScroll"
import { WannathisIcon } from "./icons"
import Loading from "./Loading"
import MemoryConsent from "./MemoryConsent"
import { A, Div, usePlatform, useTheme } from "./platform"
import Skeleton from "./Skeleton"
import { BREAKPOINTS } from "./styles/breakpoints"
import { useThreadStyles } from "./Thread.styles"
import Tribe from "./Tribe"
import type { aiAgent, paginatedMessages, thread } from "./types"
import { isCollaborator, isE2E, isOwner } from "./utils"
import { ANALYTICS_EVENTS } from "./utils/analyticsEvents"

// import Donut from "./Donut"

// Lazy load Focus only on web (not extension) to reduce bundle size
// This component includes timer, tasks, moods, and analytics - heavy dependencies
const Focus = lazy(() => import("./Focus"))

const Thread = ({
  isHome,
}: {
  isHome?: boolean
  threadId?: string

  threadData?: { thread: thread; messages: paginatedMessages }
}) => {
  // Initialize unified styles hook
  const styles = useThreadStyles()

  // Split contexts for better organization
  const { t, console } = useAppContext()

  // Auth context
  const {
    user,
    guest,
    plausible,
    threadIdRef,
    memoriesEnabled,
    setShowFocus,
    grapes,
    app,
    baseApp,
    setIsRetro,
    isRetro,
    advanceDailySection,
    dailyQuestionData,
    dailyQuestionIndex,
    setDailyQuestionIndex,
    minimize,
    postId,
    wasPear,
    isPear,
    isHippoOpen,
    setPear,
    donut,
    ...auth
  } = useAuth()

  const threadId = auth.threadId || threadIdRef.current

  // Chat context
  const {
    isWebSearchEnabled,
    selectedAgent,
    setSelectedAgent,
    aiAgents,
    hitHourlyLimit,
    debateAgent,
    hourlyLimit,
    hourlyUsageLeft,
    thread,
    setThread,
    messages,
    setMessages: setMessagesInternal,
    isChatFloating,
    refetchThread,
    isLoading,
    isLoadingMore,
    setIsLoadingMore,
    until,
    setUntil,
    error,
    scrollToBottom,
    nextPage,
    status,
    liked,
    setLiked,
    placeHolderText,
    isEmpty,
    ...chat
  } = useChat()

  const showTribe = !!chat.showTribe

  const hasHydrated = useHasHydrated()

  const showFocus = auth.showFocus && isEmpty && hasHydrated

  const { pathname } = useNavigationContext()

  const { isIDE, isStandalone, viewPortWidth } = usePlatform()

  // Navigation context
  const {
    router,
    setIsNewChat,
    isVisitor,
    collaborationStatus,
    setCollaborationStatus,
    threads,
    goToThreads,
    refetchThreads,
    addParams,
    slug,
    burn,
    goToCalendar,
  } = useNavigationContext()

  const { setShouldGetCredits } = useChat()

  // Use setMessagesInternal directly instead of wrapping it
  const setMessages = setMessagesInternal

  const { appStatus, appFormWatcher, suggestSaveApp } = useApp()

  const { addHapticFeedback, isMobileDevice, isSmallDevice } = useTheme()

  // Update thread metadata dynamically
  useThreadMetadata(thread)

  // Derived from thread

  const id = threadId

  // plausible if we've already auto-selected an agent for this thread
  const shouldStopAutoScrollRef = useRef(false)

  const refetch = () => {
    return refetchThread()
  }

  // ⚡ Bolt: Stable callbacks for Messages component to prevent re-renders
  const isChatFloatingRef = useRef(isChatFloating)
  isChatFloatingRef.current = isChatFloating

  const scrollToBottomRef = useRef(scrollToBottom)
  scrollToBottomRef.current = scrollToBottom

  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  const setMessagesRef = useRef(setMessages)
  setMessagesRef.current = setMessages

  const currentMessagesRef = useRef(messages)
  currentMessagesRef.current = messages

  const handlePlayAudio = useCallback(() => {
    shouldStopAutoScrollRef.current = true
  }, [])

  const handleCharacterProfileUpdate = useCallback(() => {
    !isChatFloating && scrollToBottom()
  }, [isChatFloating, scrollToBottom])

  const handleToggleLike = useCallback((liked: boolean | undefined) => {
    refetchRef.current()
  }, [])

  const handleDelete = useCallback(async ({ id }: { id: string }) => {
    if (currentMessagesRef.current.length === 1) {
      await refetchRef.current().then(() => setMessagesRef.current([]))
    } else {
      await refetchRef
        .current()
        .then(() =>
          setMessagesRef.current(
            currentMessagesRef.current.filter((m) => m.message.id !== id),
          ),
        )
    }
  }, [])

  // plausible last processed threadData to prevent re-processing
  // const lastProcessedThreadDataRef = useRef<any>(null)

  // Smart auto-scroll: only scroll for short responses
  const shouldAutoScroll = (currentMessage: string) => {
    if (currentMessage.length === 0) return true
    if (shouldStopAutoScrollRef.current) return false // Once stopped, stay stopped for this response

    const contentLength = currentMessage.length
    const wordCount = currentMessage.split(" ").length

    // Stop auto-scrolling if response gets too long
    if (contentLength > 500 || wordCount > 80) {
      shouldStopAutoScrollRef.current = true
      return false
    }

    return true
  }

  const messagesRef = useRef<HTMLDivElement>(null)

  const { notifyTyping } = useThreadPresence({
    threadId: id || "",
  })

  const isPendingCollaboration = thread?.collaborations?.some(
    (collaboration) =>
      collaboration.user.id === user?.id &&
      collaboration.collaboration.status !== "active",
  )

  const collaborator = thread && isCollaborator(thread, user?.id)
  const activeCollaborator =
    thread && isCollaborator(thread, user?.id, "active")

  const [autoSelectedAgent, setAutoSelectedAgent] = useState<boolean>(false)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    // Only reset if not already in human mode
    if (lastMessage?.message.agentId && !autoSelectedAgent && !debateAgent) {
      const agent = aiAgents?.find(
        (agent) => agent.id === lastMessage?.message.agentId,
      )
      if (agent) {
        setSelectedAgent(agent)
        setAutoSelectedAgent(true)
      }
    }
  }, [messages, autoSelectedAgent, debateAgent])

  useEffect(() => {
    if (thread?.collaborations?.length) {
      plausible({
        name: ANALYTICS_EVENTS.COLLABORATION,
        props: {
          collaborator,
          isOwner: isOwner(thread, {
            userId: user?.id,
            guestId: guest?.id,
          }),
          activeCollaborator,
          collaborationStatus,
          isPendingCollaboration,
          collaborationsCount: thread?.collaborations?.length,
        },
      })
    }
  }, [
    collaborationStatus,
    collaborator,
    activeCollaborator,
    isPendingCollaboration,
    thread?.collaborations?.length,
    user?.id,
    guest?.id,
  ])
  // aiAgents excluded to prevent loop, setSelectedAgent is stable

  const nameIsRequired = `👋 ${t("Name your app...")}`
  const titleIsRequired = `✍️ ${t("Give it a title...")}`

  // Only show app creation warnings when actually in app creation mode
  const appFormPlaceholder = appStatus?.part
    ? !appFormWatcher.canSubmit || appFormWatcher.id
      ? !appFormWatcher.name
        ? nameIsRequired
        : appFormWatcher.title
          ? null
          : titleIsRequired
      : !appFormWatcher?.highlights?.length
        ? `${t("You can go next, updating suggestions recommended.")} 🎯`
        : !appFormWatcher?.systemPrompt
          ? `${t("Updating Description and Settings recommended.")} 🧠`
          : `${t("You can save it now!")} 🚀`
    : null

  const [isGame, setIsGame] = useState(false)

  const [collaborationVersion, setCollaborationVersion] = useState(0)
  const { utilities } = useStyles()

  const { isUserScrolling, hasStoppedScrolling, resetScrollState } =
    useUserScroll()

  // Memoize the streaming update handler to prevent infinite loops
  const handleStreamingUpdate = useCallback(
    ({
      content,
      clientId,
      aiAgent,
      isWebSearchEnabled,
      isImageGenerationEnabled,
    }: {
      content: string
      clientId?: string
      aiAgent?: aiAgent
      isWebSearchEnabled?: boolean
      isImageGenerationEnabled?: boolean
    }) => {
      scrollToBottom()

      if (isE2E && content.length > 500) {
        const wordCount = content.split(/\s+/).length
        const hasReasoning = content.includes("__REASONING__")
        const preview = content.slice(0, 200).replace(/\n/g, " ")

        console.log("🤖 Streaming Update", {
          preview: `${preview}...`,
          stats: {
            chars: content.length,
            words: wordCount,
            hasReasoning,
          },
          agent: aiAgent?.displayName || aiAgent?.name || "unknown",
          features: {
            webSearch: !!isWebSearchEnabled,
            imageGen: !!isImageGenerationEnabled,
          },
          clientId: clientId?.slice(0, 8),
        })
      }

      // Only update if content actually changed and clientId exists
      if (!clientId) return

      setMessages((prev) => {
        const existingIndex = prev.findIndex(
          (m) => m.message.id === clientId && !m.message.isStreamingStop,
        )

        // If message exists, update it
        if (existingIndex >= 0) {
          return prev.map((m) =>
            m.message.id === clientId && !m.message.isStreamingStop
              ? {
                  ...m,
                  message: {
                    ...m.message,
                    content,
                    isStreaming: true,
                    isWebSearchEnabled: !!isWebSearchEnabled,
                    isImageGenerationEnabled: !!isImageGenerationEnabled,
                  },
                  aiAgent: aiAgent ?? m.aiAgent,
                }
              : m,
          )
        }

        if (threadId !== prev?.[0]?.message?.threadId) {
          return prev
        }

        // If message doesn't exist, add it (from other device/collaboration)
        return [
          ...prev,
          {
            message: {
              id: clientId,
              type: "chat" as const,
              content,
              createdOn: new Date(),
              updatedOn: new Date(),
              agentId: aiAgent?.id || null,
              agentVersion: aiAgent?.version || null,
              threadId: threadId || "",
              readOn: new Date(),
              userId: user?.id || null,
              guestId: guest?.id || null,
              searchContext: null,
              webSearchResult: null,
              metadata: null,
              originalContent: content,
              images: null,
              files: null,
              isWebSearchEnabled: !!isWebSearchEnabled,
              isImageGenerationEnabled: !!isImageGenerationEnabled,
              isStreaming: true,
              reasoning: null,
              like: null,
              dislike: null,
              creditCost: aiAgent?.creditCost || 1,
              task: "chat",
              reactions: null,
              clientId,
              audio: null,
              video: null,
              selectedAgentId: aiAgent?.id || null,
              debateAgentId: null,
              pauseDebate: false,
            },
            aiAgent: aiAgent,
            thread: thread,
          },
        ]
      })
    },
    [
      isLoadingMore,
      scrollToBottom,
      setMessages,
      shouldAutoScroll,
      resetScrollState,
      isUserScrolling,
      hasStoppedScrolling,
    ],
  )

  const render = () => {
    return (
      <Div
        data-thread-title={thread?.title}
        data-testid={id ? "thread" : isHome ? "home" : undefined}
        style={{
          // paddingTop: 0,
          // paddingRight: isMobileDevice ? 0 : 10,
          // paddingBottom: 195,
          // paddingLeft: isMobileDevice ? 0 : 10,
          ...styles.thread.style,
          ...(isEmpty
            ? !threadId &&
              hasHydrated && {
                ...styles.threadEmpty.style,
                zIndex: 10,
                paddingBottom:
                  minimize && !showFocus && !showTribe
                    ? 0
                    : isStandalone
                      ? 200
                      : 195,
              }
            : {
                paddingBottom: threadId ? 165 : undefined,
              }),
          ...{
            position: "relative",
            maxWidth: isSmallDevice ? BREAKPOINTS.tablet : BREAKPOINTS.desktop,
            marginBottom: isIDE ? 50 : undefined,
          },
        }}
      >
        {viewPortWidth >= 1400 && (
          <A
            onClick={() => {
              plausible({
                name: ANALYTICS_EVENTS.WANNATHIS,
                props: {
                  app: app?.name,
                },
              })
            }}
            href="https://wannathis.one?via=iliyan"
            target="_blank"
            rel="noopener noreferrer"
            className="transparent"
            style={{
              ...utilities.button.style,
              ...utilities.small.style,
              ...utilities.transparent.style,
              position: "fixed",
              bottom: 15,
              right: 15,
              fontSize: "0.8rem",
            }}
          >
            <WannathisIcon /> Wannathis
          </A>
        )}

        {/* {!donut && auth.isDevelopment && <Donut apiKey={auth.token} />} */}

        <HipChat
          // dataTestId={
          //   threadId && !isEmpty ? "thread-instruction" : "home-instruction"
          // }
          isMobileDevice={isMobileDevice}
          hipchat={false}
          compactMode={showFocus || showTribe}
          showSuggestions={!showFocus && !showTribe}
          showMessages={!showFocus && !showTribe}
          messagesStyle={{
            margin: "0 -10px",
          }}
        />
      </Div>
    )
  }

  // Only load Focus on web (not extension) and after hydration
  // Show Tribe for chrry app or /tribe routes

  return showFocus ? (
    <Suspense fallback={<Loading fullScreen />}>
      <Focus>{render()}</Focus>
    </Suspense>
  ) : (
    <Skeleton>
      <Tribe>
        {!showTribe && <MemoryConsent />}
        {render()}
      </Tribe>
    </Skeleton>
  )
}

export default Thread
