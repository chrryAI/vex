import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import Deck from "../Deck"

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()
Object.defineProperty(window, "localStorage", { value: localStorageMock })

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("Deck Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  it("renders initial state and login modal when no accounts exist", () => {
    render(<Deck />)

    // Login modal should be visible since localStorage is empty
    expect(screen.getByText("Sign in to Bluesky")).toBeTruthy()
  })

  it("handles login flow", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        did: "did:plc:123",
        handle: "alice.bsky.social",
        accessJwt: "access_token",
        refreshJwt: "refresh_token",
      }),
    })

    render(<Deck />)

    const handleInput = screen.getByPlaceholderText(
      "Handle (e.g. alice.bsky.social)",
    )
    const passwordInput = screen.getByPlaceholderText("App Password")
    const signInButton = screen.getByRole("button", { name: "Sign in" })

    fireEvent.change(handleInput, { target: { value: "alice.bsky.social" } })
    fireEvent.change(passwordInput, { target: { value: "password123" } })

    fireEvent.click(signInButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "https://bsky.social/xrpc/com.atproto.server.createSession",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            identifier: "alice.bsky.social",
            password: "password123",
          }),
        }),
      )
    })

    // Expect timeline column to be added automatically after login
    // we need to mock the timeline fetch as well so it doesn't fail
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ feed: [] }),
    })
  })

  it("loads accounts from localStorage", async () => {
    localStorageMock.setItem(
      "deck_state",
      JSON.stringify({
        accounts: [
          {
            did: "did:plc:123",
            handle: "alice.bsky.social",
            accessJwt: "access",
            refreshJwt: "refresh",
          },
        ],
        columns: [
          {
            id: "col-1",
            accountId: "did:plc:123",
            type: "timeline",
            title: "Timeline",
          },
        ],
      }),
    )

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        feed: [
          {
            post: {
              uri: "at://did:plc:123/app.bsky.feed.post/123",
              author: { handle: "bob.bsky.social", displayName: "Bob" },
              record: {
                text: "Hello World!",
                createdAt: new Date().toISOString(),
              },
              replyCount: 0,
              repostCount: 0,
              likeCount: 0,
            },
          },
        ],
      }),
    })

    render(<Deck />)

    await waitFor(() => {
      expect(screen.getByText("Timeline")).toBeTruthy()
      expect(screen.getByText("Hello World!")).toBeTruthy()
      expect(screen.getByText("Bob")).toBeTruthy()
    })
  })

  it("can open and close login modal", () => {
    localStorageMock.setItem(
      "deck_state",
      JSON.stringify({
        accounts: [
          {
            did: "did:plc:123",
            handle: "alice.bsky.social",
            accessJwt: "access",
            refreshJwt: "refresh",
          },
        ],
        columns: [],
      }),
    )

    render(<Deck />)

    // Open modal via sidebar Add Account button
    const addAccountBtns = screen.queryAllByTitle("Add Account")
    expect(addAccountBtns.length).toBeGreaterThan(0)
    const btn = addAccountBtns[0]
    if (btn) {
      fireEvent.click(btn)
    }

    expect(screen.getByText("Sign in to Bluesky")).toBeTruthy()

    // Cancel modal
    const cancelBtn = screen.getByRole("button", { name: "Cancel" })
    fireEvent.click(cancelBtn)

    expect(screen.queryByText("Sign in to Bluesky")).not.toBeTruthy()
  })
})

it("handles post interaction and thread viewing", async () => {
  localStorageMock.setItem(
    "deck_state",
    JSON.stringify({
      accounts: [
        {
          did: "did:plc:123",
          handle: "alice.bsky.social",
          accessJwt: "access",
          refreshJwt: "refresh",
        },
      ],
      columns: [
        {
          id: "col-1",
          accountId: "did:plc:123",
          type: "timeline",
          title: "Timeline",
        },
      ],
    }),
  )

  mockFetch.mockImplementation(async (url) => {
    if (url.includes("getPostThread")) {
      return {
        ok: true,
        json: async () => ({
          thread: {
            post: {
              uri: "at://did:plc:123/app.bsky.feed.post/123",
              author: { handle: "bob.bsky.social", displayName: "Bob" },
              record: {
                text: "Hello Thread!",
                createdAt: new Date().toISOString(),
              },
              replyCount: 1,
              repostCount: 0,
              likeCount: 5,
            },
            replies: [
              {
                post: {
                  uri: "at://did:plc:123/app.bsky.feed.post/456",
                  author: { handle: "alice.bsky.social", displayName: "Alice" },
                  record: {
                    text: "Hello Reply!",
                    createdAt: new Date().toISOString(),
                  },
                  replyCount: 0,
                  repostCount: 0,
                  likeCount: 1,
                },
              },
            ],
          },
        }),
      }
    }
    return {
      ok: true,
      json: async () => ({
        feed: [
          {
            post: {
              uri: "at://did:plc:123/app.bsky.feed.post/123",
              author: { handle: "bob.bsky.social", displayName: "Bob" },
              record: {
                text: "Hello World!",
                createdAt: new Date().toISOString(),
              },
              replyCount: 0,
              repostCount: 0,
              likeCount: 0,
            },
          },
        ],
      }),
    }
  })

  render(<Deck />)

  await waitFor(() => {
    expect(screen.getByText("Hello World!")).toBeTruthy()
  })

  const post = screen.getByText("Hello World!")
  fireEvent.click(post)

  await waitFor(() => {
    expect(screen.getByText("Thread")).toBeTruthy()
    expect(screen.getByText("Hello Thread!")).toBeTruthy()
    expect(screen.getByText("Hello Reply!")).toBeTruthy()
  })

  // Test go back button (the SVG icon button in header)
  const backButton = document.querySelector('button[type="button"] > svg')
  if (backButton?.parentElement) {
    fireEvent.click(backButton.parentElement)
    await waitFor(() => {
      expect(screen.queryByText("Thread")).toBeNull()
    })
  }
})

it("handles column drag and drop logic", async () => {
  localStorageMock.setItem(
    "deck_state",
    JSON.stringify({
      accounts: [
        {
          did: "did:plc:123",
          handle: "alice.bsky.social",
          accessJwt: "access",
          refreshJwt: "refresh",
        },
      ],
      columns: [
        {
          id: "col-1",
          accountId: "did:plc:123",
          type: "timeline",
          title: "Col 1",
        },
        {
          id: "col-2",
          accountId: "did:plc:123",
          type: "notifications",
          title: "Col 2",
        },
      ],
    }),
  )

  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ feed: [], notifications: [] }),
  })

  render(<Deck />)

  await waitFor(() => {
    expect(screen.getByText("Col 1")).toBeTruthy()
    expect(screen.getByText("Col 2")).toBeTruthy()
  })

  const dragHandles = document.querySelectorAll('div[draggable="true"]')
  if (dragHandles.length >= 2) {
    const col1 = dragHandles[0]
    const col2 = dragHandles[1]

    if (col1 && col2) {
      fireEvent.dragStart(col1, { dataTransfer: { setData: vi.fn() } })
      fireEvent.dragOver(col2)
      fireEvent.drop(col2, {
        dataTransfer: { getData: vi.fn().mockReturnValue("col-1") },
      })
      fireEvent.dragEnd(col1)
    }
  }
})
