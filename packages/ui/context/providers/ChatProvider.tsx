"use client"

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react"
import { useAuth } from "./AuthProvider"
import { useData } from "./DataProvider"
import {
  aiAgent,
  thread,
  app,
  collaboration,
  user,
  guest,
  message,
  messages,
  paginatedMessages,
  appWithStore,
  placeHolder,
} from "../../types"

import { pageSizes, isOwner } from "../../utils"
import { hasThreadNotification } from "../../utils/hasThreadNotification"
import {
  useLocalStorage,
  useNavigation,
  usePlatform,
  useTheme,
} from "../../platform"
import { ANALYTICS_EVENTS } from "../../utils/analyticsEvents"
import { useApp } from "./AppProvider"
import useSWR from "swr"
import { useWebSocket } from "../../hooks/useWebSocket"
import { useUserScroll } from "../../hooks/useUserScroll"
import { useError } from "./ErrorProvider"

const ChatContext = createContext<
  | {
      scrollToTop: (timeout?: number) => void
      onlyAgent: boolean
      shouldFetchThread: boolean
      setShouldFetchThread: (shouldFetchThread: boolean) => void
      shouldGetCredits: boolean
      setShouldGetCredits: (shouldGetCredits: boolean) => void
      fetchActiveCollaborationThreadsCount: () => Promise<void>
      fetchPendingCollaborationThreadsCount: () => Promise<void>
      setIsNewAppChat: ({
        item,
        tribe,
      }: {
        item: appWithStore | undefined
        tribe?: boolean
      }) => void
      shouldFocus: boolean
      setShouldFocus: (shouldFocus: boolean) => void
      placeHolderText: string | undefined
      setPlaceHolderText: (placeHolderText: string | undefined) => void
      isImageGenerationEnabled: boolean
      setShowTribe: (show: boolean) => void
      showTribe: boolean | undefined
      setIsImageGenerationEnabled: (
        value: boolean,
        forAgent?: aiAgent | null,
      ) => void
      hasNotification: boolean
      nextPage: number | undefined
      setNextPage: (nextPage: number | undefined) => void
      scrollToBottom: (timeout?: number, force?: boolean) => void
      status: number | null
      error?: Error | unknown
      until: number
      setUntil: (until: number) => void
      liked?: boolean
      setLiked: (liked: boolean | undefined) => void
      isLoadingMore: boolean
      setIsLoadingMore: (isLoadingMore: boolean) => void
      isLoading: boolean
      setIsAgentModalOpenInternal: (isAgentModalOpen: boolean) => void
      isDebateAgentModalOpen: boolean
      setIsDebateAgentModalOpen: (isDebateAgentModalOpen: boolean) => void
      isAgentModalOpen: boolean
      setIsAgentModalOpen: (isAgentModalOpen: boolean) => void
      isAgentAuthorized: (agent: aiAgent | undefined | null) => boolean
      messages: messages
      setMessages: React.Dispatch<React.SetStateAction<messages>>
      perplexityAgent?: aiAgent
      deepSeekAgent?: aiAgent
      claudeAgent?: aiAgent
      favouriteAgent?: aiAgent
      setCreditsLeft: (creditsLeft: number) => void
      isWebSearchEnabled: boolean
      selectedAgent: aiAgent | undefined | null
      setSelectedAgent: (agent: aiAgent | undefined | null) => void
      aiAgents: aiAgent[]
      hitHourlyLimit: boolean
      debateAgent: aiAgent | undefined | null
      setDebateAgent: (agent: aiAgent | undefined | null) => void
      isDebating: boolean
      hourlyLimit: number
      hourlyUsageLeft: number
      isEmpty: boolean
      isChatFloating: boolean
      setIsChatFloating: (isChatFloating: boolean) => void
      input: string
      refetchThread: () => Promise<void>
      setIsWebSearchEnabled: (isWebSearchEnabled: boolean) => void
      setInput: (input: string) => void
      placeHolder: placeHolder | undefined
      setPlaceHolder: (placeHolder?: placeHolder) => void
      creditsLeft?: number
      thread?: thread
      threadId?: string
      setThread: (thread?: thread) => void
      userNameByUrl: string | undefined
      isLoadingThreads: boolean
      setIsLoadingThreads: (value: boolean) => void
      burn: boolean
      threads?: {
        threads?: thread[]
        totalCount: number
      }
      setThreads: (value: { threads: thread[]; totalCount: number }) => void

      wasIncognito: boolean
      setWasIncognito: (value: boolean) => void
      isVisitor: boolean
      setIsVisitor: (value: boolean) => void
      collaborationStep: number
      setCollaborationStep: (step: number) => void
      isNewChat: boolean
      refetchThreads: () => Promise<void>
      activeCollaborationThreadsCount: number
      pendingCollaborationThreadsCount: number
      setCollaborationStatus: (
        status: "pending" | "active" | undefined | null,
      ) => void
      collaborationStatus: "pending" | "active" | undefined | null
      setIsNewChat: ({
        value,
        to,
        tribe,
      }: {
        value: boolean
        to?: string
        tribe?: boolean
      }) => void
    }
  | undefined
>(undefined)

export function ChatProvider({
  children,
}: {
  children: ReactNode
}): React.JSX.Element {
  // Get auth data
  const {
    setGuest,
    setUser,
    setInstructions,
    storeApps,
    app,
    plausible,
    aiAgents,
    token,
    setProfile,
    getAppSlug,
    deviceId,
    profile,
    fingerprint,
    user,
    guest,
    session,
    thread,
    setThread,
    sushiAgent,
    perplexityAgent,
    claudeAgent,
    favouriteAgent,
    threadIdRef,
    threadId,
    migratedFromGuestRef,
    fetchSession,
    loadingApp,
    setLoadingApp,
    threads,
    setThreads,
    hasStoreApps,
    hasNotification,
    setHasNotification,
    setThreadId,
    burn,
    isPear,
    input,
    setInput,
    setShowFocus,
    showFocus,
    hourlyLimit,
    hourlyUsageLeft,
    ...auth
  } = useAuth()
  const { actions } = useData()

  // const threadId = threadIdRef.current

  const [isChatFloating, setIsChatFloating] = useState(false)

  // Chat state

  const [messages, setMessages] = useState<
    {
      message: message & {
        isStreaming?: boolean
        isStreamingStop?: boolean
      }
      user?: user
      guest?: guest
      aiAgent?: aiAgent
      thread?: thread
    }[]
  >(auth.threadData?.messages.messages || [])

  const isEmpty = !messages?.length

  const { pathname, ...router } = useNavigation()

  const showTribe = auth.showTribe && isEmpty

  const setShowTribe = auth.setShowTribe

  const { isExtension, isMobile, isTauri } = usePlatform()

  const [shouldFetchThreads, setShouldFetchThreads] = useState(true)

  let userNameByUrl: string | undefined = undefined

  const pathSegments = pathname.split("/").filter(Boolean)

  if (pathSegments.length >= 1 && pathname.includes("/u/")) {
    // New pattern: /u/[locale]/[username] OR /u/[username]
    userNameByUrl = pathSegments[pathSegments.length - 1]
  }

  const [collaborationStatus, setCollaborationStatusInternal] = useState<
    "pending" | "active" | undefined | null
  >(
    user?.pendingCollaborationThreadsCount ||
      guest?.pendingCollaborationThreadsCount
      ? "pending"
      : undefined,
  )

  const toFetch = threadId || threadIdRef.current

  // Load cached threads immediately on mount

  const {
    data: threadsSwr,
    mutate: refetchThreads,
    isLoading: isLoadingThreadsSwr,
    error: threadsError,
  } = useSWR(
    token && shouldFetchThreads && session
      ? ["contextThreads", toFetch, app?.id, collaborationStatus]
      : null,
    async () => {
      try {
        const threads = await actions.getThreads({
          onError: (status) => {
            if (status === 429) {
              setShouldFetchThreads(false)
            }
          },
          appId: app?.id,
          userName: userNameByUrl,
          pageSize: pageSizes.menuThreads - (isMobile ? 2 : 0),
          sort: "bookmark",
          collaborationStatus:
            collaborationStatus === "pending" ? undefined : collaborationStatus,
          threadId:
            !thread?.collaborations?.some(
              (c) => user && c.user.id === user?.id,
            ) || guest
              ? toFetch
              : undefined,
        })

        // Cache threads on successful fetch (30 min TTL)

        return threads
      } catch (error) {
        captureException(error)
      }
    },

    {
      onError: (error) => {
        // Stop retrying on rate limit errors
        if (error.message.includes("429")) {
          setShouldFetchThreads(false)
        }
      },
      // revalidateOnMount: true,
      // revalidateOnFocus: true,
    },
  )

  useEffect(() => {
    if (user && migratedFromGuestRef.current) {
      migratedFromGuestRef.current = false
      fetchSession()
      refetchThreads()
    }
  }, [fetchSession, migratedFromGuestRef, refetchThreads, user])

  const [isLoadingThreads, setIsLoadingThreads] = useState(!threads)

  useEffect(() => {
    if (threadsError || !isLoadingThreadsSwr) {
      setIsLoadingThreads(false)
    }
  }, [threadsError, isLoadingThreadsSwr])

  const [activeCollaborationThreadsCount, setActiveCollaborationThreadsCount] =
    useState<number>(
      user?.activeCollaborationThreadsCount ||
        guest?.activeCollaborationThreadsCount ||
        0,
    )

  useEffect(() => {
    if (threadsSwr && Array.isArray(threadsSwr.threads)) {
      setThreads(threadsSwr)
      setIsLoadingThreads(false)
    }
  }, [setThreads, threadsSwr])

  const fetchActiveCollaborationThreadsCount = useCallback(async () => {
    const threads = await actions.getThreads({
      pageSize: 1,
      collaborationStatus: "active",
      appId: app?.id,
    })
    if (threads?.totalCount)
      setActiveCollaborationThreadsCount(threads.totalCount)
  }, [actions, app])

  const [isNewChat, setIsNewChatInternal] = useState(false)

  const [collaborationStep, setCollaborationStep] = useState(0)

  useEffect(() => {
    if (burn) {
      setWasIncognito(true)
      // addParams({ burn: "true" })
    } else {
      setWasIncognito(false)
      // removeParams("burn")
    }
  }, [burn])

  const [wasIncognito, setWasIncognito] = useState(burn)

  const loadingAppRef = useRef<appWithStore | undefined>(undefined)

  useEffect(() => {
    const a = storeApps.find((app) => app.id === loadingAppRef?.current?.id)
    if (hasStoreApps(a) && a) {
      loadingAppRef.current = undefined

      router.push(getAppSlug(a))
    }
  }, [getAppSlug, hasStoreApps, loadingApp, router, storeApps])

  const setIsNewAppChat = ({
    item,
    tribe,
  }: {
    item: appWithStore | undefined
    tribe?: boolean
  }) => {
    if (!item) {
      return
    }

    if (!hasStoreApps(item)) {
      loadingAppRef.current = item
      setLoadingApp(item)
      return
    }

    setIsNewChat({ value: true, to: getAppSlug(item), tribe })
  }

  useEffect(() => {
    if (!threadIdRef.current) {
      setMessages([])
    }
  }, [threadIdRef])

  const fetchThreads = useCallback(async () => {
    setShouldFetchThreads(true)
    await refetchThreads()
  }, [refetchThreads])

  useEffect(() => {
    if (app) {
      fetchThreads()
    }
  }, [app, fetchThreads])

  useEffect(() => {
    setWasIncognito(burn)
    if (burn) {
      // setThread(undefined)
      setProfile(undefined)
    }
  }, [burn, setProfile])

  const userOrGuest = user || guest

  const { isSmallDevice, isDrawerOpen, playNotification } = useTheme()

  const [shouldGetCredits, setShouldGetCredits] = useState(false)

  useEffect(() => {
    if (shouldGetCredits) {
      ;(async () => {
        try {
          if (user) {
            const item = await actions.getUser()

            if (item) {
              setCreditsLeft(item.creditsLeft)
            }
          }

          if (guest) {
            const item = await actions.getGuest()

            if (item) {
              setCreditsLeft(item.creditsLeft)
            }
          }
        } catch (error) {
          console.error(error)
        } finally {
          setShouldGetCredits(false)
        }
      })()
    }
  }, [shouldGetCredits, user, guest, actions])

  const [shouldMutate, setShouldMutate] = useState(false)

  const isStreaming = messages.some((message) => message?.message?.isStreaming)
  const isStreamingStop = messages.some(
    (message) => message?.message?.isStreamingStop,
  )

  const { notifyPresence, connected } = useWebSocket<{
    type: string
    data: {
      placeholders?: {
        home: placeHolder
        thread: placeHolder
        app?: app
      }
      message?: {
        message: message
        user?: user
        guest?: guest
        aiAgent?: aiAgent
      }
      collaboration?: collaboration
    }
  }>({
    token,
    deviceId,
    deps: [userOrGuest, token, deviceId],
    onMessage: async ({ type, data }) => {
      if (type === "suggestions_generated") {
        if (user) {
          const updatedUser = await actions.getUser()
          setUser(updatedUser)
          if (updatedUser) setInstructions(updatedUser.instructions)
        }
        if (guest) {
          const updatedGuest = await actions.getGuest()
          setGuest(updatedGuest)
          if (updatedGuest) setInstructions(updatedGuest.instructions)
        }
        setShouldMutate(true)
      }
      if (
        type === "notification" &&
        data?.message?.message?.threadId !== threadId
      ) {
        playNotification()

        const title = `${
          data?.message?.message.content?.slice(0, 100) ||
          "You have a new message"
        } - Vex`

        if (isExtension) {
          // Extension notification using chrome.notifications
          if (typeof chrome !== "undefined" && chrome.notifications) {
            chrome.notifications.getPermissionLevel((level) => {
              if (level === "granted") {
                chrome.notifications.create({
                  type: "basic",
                  iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
                  title,
                  message: title,
                  contextMessage: "Vex",
                  buttons: [{ title: "View" }],
                })
              } else {
                console.log(
                  "Extension notification permission not granted:",
                  level,
                )
              }
            })
          }
        }
        if (
          data?.collaboration?.status === "active" ||
          data?.collaboration?.status === "pending"
        ) {
          setCollaborationStatus(data.collaboration.status)
        }
      }
    },
  })

  useEffect(() => {
    const hasNotifications = !!threads?.threads?.some((thread: thread) =>
      hasThreadNotification({ thread }),
    )
    if (hasNotifications) setHasNotification(hasNotifications)
  }, [setHasNotification, threads])

  const [isVisitor, setIsVisitor] = useState(false)

  useEffect(() => {
    if (profile) {
      setIsVisitor(user?.id == profile.id)
      return
    } else if (userNameByUrl) {
      setIsVisitor(user?.userName == userNameByUrl)
      return
    }

    if (thread) {
      setIsVisitor(
        !isOwner(thread, {
          userId: user?.id,
          guestId: guest?.id,
        }),
      )
      return
    }

    setIsVisitor(false)
  }, [profile, guest, user, userNameByUrl, thread, isNewChat])

  useEffect(() => {
    if (!token || !fingerprint || !connected) return

    const heartbeatInterval = setInterval(() => {
      if (!connected) return
      notifyPresence?.({
        isOnline: navigator.onLine,
        threadId: threadId,
      })
    }, 30000) // 30 seconds

    return () => clearInterval(heartbeatInterval)
  }, [token, fingerprint, notifyPresence, threadId, connected])

  useEffect(() => {
    if (!token || !fingerprint || !connected) return
    // Listen for navigation messages from service worker

    const handleNetworkChange = () => {
      notifyPresence?.({
        isOnline: navigator.onLine,
        threadId: threadId,
      })
    }
    const handleVisibilityChange = () => {
      notifyPresence?.({
        isOnline: document.visibilityState === "visible",
        threadId: threadId,
      })
    }
    const handleBeforeUnload = () => {
      notifyPresence?.({
        isOnline: false,
        threadId: threadId,
      })
    }

    if (user || guest) {
      // Initial online notification
      notifyPresence?.({
        isOnline: true,
        threadId: threadId,
      })

      // Platform-safe event listeners
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", handleVisibilityChange)
        document.addEventListener("pagehide", handleBeforeUnload)
      }

      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("pageshow", () =>
          notifyPresence?.({ isOnline: true }),
        )

        window.addEventListener("offline", handleNetworkChange)

        // Add unload listener
        window.addEventListener("beforeunload", handleBeforeUnload)
        window.addEventListener("online", handleNetworkChange)
      }

      return () => {
        // Cleanup
        if (typeof window !== "undefined" && window.removeEventListener) {
          window.removeEventListener("offline", handleNetworkChange)
          window.removeEventListener("online", handleNetworkChange)
          window.removeEventListener("beforeunload", handleBeforeUnload)
        }
        if (typeof document !== "undefined" && document.removeEventListener) {
          document.removeEventListener(
            "visibilitychange",
            handleVisibilityChange,
          )
        }
        notifyPresence?.({
          isOnline: false,
          threadId: thread?.id,
        })
      }
    }
  }, [
    user,
    guest,
    threadId,
    connected,
    token,
    fingerprint,
    notifyPresence,
    thread?.id,
  ])

  // Credits plausibleing
  const [creditsLeft, setCreditsLeft] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (user?.creditsLeft || guest?.creditsLeft) {
      setCreditsLeft(user?.creditsLeft || guest?.creditsLeft)
    }
  }, [user?.creditsLeft, guest?.creditsLeft])

  // AI Agents

  const onlyAgent = !!(app?.onlyAgent || isPear)

  const [debateAgent, setDebateAgentInternal] = useLocalStorage<
    aiAgent | undefined | null
  >("debateAgent", undefined)

  const setDebateAgent = useCallback(
    (agent: aiAgent | undefined | null) => {
      setDebateAgentInternal(agent)
    },
    [setDebateAgentInternal],
  )

  useEffect(() => {
    if (debateAgent) {
      plausible({
        name: ANALYTICS_EVENTS.DEBATE_AGENT_SELECTED,
        props: { agent: debateAgent.displayName },
      })
    }
  }, [debateAgent, plausible])

  const isAgentAuthorized = (agent: aiAgent | undefined | null) => {
    if (!agent) return false
    if (user?.subscription || guest?.subscription) {
      return true
    }
    return user
      ? !["subscriber"].includes(agent.authorization)
      : ["guest", "all"].includes(agent.authorization)
  }

  const ph = thread?.placeHolder || app?.placeHolder

  const [placeHolder, setPlaceHolder] = useState<placeHolder | undefined>(ph)

  useEffect(() => {
    setPlaceHolder(ph)
  }, [thread, app, ph])

  const [placeHolderText, setPlaceHolderText] = React.useState<
    string | undefined
  >(placeHolder?.text)

  const [shouldFocus, setShouldFocus] = useState(false)

  useEffect(() => {
    if (placeHolder?.text) {
      setPlaceHolderText(placeHolder.text)
    } else if (app?.placeholder) {
      setPlaceHolderText(app?.placeholder)
    }
  }, [placeHolder, app])

  const { appStatus } = useApp()

  const { captureException } = useError()

  const [shouldFetchThread, setShouldFetchThread] = useState(!auth.threadData)

  useEffect(() => {
    if (threadId && !shouldFetchThread) {
      setShouldFetchThread(true)
    }
  }, [threadId, shouldFetchThread])

  const [until, setUntil] = useState<number>(1)
  const [liked, setLikedInternal] = useState<boolean | undefined>(undefined)

  const setLiked = useCallback(
    (liked: boolean | undefined) => {
      setLikedInternal(liked)
      plausible({
        name: ANALYTICS_EVENTS.THREAD_LIKES,
        props: { liked },
      })
    },
    [plausible],
  )

  const [isLoading, setIsLoading] = useState(!!threadId)

  useEffect(() => {
    setIsLoading(!!threadId)
  }, [threadId])

  const [status, setStatus] = useState<number | null>(null)

  const {
    data: threadSWR,
    mutate,
    error,
  } = useSWR(
    shouldFetchThread && token && toFetch ? [toFetch, liked, until] : null,
    async () => {
      if (!toFetch) return

      const threadData = await actions.getThread({
        id: toFetch,
        pageSize: until * pageSizes.threads,
        liked: !!liked,
        onError: (error: number) => {
          setIsLoading(false)
          setStatus(error)
        },
      })

      setIsLoading(false)
      return threadData
    },
    {
      // revalidateOnMount: true,
    },
  )

  useEffect(() => {
    if (isStreaming) {
      return
    }

    if (shouldMutate) {
      mutate()
      setShouldMutate(false)
    }
  }, [shouldMutate, isStreaming, mutate])

  const [agentName, setAgentName] = useState(session?.aiAgent?.name || "")

  const [isWebSearchEnabled, setIsWebSearchEnabledInternal] = useState<boolean>(
    agentName === "perplexity",
  )

  const [isImageGenerationEnabled, setIsImageGenerationEnabledInternal] =
    useState(false)

  const isImageGenerationEnabledRef = useRef<boolean>(isImageGenerationEnabled)

  const setIsImageGenerationEnabled = (
    value: boolean,
    forAgent?: aiAgent | null,
  ) => {
    isImageGenerationEnabledRef.current = value
    setIsImageGenerationEnabledInternal(value)
    setSelectedAgentInternal(forAgent || sushiAgent)
    if (value) setDebateAgent(null)
  }

  const [isUserSelectedAgent, setIsUserSelectedAgent] = useState<boolean>(false)

  const defaultAgentInternal =
    aiAgents.find((a) => app?.defaultModel && a.name === app?.defaultModel) ||
    favouriteAgent

  const [defaultAgent, setDefaultAgent] = useState<aiAgent | undefined | null>(
    defaultAgentInternal,
  )

  const [selectedAgent, setSelectedAgentInternal] = useLocalStorage<
    aiAgent | undefined | null
  >("selectedAgent", defaultAgent)

  useEffect(() => {
    setDefaultAgent(defaultAgentInternal)
  }, [defaultAgentInternal])

  const setSelectedAgent = useCallback(
    (agent: aiAgent | undefined | null) => {
      setIsWebSearchEnabledInternal(agent?.name === "perplexity")
      if (selectedAgent?.name === agent?.name) return
      if (agent === null) {
        setAgentName("")
        setSelectedAgentInternal(null)
        setDebateAgent(null)
        return
      }

      setSelectedAgentInternal(agent)
      setAgentName(agent?.name || "")
      if (isImageGenerationEnabledRef.current)
        setIsImageGenerationEnabledInternal(
          agent?.capabilities?.imageGeneration || false,
        )
    },
    [selectedAgent?.name, setDebateAgent, setSelectedAgentInternal],
  )

  useEffect(() => {
    if (appStatus?.part) {
      setSelectedAgent(sushiAgent)
    }
  }, [appStatus?.part, setSelectedAgent, sushiAgent])

  useEffect(() => {
    if (isPear) setSelectedAgent(sushiAgent)
  }, [isPear, setSelectedAgent, sushiAgent])

  useEffect(() => {
    if (defaultAgent && (selectedAgent === undefined || !isUserSelectedAgent))
      setSelectedAgent(defaultAgent)
  }, [defaultAgent, isUserSelectedAgent, selectedAgent, setSelectedAgent])

  useEffect(() => {
    if (auth.selectedAgent?.name !== selectedAgent?.name && selectedAgent)
      auth.setSelectedAgent(selectedAgent)
  }, [auth, selectedAgent])

  useEffect(() => {
    if (selectedAgent == null) return

    if (!selectedAgent) setSelectedAgent(defaultAgent)
  }, [defaultAgent, selectedAgent, setSelectedAgent])

  const setIsWebSearchEnabled = (value: boolean) => {
    if (value) {
      if (
        app?.defaultModel === "perplexity" &&
        app?.onlyAgent &&
        selectedAgent?.name !== "perplexity"
      ) {
        setSelectedAgent(perplexityAgent)
      } else if (
        !selectedAgent?.capabilities?.webSearch &&
        selectedAgent?.name !== "sushi"
      ) {
        setSelectedAgent(sushiAgent)
      }
    }

    setIsWebSearchEnabledInternal(value)
  }

  useEffect(() => {
    if (!user && !guest) return
    if (aiAgents?.length) {
      if (selectedAgent === null) return

      if (selectedAgent) {
        const currentAgent = aiAgents.find(
          (agent) => agent.name === selectedAgent.name,
        )
        setSelectedAgent(currentAgent)

        return
      }

      setSelectedAgent(undefined)
    }
  }, [aiAgents, selectedAgent, user, guest, setSelectedAgent])

  const [isAgentModalOpen, setIsAgentModalOpenInternal] = useState(false)

  const [isDebateAgentModalOpen, setIsDebateAgentModalOpenInternal] =
    useState(false)

  const setIsAgentModalOpen = (open: boolean) => {
    setIsAgentModalOpenInternal(open)
    if (!open) {
      setIsDebateAgentModalOpenInternal(false)
    }
    if (open)
      plausible({
        name: ANALYTICS_EVENTS.AGENT_MODAL,
        props: {},
      })
  }

  const setIsDebateAgentModalOpen = (open: boolean) => {
    setIsDebateAgentModalOpenInternal(open)
    setIsAgentModalOpenInternal(open)
    if (open)
      plausible({
        name: ANALYTICS_EVENTS.DEBATE_AGENT_MODAL,
        props: {},
      })
  }

  useEffect(() => {
    const a = aiAgents.find(
      (agent) =>
        app?.defaultModel &&
        app.onlyAgent &&
        agent.name.toLowerCase() === app?.defaultModel?.toLowerCase(),
    )
    if (!a) return

    setSelectedAgent(a)
    setDebateAgent(null)
  }, [app, aiAgents, setSelectedAgent, setDebateAgent])

  const fetchPendingCollaborationThreadsCount = useCallback(async () => {
    const threads = await actions.getThreads({
      pageSize: 1,
      myPendingCollaborations: true,
      appId: app?.id,
    })
    if (threads && threads.totalCount)
      setPendingCollaborationThreadsCount(threads.totalCount)
  }, [actions, app?.id])

  const [
    pendingCollaborationThreadsCount,
    setPendingCollaborationThreadsCount,
  ] = useState<number>(
    threads?.threads?.filter((t) =>
      t.collaborations?.some((c) => c.collaboration.status === "pending"),
    ).length || 0,
  )

  const setCollaborationStatus = useCallback(
    (newStatus: "pending" | "active" | undefined | null) => {
      if (newStatus === collaborationStatus) {
        return
      }
      setCollaborationStatusInternal(newStatus)
      fetchActiveCollaborationThreadsCount()
      fetchPendingCollaborationThreadsCount()
    },
    [
      collaborationStatus,
      fetchActiveCollaborationThreadsCount,
      fetchPendingCollaborationThreadsCount,
    ],
  )
  const isDebating = !!debateAgent

  const hitHourlyLimit = hourlyUsageLeft <= 0

  // Auto-refresh hourly limits when timer expires
  useEffect(() => {
    if (!hitHourlyLimit) return

    const lastMessage = user?.lastMessage || guest?.lastMessage
    if (!lastMessage?.createdOn) return

    const lastMessageTime = new Date(lastMessage.createdOn)
    const oneHourLater = new Date(lastMessageTime.getTime() + 60 * 60 * 1000)
    const now = new Date()

    if (now >= oneHourLater) {
      // Hour has already passed, reset immediately
      if (user) {
        setUser({ ...user, messagesLastHour: 0 })
      }
      if (guest) {
        setGuest({ ...guest, messagesLastHour: 0 })
      }
      return
    }

    // Set timer for when hour expires
    const timeUntilReset = oneHourLater.getTime() - now.getTime()
    const timer = setTimeout(() => {
      if (user) {
        setUser({ ...user, messagesLastHour: 0 })
      }
      if (guest) {
        setGuest({ ...guest, messagesLastHour: 0 })
      }
    }, timeUntilReset)

    return () => clearTimeout(timer)
  }, [
    hitHourlyLimit,
    user?.lastMessage?.createdOn,
    guest?.lastMessage?.createdOn,
    user,
    guest,
    setUser,
    setGuest,
  ])

  const setIsNewChat = useCallback(
    ({
      value,
      to = app?.slug ? getAppSlug(app) : "/",
      tribe,
    }: {
      value: boolean
      to?: string
      tribe?: boolean
    }) => {
      if (value) {
        setLiked(undefined)
        setShowFocus(false)
        setShowTribe(tribe === true)

        setCollaborationStep(0)
        setThread(undefined)
        setProfile(undefined)
        setStatus(null)
        if (burn) setWasIncognito(true)
        setCollaborationStatus(null)
        setIsChatFloating(false)
        setThreadId(undefined)
        setMessages([])
        threadIdRef.current = undefined
        router.push(to)
        refetchThreads()
      } else {
        // Ensure tribe view resets when closing a new chat
        setShowTribe(false)
      }

      setIsNewChatInternal(value)
    },
    [
      app,
      burn,
      getAppSlug,
      refetchThreads,
      router,
      setCollaborationStatus,
      setLiked,
      setProfile,
      setShowFocus,
      setShowTribe,
      setThread,
      setThreadId,
      threadIdRef,
    ],
  )

  useEffect(() => {
    if (toFetch) setIsNewChat({ value: false })
  }, [setIsNewChat, toFetch])

  const [nextPage, setNextPage] = useState<number | undefined>(undefined)

  const threadData = threadSWR || auth.threadData || undefined

  const shouldStopAutoScrollRef = useRef(false)

  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const { isUserScrolling, hasStoppedScrolling } = useUserScroll()

  const toFetchRef = useRef<boolean | null>(null)

  const scrollToBottom = useCallback(
    (timeout = isTauri ? 0 : 500, force = false) => {
      if (showFocus) setShowFocus(false)
      setTimeout(() => {
        if (!force)
          if (isEmpty || isUserScrolling || hasStoppedScrolling) return
        // Use requestAnimationFrame for more stable scrolling in Tauri
        requestAnimationFrame(() => {
          // In Tauri, use instant scroll instead of smooth to prevent hopping
          const behavior = isTauri ? "instant" : "smooth"
          window.scrollTo({
            top: document.body.scrollHeight,
            behavior: behavior as ScrollBehavior,
          })
          toFetchRef.current = null
        })
      }, timeout)
    },
    [
      hasStoppedScrolling,
      isEmpty,
      isTauri,
      isUserScrolling,
      setShowFocus,
      showFocus,
    ],
  )

  useEffect(() => {
    if (!toFetchRef.current) toFetchRef.current = !!toFetch
  }, [toFetch])

  const scrollToTop = (timeout = 0) => {
    setTimeout(() => {
      // Use requestAnimationFrame for more stable scrolling in Tauri
      requestAnimationFrame(() => {
        // In Tauri, use instant scroll instead of smooth to prevent hopping
        const behavior = isTauri ? "instant" : "smooth"
        window.scrollTo({
          top: 0,
          behavior: behavior as ScrollBehavior,
        })
      })
    }, timeout)
  }

  useEffect(() => {
    if (isLoading && error) setIsLoading(false)
  }, [error, isLoading])

  useEffect(() => {
    if (showFocus) {
      setThread(undefined)
      setMessages([])
    }
  }, [setThread, showFocus, toFetch])

  useEffect(() => {
    if (!toFetch && status) {
      setStatus(null)
      return
    }

    const serverMessages = threadData?.messages as paginatedMessages

    if (threadData?.thread && Array.isArray(serverMessages.messages)) {
      if (
        !isDebating &&
        !isStreaming &&
        !isStreamingStop &&
        (!threadIdRef.current ||
          (liked !== undefined &&
            serverMessages.messages.length !== messages.length) ||
          serverMessages.messages[0]?.thread?.id !== threadIdRef.current)
      ) {
        setMessages(serverMessages.messages)
      }

      setNextPage(threadData.messages.nextPage)
      setThread(threadData.thread)

      if (isNewChat) setStatus(null)

      if (
        threadData?.thread?.user &&
        threadData.thread.user.id !== user?.id &&
        !isNewChat
      )
        setProfile(threadData.thread.user)

      if (
        collaborationStatus !== "pending" &&
        !shouldStopAutoScrollRef.current &&
        !isLoadingMore &&
        !(isSmallDevice && isDrawerOpen) &&
        !isChatFloating
      )
        scrollToBottom(100)
    }
  }, [
    threadData,
    isLoadingMore,
    aiAgents,
    isStreaming,
    isStreamingStop,
    user,
    setSelectedAgent,
    isNewChat,
    liked,
    shouldStopAutoScrollRef,
    collaborationStatus,
    isSmallDevice,
    isDrawerOpen,
    isChatFloating,
    threadId,
    threadIdRef,
    messages,
    toFetch,
    status,
    isDebating,
    setThread,
    setProfile,
    scrollToBottom,
  ])

  return (
    <ChatContext.Provider
      value={{
        fetchActiveCollaborationThreadsCount,
        fetchPendingCollaborationThreadsCount,
        setIsNewAppChat,
        shouldFocus,
        setShouldFocus,
        placeHolderText,
        setPlaceHolderText,
        isImageGenerationEnabled,
        setIsImageGenerationEnabled,
        status,
        isLoadingMore,
        setIsLoadingMore,
        isLoading,
        shouldFetchThread,
        scrollToTop,
        setShouldFetchThread,
        refetchThread: async () => {
          setShouldFetchThread(true)
          await mutate()
        },
        setIsWebSearchEnabled,
        input,
        setIsAgentModalOpen,
        isAgentModalOpen,
        creditsLeft,
        aiAgents,
        setInput,
        placeHolder,
        setPlaceHolder,
        isChatFloating,
        setIsChatFloating,
        thread,
        setThread,
        threadId,
        until,
        liked,
        setLiked,
        error,
        setUntil,
        onlyAgent,
        isEmpty,
        scrollToBottom,
        isWebSearchEnabled,
        selectedAgent,
        setSelectedAgent: (agent: aiAgent | undefined | null) => {
          setSelectedAgent(agent)
          if (!isUserSelectedAgent) setIsUserSelectedAgent(true)
        },
        hitHourlyLimit,
        debateAgent,
        setDebateAgent,
        isDebating,
        hourlyLimit,
        hourlyUsageLeft,
        setCreditsLeft,
        claudeAgent,
        favouriteAgent,
        messages,
        setMessages,
        isAgentAuthorized,
        setIsDebateAgentModalOpen,
        isDebateAgentModalOpen,
        setIsAgentModalOpenInternal,
        nextPage,
        setNextPage,
        setIsNewChat,
        isNewChat,
        hasNotification,
        isLoadingThreads,
        setIsLoadingThreads,
        threads,
        setThreads,
        wasIncognito,
        setWasIncognito,
        burn,
        pendingCollaborationThreadsCount,
        activeCollaborationThreadsCount,
        setCollaborationStatus,
        collaborationStatus,
        collaborationStep,
        setCollaborationStep,
        isVisitor,
        setIsVisitor,
        refetchThreads: fetchThreads,
        userNameByUrl,
        shouldGetCredits,
        setShouldGetCredits,
        showTribe,
        setShowTribe,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error("useChat must be used within ChatProvider")
  }
  return context
}
