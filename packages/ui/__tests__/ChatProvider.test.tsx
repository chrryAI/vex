// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import React, { useContext } from "react"
import { render, act, renderHook } from "@testing-library/react"
import { ChatProvider, useChat } from "../context/providers/ChatProvider"

// Mock dependencies
vi.mock("../context/providers/AuthProvider", () => ({
  useAuth: () => ({
    threadData: { messages: { messages: [] } },
    aiAgents: [],
    storeApps: [],
    threads: { threads: [] },
    hasStoreApps: vi.fn(),
    setHasNotification: vi.fn(),
    setLoadingApp: vi.fn(),
    setWasIncognito: vi.fn(),
    setThread: vi.fn(),
    setProfile: vi.fn(),
    setStatus: vi.fn(),
    setCollaborationStatus: vi.fn(),
    setIsChatFloating: vi.fn(),
    setThreadId: vi.fn(),
    setMessages: vi.fn(),
    threadIdRef: { current: null },
    migratedFromGuestRef: { current: false },
    fetchSession: vi.fn(),
    refetchThreads: vi.fn(),
    storeAppsSwr: {},
    app: { id: "test-app" },
    user: { id: "user-1" },
    session: {},
    setCreditsLeft: vi.fn(),
    setShouldGetCredits: vi.fn(),
    setShowTribe: vi.fn(),
  }),
}))

vi.mock("../context/providers/DataProvider", () => ({
  useData: () => ({
    actions: {
      getThreads: vi.fn().mockResolvedValue({ threads: [], totalCount: 0 }),
      getThread: vi.fn().mockResolvedValue({ thread: {}, messages: {} }),
      getUser: vi.fn().mockResolvedValue({}),
      getGuest: vi.fn().mockResolvedValue({}),
    },
    isDevelopment: false,
    isE2E: false,
  }),
}))

vi.mock("../context/providers/AppProvider", () => ({
  useApp: () => ({
    appStatus: {},
    setIsSavingApp: vi.fn(),
    setIsManagingApp: vi.fn(),
  }),
}))

vi.mock("../context/providers/ErrorProvider", () => ({
  useError: () => ({
    captureException: vi.fn(),
  }),
}))

vi.mock("../platform", () => ({
  useNavigation: () => ({
    pathname: "/",
    searchParams: new URLSearchParams(),
    addParams: vi.fn(),
    removeParams: vi.fn(),
    push: vi.fn(),
  }),
  usePlatform: () => ({
    isExtension: false,
    isMobile: false,
    isTauri: false,
    isCapacitor: false,
  }),
  useTheme: () => ({
    isSmallDevice: false,
    isDrawerOpen: false,
    playNotification: vi.fn(),
  }),
  useLocalStorage: (key: string, initial: any) => {
    const [val, setVal] = React.useState(initial)
    return [val, setVal]
  },
}))

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    notifyPresence: vi.fn(),
    connected: true,
  }),
}))

vi.mock("../hooks/useUserScroll", () => ({
  useUserScroll: () => ({
    isUserScrolling: false,
    hasStoppedScrolling: false,
  }),
}))

// Mock SWR
const mutateMock = vi.fn()
vi.mock("swr", () => ({
  default: () => ({
    data: null,
    mutate: mutateMock,
    error: null,
    isLoading: false,
  }),
}))

describe("ChatProvider", () => {
  it("provides refetchThread and scrollToBottom", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ChatProvider>{children}</ChatProvider>
    )

    const { result } = renderHook(() => useChat(), { wrapper })

    expect(result.current.refetchThread).toBeDefined()
    expect(result.current.scrollToBottom).toBeDefined()

    // Test refetchThread calling mutate
    await act(async () => {
      await result.current.refetchThread()
    })
    expect(mutateMock).toHaveBeenCalled()

    // Test scrollToBottom (hard to test side effect without full DOM, but ensure no error)
    await act(async () => {
      result.current.scrollToBottom()
    })
  })
})
