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
  COLORS: {},
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
    // Mock primitive components
    Div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Button: ({ children, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    Span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    Video: ({ children, ...props }: any) => <video {...props}>{children}</video>,
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

// Mock sub-components
vi.mock("../Message", () => ({
  default: ({ message }: any) => (
    <div data-testid={`message-${message.message.id}`}>
      {message.message.content}
    </div>
  ),
}))

vi.mock("../Image", () => ({
  default: () => <div data-testid="img" />,
}))

vi.mock("../CharacterProfile", () => ({
  default: () => <div data-testid="character-profile" />,
}))

vi.mock("../icons", () => ({
  CircleX: () => <div />,
  Loader: () => <div />,
  Sparkles: () => <div />,
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
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it("renders empty state when no messages", async () => {
    await act(async () => {
      root.render(
        <Messages
          messages={[]}
          showEmptyState={true}
          emptyMessage="No messages yet"
        />,
      )
    })

    expect(container.textContent).toContain("No messages yet")
  })

  it("renders null when no messages and showEmptyState is false", async () => {
    await act(async () => {
      root.render(<Messages messages={[]} showEmptyState={false} />)
    })

    expect(container.innerHTML).toBe("")
  })

  it("renders list of messages", async () => {
    const messages = [
      {
        message: {
          id: "1",
          content: "Hello",
          createdOn: new Date().toISOString(),
        },
      },
      {
        message: {
          id: "2",
          content: "World",
          createdOn: new Date().toISOString(),
        },
      },
    ] as any

    await act(async () => {
      root.render(<Messages messages={messages} />)
    })

    expect(container.querySelector('[data-testid="message-1"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="message-2"]')).toBeTruthy()
  })

  it("sorts messages by date", async () => {
    const messages = [
      {
        message: {
          id: "2",
          content: "World",
          createdOn: new Date("2023-01-02").toISOString(),
        },
      },
      {
        message: {
          id: "1",
          content: "Hello",
          createdOn: new Date("2023-01-01").toISOString(),
        },
      },
    ] as any

    await act(async () => {
      root.render(<Messages messages={messages} />)
    })

    const messageElements = container.querySelectorAll('[data-testid^="message-"]')
    expect(messageElements[0].getAttribute("data-testid")).toBe("message-1")
    expect(messageElements[1].getAttribute("data-testid")).toBe("message-2")
  })

  it("shows load more button when nextPage exists", async () => {
    await act(async () => {
      root.render(
        <Messages
          messages={
            [
              {
                message: {
                  id: "1",
                  content: "Hi",
                  createdOn: new Date().toISOString(),
                },
              },
            ] as any
          }
          nextPage={2}
        />,
      )
    })

    expect(container.textContent).toContain("Load Older")
  })
})
