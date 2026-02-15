import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import React from "react"
import { render, screen } from "@testing-library/react"
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

// Extend mockAuth with timeAgo
const extendedMockAuth = {
  ...mockAuth,
  timeAgo: vi.fn().mockReturnValue("just now"),
}

// Mock the dependencies
vi.mock("../context/AppContext", () => ({
  useAppContext: () => mockAppContext,
  COLORS: {},
}))

vi.mock("../context/providers", () => ({
  useAuth: () => extendedMockAuth,
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
    Span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    A: ({ children, ...props }: any) => <a {...props}>{children}</a>,
    Img: ({ ...props }: any) => <img {...props} />,
    Video: ({ ...props }: any) => <video {...props} />,
  }
})

vi.mock("../context/StylesContext", () => ({
  useStyles: () => mockStyles,
  useMessageStyles: () => ({
    message: { style: {} },
    userMessageContainer: { style: {} },
    owner: { style: {} },
    userIcon: { style: {} },
    userMessageTime: { style: {} },
    userImage: { style: {} },
    userMessage: { style: {} },
    name: { style: {} },
    presenceIndicator: { style: {} },
    online: { style: { backgroundColor: "green" } },
    offline: { style: { backgroundColor: "grey" } },
    nameWithPresence: { style: {} },
    dots: { style: {} },
    dotsSpan: { style: {} },
    userMessageContent: { style: {} },
    footer: { style: {} },
    left: { style: {} },
    likeButtons: { style: {} },
    agentMessage: { style: {} },
    messageContainer: { style: {} },
    agentIcon: { style: {} },
    agentMessageTime: { style: {} },
    appIcon: { style: {} },
    thinking: { style: {} },
    agentMessageContent: { style: {} },
    agentWebStreaming: { style: {} },
    webSearchResults: { style: {} },
    webSearchResultTitle: { style: {} },
    webSearchResultSnippet: { style: {} },
    agent: { style: {} },
    playButton: { style: {} },
    sparklesButton: { style: {} },
    agentMessageImages: { style: {} },
    agentMessageImageContainer: { style: {} },
    downloadButton: { style: {} },
    updateModalDescription: { style: {} },
    updateModalDescriptionButton: { style: {} },
  }),
}))

vi.mock("../MarkdownContent", () => ({
  default: ({ content }: any) => <div data-testid="markdown-content">{content}</div>,
}))

vi.mock("../Modal", () => ({
  default: ({ children, isModalOpen }: any) => isModalOpen ? <div data-testid="modal">{children}</div> : null,
}))

vi.mock("../Image", () => ({
  default: (props: any) => <img data-testid="custom-image" {...props} />,
}))

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: () => ({}),
}))

// Mock icons
vi.mock("../icons", () => ({
  Download: () => <svg data-testid="icon-download" />,
  Globe: () => <svg data-testid="icon-globe" />,
  ThumbsUp: () => <svg data-testid="icon-thumbs-up" />,
  ThumbsDown: () => <svg data-testid="icon-thumbs-down" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  VolumeX: () => <svg data-testid="icon-volume-x" />,
  Play: () => <svg data-testid="icon-play" />,
  FileText: () => <svg data-testid="icon-file-text" />,
  LogIn: () => <svg data-testid="icon-log-in" />,
  Coins: () => <svg data-testid="icon-coins" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  Check: () => <svg data-testid="icon-check" />,
  Copy: () => <svg data-testid="icon-copy" />,
  Claude: () => <svg data-testid="icon-claude" />,
  DeepSeek: () => <svg data-testid="icon-deepseek" />,
  Flux: () => <svg data-testid="icon-flux" />,
  Gemini: () => <svg data-testid="icon-gemini" />,
  OpenAI: () => <svg data-testid="icon-openai" />,
  Perplexity: () => <svg data-testid="icon-perplexity" />,
}))

describe("Message", () => {
  const mockMessage = {
    message: {
      id: "msg-1",
      content: "Hello world",
      createdOn: new Date().toISOString(),
      threadId: "thread-1",
      role: "user",
      userId: "user-2",
    },
    user: {
      id: "user-2",
      name: "Test User",
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders user message correctly", () => {
    render(<Message message={mockMessage} />)
    expect(screen.getByText("Test User")).toBeTruthy()
    expect(screen.getByTestId("markdown-content")).toBeTruthy()
  })

  it("shows typing indicator when isTyping is true", () => {
    render(<Message message={mockMessage} isTyping={true} />)
    expect(screen.getByTestId("typing-indicator")).toBeTruthy()
  })

  it("does not show typing indicator when isTyping is false", () => {
    render(<Message message={mockMessage} isTyping={false} />)
    expect(screen.queryByTestId("typing-indicator")).toBeNull()
  })
})
