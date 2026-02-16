// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "@testing-library/react"

// Make React globally available
global.React = React

import Messages from "../Messages"
import {
  mockAuth,
  mockChat,
  mockApp,
  mockNavigation,
  mockPlatform,
  mockTheme,
  mockData,
  mockAppContext,
  mockStyles,
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
      <button {...props}>{children}</button>
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
vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: () => ({}),
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
  default: ({ message }: any) => (
    <div data-testid="message-item">{message.message.content}</div>
  ),
}))
vi.mock("../CharacterProfile", () => ({
  default: () => <div data-testid="character-profile" />,
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
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it("renders messages list", async () => {
    const messages = [
      {
        message: {
          id: "msg-1",
          content: "Hello",
          createdOn: new Date().toISOString(),
        },
      },
      {
        message: {
          id: "msg-2",
          content: "World",
          createdOn: new Date().toISOString(),
        },
      },
    ]

    await act(async () => {
      root.render(<Messages messages={messages as any} />)
    })

    const items = container.querySelectorAll("[data-testid='message-item']")
    expect(items.length).toBe(2)
    expect(items[0].textContent).toBe("Hello")
    expect(items[1].textContent).toBe("World")
  })

  it("renders empty state when no messages and showEmptyState is true", async () => {
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

  it("shows load more button when nextPage is present", async () => {
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
    expect(loadMoreBtn?.textContent).toContain("Load Older")

    await act(async () => {
      loadMoreBtn?.click()
    })

    expect(setIsLoadingMore).toHaveBeenCalledWith(true)
    expect(setUntil).toHaveBeenCalledWith(2)
  })
})
