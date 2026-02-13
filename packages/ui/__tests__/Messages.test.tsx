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
  }
})

vi.mock("../context/StylesContext", () => ({
  useStyles: () => mockStyles,
}))

// Mock Message component to inspect props
vi.mock("../Message", () => ({
  default: ({ isTyping, isOnline, message }: any) => (
    <div
      data-testid={`message-${message.message.id}`}
      data-is-typing={isTyping}
      data-is-online={isOnline}
    >
      {message.message.content}
    </div>
  ),
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

// Mock ThreadPresence to control typing/online status
let mockTypingUsers: any[] = []
let mockOnlineUsers: any[] = []

vi.mock("../hooks/useThreadPresence", () => ({
  useThreadPresence: () => ({
    typingUsers: mockTypingUsers,
    onlineUsers: mockOnlineUsers,
    notifyTyping: vi.fn(),
  }),
}))

// Mock other UI components
vi.mock("../CharacterProfile", () => ({
  default: () => <div data-testid="character-profile" />,
}))
vi.mock("../Image", () => ({ default: () => <div data-testid="image" /> }))
vi.mock("../icons", () => ({
  CircleX: () => <svg data-testid="icon-circle-x" />,
  Loader: () => <svg data-testid="icon-loader" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
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
    mockTypingUsers = []
    mockOnlineUsers = []
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
        message: { id: "msg-1", content: "Hello", createdOn: new Date().toISOString() },
        user: { id: "user-1", name: "User 1" },
      },
      {
        message: { id: "msg-2", content: "Hi there", createdOn: new Date().toISOString() },
        user: { id: "user-2", name: "User 2" },
      },
    ]

    await act(async () => {
      root.render(<Messages messages={messages as any} />)
    })

    expect(container.querySelector("[data-testid='message-msg-1']")).toBeTruthy()
    expect(container.querySelector("[data-testid='message-msg-2']")).toBeTruthy()
  })

  it("passes isTyping=true to correct message when user is typing", async () => {
    const messages = [
      {
        message: { id: "msg-1", content: "Typing User Msg", createdOn: new Date().toISOString() },
        user: { id: "user-typing", name: "Typing User" },
      },
      {
        message: { id: "msg-2", content: "Other User Msg", createdOn: new Date().toISOString() },
        user: { id: "user-other", name: "Other User" },
      },
    ]

    // Mock that "user-typing" is currently typing
    mockTypingUsers = [{ userId: "user-typing" }]

    await act(async () => {
      root.render(<Messages messages={messages as any} />)
    })

    const msg1 = container.querySelector("[data-testid='message-msg-1']")
    const msg2 = container.querySelector("[data-testid='message-msg-2']")

    expect(msg1?.getAttribute("data-is-typing")).toBe("true")
    expect(msg2?.getAttribute("data-is-typing")).toBe("false")
  })

  it("passes isOnline=true to correct message when user is online", async () => {
    const messages = [
      {
        message: { id: "msg-1", content: "Online User Msg", createdOn: new Date().toISOString() },
        user: { id: "user-online", name: "Online User" },
      },
      {
        message: { id: "msg-2", content: "Offline User Msg", createdOn: new Date().toISOString() },
        user: { id: "user-offline", name: "Offline User" },
      },
    ]

    // Mock that "user-online" is currently online
    mockOnlineUsers = [{ userId: "user-online" }]

    await act(async () => {
      root.render(<Messages messages={messages as any} />)
    })

    const msg1 = container.querySelector("[data-testid='message-msg-1']")
    const msg2 = container.querySelector("[data-testid='message-msg-2']")

    expect(msg1?.getAttribute("data-is-online")).toBe("true")
    expect(msg2?.getAttribute("data-is-online")).toBe("false")
  })

  it("handles guest typing status correctly", async () => {
    const messages = [
      {
        message: { id: "msg-guest", content: "Guest Msg", createdOn: new Date().toISOString() },
        guest: { id: "guest-typing", name: "Guest User" },
      },
    ]

    mockTypingUsers = [{ guestId: "guest-typing" }]

    await act(async () => {
        root.render(<Messages messages={messages as any} />)
    })

    const msgGuest = container.querySelector("[data-testid='message-msg-guest']")
    expect(msgGuest?.getAttribute("data-is-typing")).toBe("true")
  })
})
