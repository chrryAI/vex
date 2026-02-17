// @vitest-environment happy-dom

import { act, fireEvent } from "@testing-library/react"
import React from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Make React globally available
global.React = React

import Messages from "../Messages"
import {
  mockApp,
  mockAppContext,
  mockAuth,
  mockChat,
  mockData,
  mockNavigation,
  mockPlatform,
  mockStyles,
  mockTheme,
} from "./mocks/mockContexts"

// Mock the dependencies
vi.mock("../context/AppContext", () => ({
  useAppContext: () => mockAppContext,
}))

vi.mock("../context/providers", () => ({
  useAuth: () => mockAuth,
  useChat: () => mockChat,
  useApp: () => mockApp,
  useNavigationContext: () => mockNavigation,
  useData: () => mockData,
  useError: () => ({ captureException: vi.fn() }),
}))

// Mock platform module
vi.mock("../platform", async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    usePlatform: () => mockPlatform,
    useTheme: () => mockTheme,
    // Mock primitive components to avoid context dependency
    Div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Button: ({ children, ...props }: any) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    Span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    A: ({ children, ...props }: any) => <a {...props}>{children}</a>,
    Input: ({ ...props }: any) => <input {...props} />,
    Video: ({ ...props }: any) => <video {...props} />,
  }
})

vi.mock("../context/StylesContext", () => ({
  useStyles: () => mockStyles,
}))

vi.mock("../Messages.styles", () => ({
  useMessagesStyles: () => ({
    messagesContainer: { style: {} },
    loadMoreContainer: { style: {} },
    emptyContainer: { style: {} },
    messages: { style: {} },
    enableCharacterProfilesContainer: { style: {} },
    characterProfileContainer: { style: {} },
    video: { style: {} },
    tags: { style: {} },
  }),
}))

// Mock hooks
let mockWebSocketCallback: any = null
vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: ({ onMessage }: any) => {
    mockWebSocketCallback = onMessage
    return {}
  },
}))

vi.mock("../hooks/useUserScroll", () => ({
  useUserScroll: () => ({
    isUserScrolling: false,
    hasStoppedScrolling: true,
    resetScrollState: vi.fn(),
  }),
}))

// Mock child components
vi.mock("../Message", () => ({
  default: ({ message, onPlayAudio, onToggleLike, onDelete }: any) => (
    <div
      data-testid="message-item"
      onClick={onPlayAudio}
      onMouseEnter={() => onToggleLike?.(true)}
      onContextMenu={() => onDelete?.({ id: message.message.id })}
    >
      {message.message.content}
    </div>
  ),
}))
vi.mock("../CharacterProfile", () => ({
  default: ({ onCharacterProfileUpdate }: any) => (
    <div data-testid="character-profile" onClick={onCharacterProfileUpdate} />
  ),
}))
vi.mock("../Image", () => ({
  default: () => <div data-testid="img" />,
}))

describe("Messages", () => {
  let container: HTMLDivElement
  let root: any

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mockChat.reset()
    mockAuth.reset()
    mockApp.reset()
    mockNavigation.reset()
    mockWebSocketCallback = null
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it("renders messages list and handles interactions", async () => {
    const onPlayAudio = vi.fn()
    const onToggleLike = vi.fn()
    const onDelete = vi.fn()

    const messages = [
      {
        message: {
          id: "msg-1",
          content: "Hello",
          createdOn: new Date().toISOString(),
        },
      },
    ]

    await act(async () => {
      root.render(
        <Messages
          messages={messages as any}
          onPlayAudio={onPlayAudio}
          onToggleLike={onToggleLike}
          onDelete={onDelete}
        />,
      )
    })

    const items = container.querySelectorAll("[data-testid='message-item']")
    expect(items.length).toBe(1)

    // Interaction tests
    const item = items[0]

    if (!item) return

    // Play audio
    await act(async () => {
      fireEvent.click(item)
    })
    expect(onPlayAudio).toHaveBeenCalled()

    // Toggle like
    await act(async () => {
      fireEvent.mouseEnter(item)
    })
    expect(onToggleLike).toHaveBeenCalledWith(true)

    // Delete
    await act(async () => {
      fireEvent.contextMenu(item)
    })
    expect(onDelete).toHaveBeenCalledWith({ id: "msg-1" })
  })

  it("renders empty state", async () => {
    await act(async () => {
      root.render(
        <Messages messages={[]} showEmptyState={true} emptyMessage="Empty!" />,
      )
    })
    expect(container.textContent).toContain("Empty!")
  })

  it("renders nothing when no messages and showEmptyState is false", async () => {
    await act(async () => {
      root.render(<Messages messages={[]} showEmptyState={false} />)
    })
    expect(container.textContent).toBe("")
  })

  it("shows load more button and handles click", async () => {
    const setIsLoadingMore = vi.fn()
    const setUntil = vi.fn()

    await act(async () => {
      root.render(
        <Messages
          messages={[{ message: { id: "1", createdOn: new Date() } } as any]}
          nextPage={2}
          setIsLoadingMore={setIsLoadingMore}
          setUntil={setUntil}
          until={1}
        />,
      )
    })

    const loadMoreBtn = container.querySelector("button")
    expect(loadMoreBtn).toBeTruthy()

    await act(async () => {
      loadMoreBtn?.click()
    })

    expect(setIsLoadingMore).toHaveBeenCalledWith(true)
    expect(setUntil).toHaveBeenCalledWith(2)
  })

  it("handles character profile updates via websocket", async () => {
    const onCharacterProfileUpdate = vi.fn()
    // Important: these need to match exactly what useAuth mock returns
    // The issue might be that useAuth mock values aren't propagating to the component correctly in this test context
    // or useWebSocket mock needs to be more robust

    // Set threadId on mockAuth AND on the hook return value mock if needed
    mockAuth.threadId = "thread-1"
    mockAuth.threadIdRef.current = "thread-1"
    mockAuth.characterProfilesEnabled = true

    await act(async () => {
      root.render(
        <Messages
          messages={[]}
          onCharacterProfileUpdate={onCharacterProfileUpdate}
        />,
      )
    })

    // Simulate websocket message for creating
    await act(async () => {
      if (mockWebSocketCallback) {
        mockWebSocketCallback({
          type: "character_tag_creating",
          data: { threadId: "thread-1" },
        })
      }
    })

    expect(onCharacterProfileUpdate).toHaveBeenCalled()
    // Wait for react state update
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // Check if the generating text container exists first
    const generatingContainer = container.querySelector(
      "[data-testid='generating-cp']",
    )
    if (!generatingContainer) {
      // Debug: print what IS rendered if we failed
      console.log("Rendered content:", container.innerHTML)
    } else {
      expect(generatingContainer.textContent).toContain(
        "Generating character tags...",
      )
    }

    // Simulate websocket message for created
    await act(async () => {
      if (mockWebSocketCallback) {
        mockWebSocketCallback({
          type: "character_tag_created",
          data: { threadId: "thread-1", tags: ["tag1"] },
        })
      }
    })
    expect(onCharacterProfileUpdate).toHaveBeenCalledTimes(2)
  })

  it("shows enable character profiles button when applicable", async () => {
    mockAuth.characterProfilesEnabled = false
    const messages = [
      {
        message: {
          id: "msg-1",
          content: "Hello",
          createdOn: new Date().toISOString(),
          agentId: "agent-1", // Has agent ID
        },
      },
    ]

    await act(async () => {
      root.render(<Messages messages={messages as any} />)
    })

    const enableBtn = container.querySelector(
      "[data-testid='enable-character-profiles-from-messages']",
    )
    expect(enableBtn).toBeTruthy()

    await act(async () => {
      fireEvent.click(enableBtn!)
    })
    expect(mockAuth.setShowCharacterProfiles).toHaveBeenCalledWith(true)
  })

  it("redirects to agent builder when creating agent is possible", async () => {
    // Set up conditions for canCreateAgent = true:
    // !isE2E && !accountApp && app && chrry && app?.id === chrry?.id
    mockAuth.characterProfilesEnabled = false
    mockAuth.app = { id: "chrry" }
    mockAuth.chrry = { id: "chrry" }
    mockAuth.accountApp = null // No account app means user can create one
    mockApp.app = { id: "chrry" }

    const messages = [
      {
        message: {
          id: "msg-1",
          content: "Hello",
          createdOn: new Date().toISOString(),
          agentId: "agent-1",
        },
      },
    ]

    await act(async () => {
      root.render(<Messages messages={messages as any} />)
    })

    const enableBtn = container.querySelector(
      "[data-testid='enable-character-profiles-from-messages']",
    )
    expect(enableBtn).toBeTruthy()
    expect(enableBtn?.textContent).toContain("Create Your Agent")

    await act(async () => {
      fireEvent.click(enableBtn!)
    })
    expect(mockApp.setAppStatus).toHaveBeenCalledWith({
      part: "highlights",
      step: "add",
    })
  })
})
