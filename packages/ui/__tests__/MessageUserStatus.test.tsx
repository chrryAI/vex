// @vitest-environment happy-dom

import { render } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"
import MessageUserStatus from "../MessageUserStatus"

// Mock dependencies
vi.mock("../context/AppContext", () => ({
  useAppContext: () => ({ t: (key: string) => key }),
}))

vi.mock("../context/providers", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    guest: null,
  }),
}))

vi.mock("../Message.styles", () => ({
  useMessageStyles: () => ({
    name: { style: {} },
    presenceIndicator: { style: {} },
    online: { style: {} },
    offline: { style: {} },
    nameWithPresence: { style: {} },
    dots: { style: {} },
    dotsSpan: { style: {} },
  }),
}))

vi.mock("../hooks/useThreadPresence", () => ({
  useThreadPresence: () => ({
    typingUsers: [],
    onlineUsers: [],
  }),
}))

vi.mock("../utils", () => ({
  isOwner: (message: any, { userId }: any) => message.userId === userId,
}))

// Mock platform components to avoid context errors
vi.mock("../platform", () => ({
  Div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

describe("MessageUserStatus", () => {
  it("renders user name correctly", () => {
    const message = {
      message: {
        id: "msg-1",
        threadId: "thread-1",
        content: "Hello",
      },
      user: {
        id: "user-2",
        name: "Alice",
      },
    }

    const { getByText } = render(<MessageUserStatus message={message as any} />)
    expect(getByText("Alice")).toBeTruthy()
  })

  it("renders 'You' if owner", () => {
    const message = {
      message: {
        id: "msg-1",
        threadId: "thread-1",
        content: "Hello",
        userId: "user-1", // Matches mocked user.id
      },
      user: {
        id: "user-1",
        name: "Bob",
      },
    }

    const { getByText } = render(<MessageUserStatus message={message as any} />)
    expect(getByText("You")).toBeTruthy()
  })
})
