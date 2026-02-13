// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "@testing-library/react"

// Make React globally available
global.React = React

import Message from "../Message"
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
    Video: ({ ...props }: any) => <video {...props} />,
  }
})

vi.mock("../context/StylesContext", () => ({
  useStyles: () => mockStyles,
}))

// Mock styles hook specifically for Message
vi.mock("../Message.styles", () => ({
  useMessageStyles: () => ({
    message: { style: {} },
    userMessageContainer: { style: {} },
    userMessage: { style: {} },
    name: { style: {} },
    presenceIndicator: { style: { backgroundColor: "grey" } },
    online: { style: { backgroundColor: "green" } },
    offline: { style: { backgroundColor: "grey" } },
    nameWithPresence: { style: {} },
    dots: { style: {} },
    dotsSpan: { style: {} },
    userMessageContent: { style: {} },
    userMessageImages: { style: {} },
    userMessageAudio: { style: {} },
    userMessageVideo: { style: {} },
    userMessageVideoVideo: { style: {} },
    userMessageFiles: { style: {} },
    footer: { style: {} },
    left: { style: {} },
    userMessageTime: { style: {} },
    likeButtons: { style: {} },
    userIcon: { style: {} },
    userImage: { style: {} },
    owner: { style: {} },
    agentMessageImageContainer: { style: {} },
    agentMessageImages: { style: {} },
    userMessageImage: { style: {} },
    downloadButton: { style: {} },
    updateModalDescription: { style: {} },
    updateModalDescriptionButton: { style: {} },
    messageContainer: { style: {} },
    agentIcon: { style: {} },
    agentMessageTime: { style: {} },
    appIcon: { style: {} },
    thinking: { style: {} },
    agentMessage: { style: {} },
    agentMessageContent: { style: {} },
    agentWebStreaming: { style: {} },
    webSearchResults: { style: {} },
    webSearchResultTitle: { style: {} },
    webSearchResultSnippet: { style: {} },
    agent: { style: {} },
    playButton: { style: {} },
    sparklesButton: { style: {} },
  }),
}))

// Mock other components used in Message
vi.mock("../MarkdownContent", () => ({
  default: () => <div data-testid="markdown-content" />,
}))
vi.mock("../Modal", () => ({
  default: ({ children, isModalOpen }: any) =>
    isModalOpen ? <div data-testid="modal">{children}</div> : null,
}))
vi.mock("../Loading", () => ({ default: () => <div data-testid="loading" /> }))
vi.mock("../ConfirmButton", () => ({
  default: ({ children, onConfirm }: any) => (
    <button onClick={onConfirm} data-testid="confirm-button">
      {children}
    </button>
  ),
}))
vi.mock("../Image", () => ({ default: () => <div data-testid="image" /> }))
vi.mock("../a/A", () => ({ default: ({ children }: any) => <a>{children}</a> }))

// Mock hooks
vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: () => ({}),
}))
vi.mock("../hooks/useThreadPresence", () => ({
  useThreadPresence: () => ({ typingUsers: [], onlineUsers: [] }),
}))
vi.mock("react-audio-play", () => ({
  AudioPlayer: () => <div data-testid="audio-player" />,
}))
vi.mock("../lib/speechLimits", () => ({
  checkSpeechLimits: () => ({ allowed: true }),
}))
vi.mock("../utils", async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    isOwner: () => false,
    apiFetch: vi.fn(),
    getInstructionConfig: () => ({}),
  }
})
vi.mock("../utils/formatTemplates", () => ({
  formatMessageTemplates: (content: string) => content,
  getCurrentTemplateContext: () => ({}),
}))

describe("Message Presence", () => {
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

  it("renders offline indicator by default", async () => {
    const message = {
      message: { id: "msg-1", content: "Test", createdOn: new Date().toISOString(), userId: "other-user" },
      user: { id: "other-user", name: "Other User" },
    }

    await act(async () => {
      root.render(<Message message={message as any} />)
    })

    // The presence indicator is inside the "name" span.
    const divs = container.querySelectorAll("div")
    const offlineDiv = Array.from(divs).find(
      (div) => div.style.backgroundColor === "grey"
    )
    expect(offlineDiv).toBeTruthy()
  })

  it("renders online indicator when isOnline is true", async () => {
    const message = {
      message: { id: "msg-1", content: "Test", createdOn: new Date().toISOString(), userId: "user-1" },
      user: { id: "user-1", name: "User 1" },
    }

    await act(async () => {
      root.render(<Message message={message as any} isOnline={true} />)
    })

    const divs = container.querySelectorAll("div")
    const onlineDiv = Array.from(divs).find(
      (div) => div.style.backgroundColor === "green"
    )
    expect(onlineDiv).toBeTruthy()
  })

  it("renders online indicator when isTyping is true", async () => {
    const message = {
      message: { id: "msg-1", content: "Test", createdOn: new Date().toISOString(), userId: "user-1" },
      user: { id: "user-1", name: "User 1" },
    }

    await act(async () => {
      root.render(<Message message={message as any} isTyping={true} />)
    })

    const divs = container.querySelectorAll("div")
    const onlineDiv = Array.from(divs).find(
      (div) => div.style.backgroundColor === "green"
    )
    expect(onlineDiv).toBeTruthy()

    const typingIndicator = container.querySelector("[data-testid='typing-indicator']")
    expect(typingIndicator).toBeTruthy()
  })
})
