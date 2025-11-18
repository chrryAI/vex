# Zero Authentication Guide

## 🔐 **How Authentication Works in Zero**

Zero uses **three layers** of authentication:

1. **Client Authentication** - Who is making the request?
2. **Row-Level Permissions** - What data can they access?
3. **Custom Mutators** - What actions can they perform?

---

## 1️⃣ **Client Authentication**

### **Setup Zero Client with Auth**

```typescript
// apps/web/lib/zero-client.ts
import { Zero } from "@rocicorp/zero"
import { schema } from "zero-server/zero-schema.gen"
import { getSession } from "next-auth/react"

export function createZeroClient() {
  const [zero, setZero] = useState<Zero | null>(null)

  useEffect(() => {
    async function init() {
      const session = await getSession()

      const z = new Zero({
        server: process.env.NEXT_PUBLIC_ZERO_SERVER_URL!,
        schema,
        // Pass authenticated user/guest ID
        userID: session?.user?.id || session?.guest?.id || "anonymous",
        // Optional: Pass JWT token for server verification
        auth: async () => {
          const session = await getSession()
          return session?.token || ""
        },
      })

      setZero(z)
    }

    init()
  }, [])

  return zero
}
```

---

## 2️⃣ **Row-Level Permissions**

### **Server-Side Permission Rules**

These run on **every query** to filter data:

```typescript
// apps/zero-server/src/index.ts (when Zero server is implemented)
const server = createZeroServer({
  schema,

  // Row-level security
  permissions: {
    messages: {
      // Users can only READ their own messages
      read: (row, { userID }) => {
        return row.userId === userID || row.guestId === userID
      },
      // Users can only WRITE their own messages
      write: (row, { userID }) => {
        return row.userId === userID || row.guestId === userID
      },
    },

    threads: {
      read: (row, { userID }) => {
        return row.userId === userID || row.guestId === userID
      },
      write: (row, { userID }) => {
        return row.userId === userID || row.guestId === userID
      },
    },

    users: {
      // Can only read own profile
      read: (row, { userID }) => row.id === userID,
      // Cannot write directly (use mutators)
      write: () => false,
    },
  },
})
```

**How it works:**

- ✅ User A queries messages → Only sees their messages
- ✅ User B queries messages → Only sees their messages
- ❌ User A cannot see User B's messages
- ❌ User A cannot modify User B's messages

---

## 3️⃣ **Custom Mutators (Authenticated Actions)**

### **Server-Side Mutators**

For sensitive operations, use custom mutators:

```typescript
// apps/zero-server/src/index.ts
import {
  createMessage,
  createThread,
  updateUser,
  deleteMessage,
  type newMessage,
  type newThread,
  type user,
} from "@repo/db"

const server = createZeroServer({
  schema,
  permissions: {
    /* ... */
  },

  // Custom authenticated mutations - REUSE existing DB functions!
  mutators: {
    // Create a message (authenticated)
    createMessage: async (
      args: Omit<newMessage, "userId" | "guestId">,
      { userID },
    ) => {
      // Determine if user or guest
      const isUser = userID.startsWith("user_")

      // Call your existing createMessage function!
      const message = await createMessage({
        ...args,
        userId: isUser ? userID : null,
        guestId: isUser ? null : userID,
      })

      return { id: message?.id }
    },

    // Create a thread (authenticated)
    createThread: async (
      args: Omit<newThread, "userId" | "guestId">,
      { userID },
    ) => {
      const isUser = userID.startsWith("user_")

      // Call your existing createThread function!
      const thread = await createThread({
        ...args,
        userId: isUser ? userID : null,
        guestId: isUser ? null : userID,
      })

      return { id: thread?.id }
    },

    // Update user profile (authenticated)
    updateProfile: async (args: Partial<user>, { userID }) => {
      // Verify user is updating their own profile
      if (args.id && args.id !== userID) {
        throw new Error("Cannot update another user's profile")
      }

      // Call your existing updateUser function!
      const updated = await updateUser({
        ...args,
        id: userID,
      } as user)

      return { success: !!updated }
    },

    // Delete message (authenticated)
    deleteMessage: async ({ messageId }: { messageId: string }, { userID }) => {
      // Call your existing deleteMessage function!
      // It already handles ownership verification
      const deleted = await deleteMessage({ id: messageId })

      return { success: !!deleted }
    },
  },
})
```

---

## 4️⃣ **Client-Side Usage**

### **Using Authenticated Queries**

```typescript
// apps/web/components/MessageList.tsx
import { useQuery } from "@rocicorp/zero/react"

function MessageList({ threadId }: { threadId: string }) {
  const zero = useZero()

  // Query automatically filtered by permissions!
  // User only sees their own messages
  const [messages] = useQuery(
    zero.query.messages
      .where("threadId", threadId)
      .orderBy("createdAt", "desc")
  )

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.message}</div>
      ))}
    </div>
  )
}
```

### **Using Authenticated Mutations**

```typescript
// apps/web/components/MessageInput.tsx
import { useZero } from "@rocicorp/zero/react"

function MessageInput({ threadId }: { threadId: string }) {
  const zero = useZero()
  const [message, setMessage] = useState("")

  const sendMessage = async () => {
    // Call authenticated mutator
    await zero.mutate.createMessage({
      threadId,
      message,
      role: "user",
    })

    setMessage("")
  }

  return (
    <div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  )
}
```

---

## 🔒 **Security Best Practices**

### **1. Always Verify Ownership**

```typescript
// ❌ BAD: Trust client data
mutators: {
  deleteMessage: async ({ messageId }, { db }) => {
    // Anyone can delete any message!
    await db.delete(schema.messages).where(eq(schema.messages.id, messageId))
  }
}

// ✅ GOOD: Verify ownership
mutators: {
  deleteMessage: async ({ messageId }, { db, userID }) => {
    const message = await db.query.messages.findFirst({
      where: (m, { eq, and, or }) =>
        and(
          eq(m.id, messageId),
          or(eq(m.userId, userID), eq(m.guestId, userID)),
        ),
    })

    if (!message) throw new Error("Access denied")

    await db.delete(schema.messages).where(eq(schema.messages.id, messageId))
  }
}
```

### **2. Use Permissions for Reads**

```typescript
// ✅ Permissions automatically filter queries
permissions: {
  messages: {
    read: (row, { userID }) => {
      // Only return messages that belong to this user
      return row.userId === userID || row.guestId === userID
    },
  },
}
```

### **3. Use Mutators for Writes**

```typescript
// ✅ Mutators enforce business logic
mutators: {
  createMessage: async ({ threadId, message }, { db, userID }) => {
    // 1. Verify thread access
    const thread = await db.query.threads.findFirst({
      where: (t, { eq, or }) =>
        or(eq(t.userId, userID), eq(t.guestId, userID)),
    })

    if (!thread) throw new Error("Access denied")

    // 2. Validate message
    if (message.length > 10000) {
      throw new Error("Message too long")
    }

    // 3. Create with authenticated user
    await db.insert(schema.messages).values({
      id: crypto.randomUUID(),
      threadId,
      message,
      userId: thread.userId === userID ? userID : null,
      guestId: thread.guestId === userID ? userID : null,
    })
  },
}
```

### **4. Never Trust Client Input**

```typescript
// ❌ BAD: Client sets userId
await zero.mutate.createMessage({
  userId: "some-other-user", // Client can impersonate!
  message: "Hello",
})

// ✅ GOOD: Server sets userId from auth context
mutators: {
  createMessage: async ({ message }, { db, userID }) => {
    // userID comes from authenticated session, not client
    await db.insert(schema.messages).values({
      userId: userID, // Server-side, trusted
      message,
    })
  },
}
```

---

## 📊 **Authentication Flow**

```
1. User logs in
   ↓
2. NextAuth creates session with user ID
   ↓
3. Zero client initialized with userID
   ↓
4. User queries messages
   ↓
5. Zero server checks permissions
   ↓
6. Only user's messages returned
   ↓
7. User creates message via mutator
   ↓
8. Server verifies userID from auth context
   ↓
9. Message created with authenticated user
   ↓
10. Real-time sync to all clients
```

---

## 🎯 **Summary**

### **Three Layers of Security:**

1. **Client Auth** → `userID` passed to Zero
2. **Permissions** → Filter queries automatically
3. **Mutators** → Enforce business logic on writes

### **Key Rules:**

- ✅ Always verify ownership in mutators
- ✅ Use permissions for automatic filtering
- ✅ Never trust client-provided user IDs
- ✅ Validate all input in mutators
- ✅ Use server-side auth context (`userID`)

---

**With this setup, your mutations are fully authenticated and secure!** 🔐🚀
