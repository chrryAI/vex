# ✅ Reusing Existing Database Functions in Zero

## 🎯 **Key Principle: Don't Duplicate Code!**

Your `@repo/db` package already has **all the database functions you need**:
- ✅ `createMessage`, `updateMessage`, `deleteMessage`
- ✅ `createThread`, `updateThread`, `deleteThread`
- ✅ `createTask`, `updateTask`, `deleteTask`
- ✅ `createUser`, `updateUser`, `deleteUser`
- ✅ `createMood`, `updateMood`, `deleteMood`
- ✅ And many more...

**Zero mutators should CALL these existing functions, not rewrite them!**

---

## ✅ **Correct Pattern: Reuse Existing Functions**

### **Example: Create Message Mutator**

```typescript
// apps/zero-server/src/mutators.ts
import { createMessage, type newMessage } from "@repo/db"

export const mutators = {
  createMessage: async (
    args: Omit<newMessage, "userId" | "guestId">,
    { userID }: { userID: string }
  ) => {
    // Determine if user or guest
    const isUser = userID.startsWith("user_")
    
    // ✅ Call your existing function!
    const message = await createMessage({
      ...args,
      userId: isUser ? userID : null,
      guestId: isUser ? null : userID,
    })

    return { id: message?.id }
  },
}
```

**Benefits:**
- ✅ Uses existing `createMessage` from `@repo/db`
- ✅ All existing logic preserved (credit tracking, cache invalidation, etc.)
- ✅ No code duplication
- ✅ Type-safe with existing types

---

## ❌ **Wrong Pattern: Rewriting Database Logic**

```typescript
// ❌ DON'T DO THIS - Duplicates existing code!
export const mutators = {
  createMessage: async (args, { db, userID }) => {
    // ❌ Manually inserting into database
    const messageId = crypto.randomUUID()
    await db.insert(schema.messages).values({
      id: messageId,
      ...args,
      userId: userID,
    })

    // ❌ Missing credit tracking!
    // ❌ Missing cache invalidation!
    // ❌ Missing all your existing business logic!

    return { id: messageId }
  },
}
```

**Problems:**
- ❌ Duplicates database logic
- ❌ Misses credit tracking (`logCreditUsage`)
- ❌ Misses cache invalidation (`invalidateUser`, `invalidateGuest`)
- ❌ Misses all existing business logic
- ❌ Hard to maintain (two places to update)

---

## 📋 **Complete Example: All Common Mutators**

```typescript
// apps/zero-server/src/mutators.ts
import {
  // Import existing functions
  createMessage,
  createThread,
  updateUser,
  deleteMessage,
  updateThread,
  createTask,
  updateTask,
  deleteTask,
  createMood,
  updateMood,
  // Import types
  type newMessage,
  type newThread,
  type user,
  type message,
  type thread,
  type newTask,
  type task,
  type newMood,
  type mood,
} from "@repo/db"

export const mutators = {
  // ✅ Messages
  createMessage: async (
    args: Omit<newMessage, "userId" | "guestId">,
    { userID }: { userID: string }
  ) => {
    const isUser = userID.startsWith("user_")
    const message = await createMessage({
      ...args,
      userId: isUser ? userID : null,
      guestId: isUser ? null : userID,
    })
    return { id: message?.id }
  },

  deleteMessage: async (
    { messageId }: { messageId: string },
    { userID }: { userID: string }
  ) => {
    const deleted = await deleteMessage({ id: messageId })
    return { success: !!deleted }
  },

  // ✅ Threads
  createThread: async (
    args: Omit<newThread, "userId" | "guestId">,
    { userID }: { userID: string }
  ) => {
    const isUser = userID.startsWith("user_")
    const thread = await createThread({
      ...args,
      userId: isUser ? userID : null,
      guestId: isUser ? null : userID,
    })
    return { id: thread?.id }
  },

  archiveThread: async (
    { threadId }: { threadId: string },
    { userID }: { userID: string }
  ) => {
    // Get existing thread first
    const existingThread = await getThread({ id: threadId })
    if (!existingThread) throw new Error("Thread not found")

    const updated = await updateThread({
      ...existingThread,
      isArchived: true,
    })
    return { success: !!updated }
  },

  // ✅ Users
  updateProfile: async (
    args: Partial<user>,
    { userID }: { userID: string }
  ) => {
    if (args.id && args.id !== userID) {
      throw new Error("Cannot update another user's profile")
    }

    const updated = await updateUser({
      ...args,
      id: userID,
    } as user)
    return { success: !!updated }
  },

  // ✅ Tasks
  createTask: async (
    args: Omit<newTask, "userId" | "guestId">,
    { userID }: { userID: string }
  ) => {
    const isUser = userID.startsWith("user_")
    const task = await createTask({
      ...args,
      userId: isUser ? userID : null,
      guestId: isUser ? null : userID,
    })
    return { id: task?.id }
  },

  updateTask: async (
    args: Partial<task> & { id: string },
    { userID }: { userID: string }
  ) => {
    // Get existing task first
    const existingTask = await getTask({ id: args.id })
    if (!existingTask) throw new Error("Task not found")

    const updated = await updateTask({
      ...existingTask,
      ...args,
    })
    return { success: !!updated }
  },

  deleteTask: async (
    { taskId }: { taskId: string },
    { userID }: { userID: string }
  ) => {
    const deleted = await deleteTask({ id: taskId })
    return { success: !!deleted }
  },

  // ✅ Moods
  createMood: async (
    args: Omit<newMood, "userId" | "guestId">,
    { userID }: { userID: string }
  ) => {
    const isUser = userID.startsWith("user_")
    const mood = await createMood({
      ...args,
      userId: isUser ? userID : null,
      guestId: isUser ? null : userID,
    })
    return { id: mood?.id }
  },

  updateMood: async (
    args: Partial<mood> & { id: string },
    { userID }: { userID: string }
  ) => {
    const existingMood = await getMood({ id: args.id })
    if (!existingMood) throw new Error("Mood not found")

    const updated = await updateMood({
      ...existingMood,
      ...args,
    })
    return { success: !!updated }
  },
}
```

---

## 🎯 **What Gets Preserved When You Reuse Functions**

### **1. Credit Tracking**
```typescript
// Your existing createMessage already does this:
await logCreditUsage({
  userId: inserted.userId || undefined,
  guestId: inserted.guestId || undefined,
  agentId: inserted.agentId,
  creditCost: totalCreditCost,
  messageType: "ai",
  threadId: inserted.threadId || undefined,
  messageId: inserted.id,
})
```

### **2. Cache Invalidation**
```typescript
// Your existing createMessage already does this:
if (inserted?.userId) {
  await invalidateUser(inserted.userId)
}
if (inserted?.guestId) {
  await invalidateGuest(inserted.guestId)
}
```

### **3. Business Logic**
```typescript
// Your existing functions already handle:
// - Ownership verification
// - Data validation
// - Related data updates
// - Error handling
// - Logging
```

---

## 📊 **Comparison**

### **Reusing Existing Functions (✅ Recommended)**
```typescript
const message = await createMessage({
  ...args,
  userId: isUser ? userID : null,
  guestId: isUser ? null : userID,
})
```

**Result:**
- ✅ 3 lines of code
- ✅ All existing logic preserved
- ✅ Credit tracking works
- ✅ Cache invalidation works
- ✅ Easy to maintain

### **Rewriting Logic (❌ Not Recommended)**
```typescript
const messageId = crypto.randomUUID()
await db.insert(schema.messages).values({
  id: messageId,
  ...args,
  userId: userID,
})

// Manually track credits
await logCreditUsage({ ... })

// Manually invalidate cache
await invalidateUser(userID)

// Manually handle all business logic
// ... 50+ more lines
```

**Result:**
- ❌ 50+ lines of code
- ❌ Duplicates existing logic
- ❌ Easy to miss features
- ❌ Hard to maintain

---

## 🚀 **Summary**

### **DO:**
- ✅ Import functions from `@repo/db`
- ✅ Call existing functions in mutators
- ✅ Add `userID` from auth context
- ✅ Keep mutators thin (just auth + call existing function)

### **DON'T:**
- ❌ Rewrite database logic in mutators
- ❌ Duplicate credit tracking
- ❌ Duplicate cache invalidation
- ❌ Duplicate business logic

### **Pattern:**
```typescript
// Zero mutator = Auth check + Call existing function
mutator: async (args, { userID }) => {
  // 1. Add authenticated userID
  // 2. Call existing function
  // 3. Return result
  return await existingFunction({ ...args, userId: userID })
}
```

---

**By reusing your existing functions, Zero mutators become simple wrappers that add authentication to your existing, battle-tested database logic!** 🎯✨
