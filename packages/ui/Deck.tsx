import type React from "react"
import { useCallback, useEffect, useState } from "react"

// --- Types ---
interface BskyAccount {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
  avatar?: string
  displayName?: string
}

interface ColumnDef {
  id: string
  accountId: string // The DID of the account
  type: "timeline" | "notifications" | "profile"
  title: string
  path?: string[] // For drill-down navigation history within a column
}

interface AppState {
  accounts: BskyAccount[]
  columns: ColumnDef[]
}

// --- Icons (Inline SVG) ---
const HomeIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
)
const BellIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
)
const UserIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
)
const SettingsIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
)
const DragHandleIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="19" r="1" />
  </svg>
)
const TrashIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)
const ReplyIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
)
const RepostIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M17 2.1l4 4-4 4" />
    <path d="M3 12.2v-2a4 4 0 0 1 4-4h13.8" />
    <path d="M7 21.9l-4-4 4-4" />
    <path d="M21 11.8v2a4 4 0 0 1-4 4H3.2" />
  </svg>
)
const HeartIcon = ({ filled = false }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? "#e0245e" : "none"}
    stroke={filled ? "#e0245e" : "currentColor"}
    strokeWidth="2"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)
const ArrowLeftIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
)

// --- Styles ---
const theme = {
  bg: "#15202b",
  bgPanel: "#192734",
  bgHover: "#22303c",
  border: "#38444d",
  text: "#ffffff",
  textMuted: "#8899a6",
  accent: "#1da1f2",
  accentHover: "#1a91da",
  danger: "#e0245e",
}

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    backgroundColor: theme.bg,
    color: theme.text,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    overflow: "hidden",
  },
  sidebar: {
    width: "68px",
    backgroundColor: theme.bgPanel,
    borderRight: `1px solid ${theme.border}`,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "16px 0",
    zIndex: 10,
  },
  sidebarIcon: {
    width: "40px",
    height: "40px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "50%",
    color: theme.text,
    marginBottom: "16px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  deckContainer: {
    display: "flex",
    flex: 1,
    overflowX: "auto" as const,
    overflowY: "hidden" as const,
    padding: "16px",
    gap: "16px",
  },
  column: {
    width: "350px",
    minWidth: "350px",
    backgroundColor: theme.bgPanel,
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column" as const,
    border: `1px solid ${theme.border}`,
    overflow: "hidden",
  },
  columnHeader: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: `1px solid ${theme.border}`,
    cursor: "grab",
    backgroundColor: theme.bgPanel,
    userSelect: "none" as const,
    position: "sticky" as const,
    top: 0,
    zIndex: 5,
  },
  columnHeaderTitle: {
    flex: 1,
    fontWeight: "bold",
    fontSize: "16px",
    marginLeft: "8px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  columnHeaderAccount: {
    fontSize: "12px",
    color: theme.textMuted,
    fontWeight: "normal",
  },
  columnBody: {
    flex: 1,
    overflowY: "auto" as const,
    position: "relative" as const,
  },
  post: {
    padding: "12px 16px",
    borderBottom: `1px solid ${theme.border}`,
    display: "flex",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  postHover: {
    backgroundColor: theme.bgHover,
  },
  avatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    marginRight: "12px",
    backgroundColor: theme.border, // fallback
    objectFit: "cover" as const,
  },
  postContent: {
    flex: 1,
    minWidth: 0,
  },
  postHeader: {
    display: "flex",
    alignItems: "baseline",
    marginBottom: "4px",
    gap: "4px",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  displayName: {
    fontWeight: "bold",
    color: theme.text,
  },
  handle: {
    color: theme.textMuted,
    fontSize: "14px",
  },
  time: {
    color: theme.textMuted,
    fontSize: "14px",
  },
  postText: {
    fontSize: "15px",
    lineHeight: "1.4",
    wordWrap: "break-word" as const,
    whiteSpace: "pre-wrap" as const,
    marginBottom: "8px",
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    color: theme.textMuted,
    marginTop: "12px",
    maxWidth: "300px",
  },
  actionIcon: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: "16px",
    transition: "all 0.2s",
  },
  loginOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  loginModal: {
    backgroundColor: theme.bgPanel,
    padding: "32px",
    borderRadius: "12px",
    width: "400px",
    border: `1px solid ${theme.border}`,
  },
  input: {
    width: "100%",
    padding: "12px",
    marginBottom: "16px",
    backgroundColor: theme.bg,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    borderRadius: "4px",
    fontSize: "16px",
    boxSizing: "border-box" as const,
  },
  button: {
    width: "100%",
    padding: "12px",
    backgroundColor: theme.accent,
    color: "white",
    border: "none",
    borderRadius: "24px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  buttonOutline: {
    width: "100%",
    padding: "12px",
    backgroundColor: "transparent",
    color: theme.accent,
    border: `1px solid ${theme.accent}`,
    borderRadius: "24px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: "12px",
  },
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    width: "100%",
    color: theme.textMuted,
  },
  error: {
    color: theme.danger,
    marginBottom: "16px",
    fontSize: "14px",
  },
  // Details View Styles
  detailsHeader: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: `1px solid ${theme.border}`,
    backgroundColor: theme.bgPanel,
    position: "sticky" as const,
    top: 0,
    zIndex: 5,
    gap: "16px",
  },
  backButton: {
    background: "none",
    border: "none",
    color: theme.text,
    cursor: "pointer",
    padding: "8px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  mainPost: {
    padding: "16px",
    borderBottom: `1px solid ${theme.border}`,
    fontSize: "20px",
  },
  replyLine: {
    width: "2px",
    backgroundColor: theme.border,
    margin: "4px auto",
    flex: 1,
  },
}

// --- Helper Functions ---
const timeAgo = (dateStr: string) => {
  const date = new Date(dateStr)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

// Simple fetch wrapper for Bluesky API
const bskyFetch = async (
  endpoint: string,
  method = "GET",
  body?: any,
  token?: string,
) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const url = `https://bsky.social/xrpc/${endpoint}`

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.message || `API Error: ${res.status}`)
  }

  return res.json()
}

// --- Sub-components ---

// Individual Post Component
const PostItem = ({
  post,
  onClick,
  isMain = false,
}: {
  post: any
  onClick?: () => void
  isMain?: boolean
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const p = post.post || post // Handle both feed view (has wrapper) and thread view
  const author = p.author
  const record = p.record

  if (!author || !record) return null

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        ...styles.post,
        ...(isHovered && !isMain ? styles.postHover : {}),
        ...(isMain ? styles.mainPost : {}),
        cursor: onClick ? "pointer" : "default",
        flexDirection: isMain ? "column" : "row",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: isMain ? "row" : "column",
          marginRight: isMain ? 0 : "12px",
          marginBottom: isMain ? "12px" : 0,
        }}
      >
        <img
          src={
            author.avatar ||
            `https://ui-avatars.com/api/?name=${author.handle}&background=random`
          }
          style={styles.avatar}
          alt={author.handle}
        />
        {/* If it's part of a thread but not main, draw a line */}
      </div>

      <div style={styles.postContent}>
        <div style={styles.postHeader}>
          <span style={styles.displayName}>
            {author.displayName || author.handle}
          </span>
          <span style={styles.handle}>@{author.handle}</span>
          <span style={styles.time}>· {timeAgo(record.createdAt)}</span>
        </div>

        <div style={{ ...styles.postText, fontSize: isMain ? "20px" : "15px" }}>
          {record.text}
        </div>

        {p.embed?.images && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              marginTop: "12px",
            }}
          >
            {p.embed.images.map((img: any, i: number) => {
              const imgKey = img.thumb || img.fullsize || `fallback-img-${i}`
              return (
                <img
                  key={imgKey}
                  src={img.thumb || img.fullsize}
                  style={{
                    borderRadius: "12px",
                    maxWidth: "100%",
                    maxHeight: "300px",
                    objectFit: "cover",
                  }}
                  alt="attachment"
                />
              )
            })}
          </div>
        )}

        <div style={styles.actions}>
          <div style={styles.actionIcon}>
            <ReplyIcon /> {p.replyCount > 0 && p.replyCount}
          </div>
          <div style={styles.actionIcon}>
            <RepostIcon /> {p.repostCount > 0 && p.repostCount}
          </div>
          <div style={styles.actionIcon}>
            <HeartIcon filled={p.viewer?.like} />{" "}
            {p.likeCount > 0 && p.likeCount}
          </div>
        </div>
      </div>
    </div>
  )
}

// Column Content Component
const ColumnView = ({
  col,
  account,
  onClose,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  col: ColumnDef
  account?: BskyAccount
  onClose: (id: string) => void
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>, id: string) => void
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void
}) => {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [threadPost, setThreadPost] = useState<any>(null) // For drill-down view

  // Drill-down path management
  const [path, setPath] = useState<string[]>([])

  const currentViewUri = path.length > 0 ? path.at(-1) : null

  const fetchData = useCallback(async () => {
    if (!account) return
    setLoading(true)
    setError("")
    try {
      if (currentViewUri) {
        // Fetch Thread
        const res = await bskyFetch(
          `app.bsky.feed.getPostThread?uri=${encodeURIComponent(currentViewUri)}`,
          "GET",
          undefined,
          account.accessJwt,
        )
        setThreadPost(res.thread)
      } else {
        // Fetch Timeline
        let endpoint = "app.bsky.feed.getTimeline"
        if (col.type === "notifications")
          endpoint = "app.bsky.notification.listNotifications"
        else if (col.type === "profile")
          endpoint = `app.bsky.feed.getAuthorFeed?actor=${account.did}`

        const res = await bskyFetch(
          endpoint,
          "GET",
          undefined,
          account.accessJwt,
        )
        setItems(res.feed || res.notifications || [])
        setThreadPost(null)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [account, col.type, currentViewUri])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handlePostClick = (uri: string) => {
    setPath((prev) => [...prev, uri])
  }

  const handleBack = () => {
    setPath((prev) => prev.slice(0, -1))
  }

  // Render Thread View
  if (currentViewUri && threadPost) {
    return (
      <div
        style={styles.column}
        draggable
        onDragStart={(e) => onDragStart(e, col.id)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, col.id)}
        onDragEnd={onDragEnd}
      >
        <div style={styles.detailsHeader}>
          <button type="button" style={styles.backButton} onClick={handleBack}>
            <ArrowLeftIcon />
          </button>
          <div style={{ fontWeight: "bold", fontSize: "18px" }}>Thread</div>
        </div>
        <div style={styles.columnBody}>
          {loading ? (
            <div style={styles.center}>Loading...</div>
          ) : (
            <div>
              {/* Parent posts (simplified) */}
              {threadPost.parent && (
                <PostItem
                  post={threadPost.parent}
                  onClick={() => handlePostClick(threadPost.parent.post.uri)}
                />
              )}
              {/* Main Post */}
              {threadPost.post && <PostItem post={threadPost} isMain={true} />}
              {/* Replies */}
              {threadPost.replies?.map((reply: any) => (
                <PostItem
                  key={reply.post.uri}
                  post={reply}
                  onClick={() => handlePostClick(reply.post.uri)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render Feed View
  return (
    <div
      style={styles.column}
      draggable
      onDragStart={(e) => onDragStart(e, col.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, col.id)}
      onDragEnd={onDragEnd}
    >
      <div style={styles.columnHeader}>
        <div style={{ cursor: "grab", display: "flex" }}>
          <DragHandleIcon />
        </div>
        <div style={styles.columnHeaderTitle}>
          {col.title}
          {account && (
            <span style={styles.columnHeaderAccount}>@{account.handle}</span>
          )}
        </div>
        <button
          type="button"
          style={{
            cursor: "pointer",
            padding: "4px",
            background: "none",
            border: "none",
            color: "inherit",
          }}
          onClick={() => onClose(col.id)}
        >
          <TrashIcon />
        </button>
      </div>

      <div style={styles.columnBody}>
        {loading ? (
          <div style={styles.center}>Loading...</div>
        ) : error ? (
          <div style={styles.center}>
            <div style={{ color: theme.danger }}>{error}</div>
            <button
              type="button"
              onClick={fetchData}
              style={{
                ...styles.buttonOutline,
                marginTop: "8px",
                padding: "4px 8px",
                width: "auto",
              }}
            >
              Retry
            </button>
            {path.length > 0 && (
              <button
                type="button"
                onClick={handleBack}
                style={{
                  ...styles.buttonOutline,
                  marginTop: "8px",
                  padding: "4px 8px",
                  width: "auto",
                }}
              >
                Go Back
              </button>
            )}
          </div>
        ) : items.length === 0 ? (
          <div style={styles.center}>No items to show.</div>
        ) : (
          items.map((item, idx) => {
            const itemKey = item.post?.uri || item.uri || `fallback-item-${idx}`
            return (
              <PostItem
                key={itemKey}
                post={item}
                onClick={() => handlePostClick(item.post?.uri || item.uri)}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

// --- Main Component ---
export default function Deck() {
  const [state, setState] = useState<AppState>({ accounts: [], columns: [] })
  const [showLogin, setShowLogin] = useState(false)
  const [handle, setHandle] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)

  // Load state from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("deck_state")
    if (saved) {
      try {
        setState(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to parse deck state", e)
      }
    } else {
      setShowLogin(true)
    }
  }, [])

  // Save state to local storage whenever it changes
  useEffect(() => {
    if (state.accounts.length > 0) {
      localStorage.setItem("deck_state", JSON.stringify(state))
    }
  }, [state])

  const handleLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError("")
    try {
      let identifier = handle
      // Bluesky handles usually don't need @ but people type it
      if (identifier.startsWith("@")) identifier = identifier.substring(1)
      if (!identifier.includes(".")) identifier += ".bsky.social"

      const res = await bskyFetch("com.atproto.server.createSession", "POST", {
        identifier,
        password,
      })

      const newAccount: BskyAccount = {
        did: res.did,
        handle: res.handle,
        accessJwt: res.accessJwt,
        refreshJwt: res.refreshJwt,
      }

      // Add timeline column for new account by default
      const newCol: ColumnDef = {
        id: `col-${Date.now()}`,
        accountId: res.did,
        type: "timeline",
        title: "Timeline",
      }

      setState((prev) => ({
        accounts: [
          ...prev.accounts.filter((a) => a.did !== res.did),
          newAccount,
        ],
        columns: [...prev.columns, newCol],
      }))

      setShowLogin(false)
      setHandle("")
      setPassword("")
    } catch (err: any) {
      setLoginError(err.message || "Login failed")
    } finally {
      setLoginLoading(false)
    }
  }

  const addColumn = (
    accountId: string,
    type: ColumnDef["type"],
    title: string,
  ) => {
    const newCol: ColumnDef = {
      id: `col-${Date.now()}`,
      accountId,
      type,
      title,
    }
    setState((prev) => ({ ...prev, columns: [...prev.columns, newCol] }))
  }

  const removeColumn = (id: string) => {
    setState((prev) => ({
      ...prev,
      columns: prev.columns.filter((c) => c.id !== id),
    }))
  }

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData("text/plain", id)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5"
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault() // Necessary to allow dropping
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData("text/plain")
    if (sourceId === targetId) return

    setState((prev) => {
      const newCols = [...prev.columns]
      const sourceIdx = newCols.findIndex((c) => c.id === sourceId)
      const targetIdx = newCols.findIndex((c) => c.id === targetId)

      const movedCol = newCols.splice(sourceIdx, 1)[0]
      if (movedCol) {
        newCols.splice(targetIdx, 0, movedCol)
      }

      return { ...prev, columns: newCols }
    })
  }

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1"
    }
  }

  return (
    <div style={styles.container}>
      {/* Sidebar navigation */}
      <div style={styles.sidebar}>
        <div
          style={{ ...styles.sidebarIcon, color: theme.accent }}
          title="Deck Home"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"></path>
          </svg>
        </div>

        <button
          type="button"
          style={{
            ...styles.sidebarIcon,
            border: "none",
            background: "none",
            padding: 0,
          }}
          onClick={() => {
            if (state.accounts.length > 0 && state.accounts[0]) {
              addColumn(state.accounts[0].did, "timeline", "Timeline")
            }
          }}
          title="Add Timeline"
        >
          <HomeIcon />
        </button>

        {/* We can add buttons to add other column types here */}

        <div style={{ flex: 1 }} />

        <button
          type="button"
          style={{
            ...styles.sidebarIcon,
            border: "none",
            background: "none",
            padding: 0,
          }}
          onClick={() => setShowLogin(true)}
          title="Add Account"
        >
          <UserIcon />
        </button>

        {state.accounts.map((acc, i) => (
          <button
            type="button"
            key={i}
            style={{
              ...styles.sidebarIcon,
              border: "none",
              padding: 0,
              background: "none",
            }}
            onClick={() => {
              addColumn(acc.did, "timeline", "Timeline")
            }}
            title={`Add Timeline for @${acc.handle}`}
          >
            <img
              src={`https://ui-avatars.com/api/?name=${acc.handle}&background=random`}
              style={{ width: "100%", height: "100%", borderRadius: "50%" }}
              alt={acc.handle}
            />
          </button>
        ))}

        <button
          type="button"
          style={{
            ...styles.sidebarIcon,
            border: "none",
            background: "none",
            padding: 0,
          }}
          onClick={() => {
            if (confirm("Clear all data and logout?")) {
              localStorage.removeItem("deck_state")
              setState({ accounts: [], columns: [] })
              setShowLogin(true)
            }
          }}
          title="Settings/Logout"
        >
          <SettingsIcon />
        </button>
      </div>

      {/* Main Deck Area */}
      <div style={styles.deckContainer}>
        {state.columns.map((col) => {
          const account = state.accounts.find((a) => a.did === col.accountId)
          return (
            <ColumnView
              key={col.id}
              col={col}
              account={account}
              onClose={removeColumn}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          )
        })}
        {state.columns.length === 0 && !showLogin && (
          <div
            style={{ ...styles.center, flexDirection: "column", gap: "16px" }}
          >
            <h2>Welcome to Deck</h2>
            <p>Add a column using the sidebar, or add an account.</p>
            <button
              type="button"
              style={styles.button}
              onClick={() => setShowLogin(true)}
            >
              Add Account
            </button>
          </div>
        )}
      </div>

      {/* Login Modal */}
      {showLogin && (
        <div style={styles.loginOverlay}>
          <div style={styles.loginModal}>
            <h2 style={{ marginTop: 0, marginBottom: "24px" }}>
              Sign in to Bluesky
            </h2>
            <form onSubmit={handleLogin}>
              {loginError && <div style={styles.error}>{loginError}</div>}
              <input
                type="text"
                placeholder="Handle (e.g. alice.bsky.social)"
                style={styles.input}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="App Password"
                style={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="submit"
                style={styles.button}
                disabled={loginLoading}
              >
                {loginLoading ? "Signing in..." : "Sign in"}
              </button>
              {state.accounts.length > 0 && (
                <button
                  type="button"
                  style={styles.buttonOutline}
                  onClick={() => setShowLogin(false)}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
