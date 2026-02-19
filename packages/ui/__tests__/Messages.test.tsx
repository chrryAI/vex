import { describe, it, expect, vi, beforeEach } from "vitest"
import React from "react"
import { render, screen } from "@testing-library/react"
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

// Mock dependencies
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

vi.mock("../platform", async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    usePlatform: () => mockPlatform,
    useTheme: () => mockTheme,
    Div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Button: ({ children, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    Video: ({ ...props }: any) => <video {...props} />,
  }
})

vi.mock("../context/StylesContext", () => ({
  useStyles: () => mockStyles,
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

// Mock Message component to inspect props
const MockMessage = vi.fn(({ isTyping, isOnline, message }: any) => (
  <div
    data-testid={`message-${message.message.id}`}
    data-typing={isTyping ? "true" : "false"}
    data-online={isOnline ? "true" : "false"}
  >
    {message.message.content}
  </div>
))

vi.mock("../Message", () => ({
  default: (props: any) => <MockMessage {...props} />,
}))

vi.mock("../Image", () => ({
  default: () => <div data-testid="image" />,
}))

vi.mock("../CharacterProfile", () => ({
  default: () => <div data-testid="character-profile" />,
}))

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

// Mock useThreadPresence
const mockTypingUsers = [
  { userId: "user-2", isTyping: true },
  { guestId: "guest-1", isTyping: true },
]
const mockOnlineUsers = [
  { userId: "user-3", isOnline: true },
]

vi.mock("../hooks/useThreadPresence", () => ({
  useThreadPresence: () => ({
    typingUsers: mockTypingUsers,
    onlineUsers: mockOnlineUsers,
  }),
}))

describe("Messages", () => {
  const mockMessages = [
    {
      message: {
        id: "msg-1",
        content: "Message from typing user",
        createdOn: new Date().toISOString(),
        threadId: "thread-1",
        role: "user",
      },
      user: { id: "user-2" }, // Matches typing user
    },
    {
      message: {
        id: "msg-2",
        content: "Message from online user",
        createdOn: new Date().toISOString(),
        threadId: "thread-1",
        role: "user",
      },
      user: { id: "user-3" }, // Matches online user
    },
    {
      message: {
        id: "msg-3",
        content: "Message from offline user",
        createdOn: new Date().toISOString(),
        threadId: "thread-1",
        role: "user",
      },
      user: { id: "user-4" }, // Matches no one
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders messages and passes correct presence props", () => {
    render(<Messages messages={mockMessages} />)

    // Check typing user message
    const msg1 = screen.getByTestId("message-msg-1")
    expect(msg1.getAttribute("data-typing")).toBe("true")
    // Typing user is not in online list in our mock (though usually typing implies online)
    expect(msg1.getAttribute("data-online")).toBe("false")

    // Check online user message
    const msg2 = screen.getByTestId("message-msg-2")
    expect(msg2.getAttribute("data-typing")).toBe("false")
    expect(msg2.getAttribute("data-online")).toBe("true")

    // Check offline user message
    const msg3 = screen.getByTestId("message-msg-3")
    expect(msg3.getAttribute("data-typing")).toBe("false")
    expect(msg3.getAttribute("data-online")).toBe("false")
  })
})
