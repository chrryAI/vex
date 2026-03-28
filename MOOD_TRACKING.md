# 😊 Mood Tracking System

## Overview

Focus app includes **inline mood tracking** that allows users to set their current mood before chatting with AI. The AI uses this mood context to provide more empathetic and contextually appropriate responses.

---

## 🎯 Features

### **1. Inline Mood Selector**

```typescript
// In Chat component
{app?.features?.moodTracking && (
  <MoodSelector
    mood={moodType}
    onMoodChange={async (newMood) => {
      await updateMood({ type: newMood })
      toast.success(emojiMap[newMood])
    }}
  />
)}
```

### **2. Available Moods**

```typescript
type Mood =
  | "happy" // 😊
  | "sad" // 😢
  | "angry" // 😡
  | "astonished" // 😰
  | "inlove" // 😍
  | "thinking"; // 🤔 (default)
```

### **3. Smart Update Logic**

```typescript
// If last mood was created TODAY → Update it
// If last mood was yesterday or older → Create new one

// Benefits:
✅ One mood per day
✅ Clean mood history
✅ Easy daily tracking
✅ No database bloat
```

---

## 🏗️ Architecture

### **Client Side**

```typescript
// Chat.tsx
const [moodType, setMoodType] = useState(mood?.type || "thinking");
const [isSelectingMood, setIsSelectingMood] = useState(!mood);

// When user selects mood
await updateMood({ type: newMood });

// Mood is attached to messages
formData.append("moodId", mood.id);
```

### **Server Side**

```typescript
// /api/mood/route.ts
POST /api/mood
{
  type: "happy" | "sad" | "angry" | ...
}

// Logic:
1. Get last mood
2. Check if created today
3. If today → Update existing mood
4. If older → Create new mood
5. Return mood
```

### **Message Integration**

```typescript
// /api/messages/route.ts
const mood = moodId ? await getMood({ id: moodId }) : undefined;

// Mood is saved with message
await createMessage({
  moodId: mood?.id,
  content: messageContent,
  // ...
});
```

---

## 🎨 UI Flow

### **Initial State**

```
┌─────────────────────────────────┐
│  😊 [Mood] [Attach] [Send]      │
│  ↑                              │
│  Default: thinking (🤔)         │
└─────────────────────────────────┘
```

### **Selecting Mood**

```
┌─────────────────────────────────┐
│  😊 😢 😡 😰 😍 🤔              │
│  ↑                              │
│  Click to select                │
│  Click outside to cancel        │
│  Only mood selector visible     │
└─────────────────────────────────┘
```

### **Mood Selected**

```
┌─────────────────────────────────┐
│  😊 [Attach] [Send]             │
│  ↑                              │
│  Shows selected mood            │
│  Ready to chat                  │
└─────────────────────────────────┘
```

---

## 📊 Data Structure

### **Mood Table**

```typescript
{
  id: string
  type: "happy" | "sad" | "angry" | ...
  userId: string | null
  guestId: string | null
  createdOn: Date
  updatedOn: Date
}
```

### **Message Table**

```typescript
{
  id: string;
  content: string;
  moodId: string | null; // ← Links to mood
  threadId: string;
  userId: string | null;
  guestId: string | null;
  // ...
}
```

---

## 🔄 Update Logic

### **Scenario 1: First Mood Today**

```typescript
// 9:00 AM - User sets mood to "happy"
lastMood: null
→ Create new mood (id: "mood-1", type: "happy")

// 10:00 AM - User changes to "thinking"
lastMood: { id: "mood-1", createdOn: today }
isToday: true
→ Update mood-1 (type: "thinking")

// 2:00 PM - User changes to "sad"
lastMood: { id: "mood-1", createdOn: today }
isToday: true
→ Update mood-1 (type: "sad")

Result: One mood entry for the day
```

### **Scenario 2: Next Day**

```typescript
// Yesterday - Last mood was "sad"
lastMood: { id: "mood-1", createdOn: yesterday }

// Today 9:00 AM - User sets mood to "happy"
lastMood: { id: "mood-1", createdOn: yesterday }
isToday: false
→ Create new mood (id: "mood-2", type: "happy")

Result: New mood entry for new day
```

### **Scenario 3: Multiple Updates Same Day**

```typescript
// Today
9:00 AM → Create mood-1 (happy)
10:00 AM → Update mood-1 (thinking)
11:00 AM → Update mood-1 (sad)
2:00 PM → Update mood-1 (angry)
5:00 PM → Update mood-1 (happy)

Result: One mood entry, last state = "happy"
```

---

## 🎯 Benefits

### **For Users**

- ✅ **One mood per day** - Simple mental model
- ✅ **Easy to update** - Just click new mood
- ✅ **No clutter** - Clean mood history
- ✅ **Daily tracking** - See mood over time

### **For Database**

- ✅ **Less bloat** - One entry per day vs. many
- ✅ **Easier queries** - Simple pagination
- ✅ **Better performance** - Fewer rows to scan
- ✅ **Clean data** - No duplicate entries

### **For AI**

- ✅ **Current mood** - Always up-to-date
- ✅ **Context-aware** - Responds appropriately
- ✅ **Empathetic** - Adjusts tone based on mood
- ✅ **Historical** - Can see mood trends

---

## 🔐 Privacy

### **Mood Data**

```typescript
// Moods are private
- Only visible to owner (user or guest)
- Not shared with other users
- Not visible in public threads
- Stored securely in database
```

### **Message Association**

```typescript
// Mood is linked to message
- AI can see mood for context
- Mood helps AI respond better
- Mood not shown to other users
- Only used for AI personalization
```

---

## 📈 Analytics (Future)

### **Mood Trends**

```typescript
// Track mood over time
- Daily mood chart
- Weekly mood patterns
- Monthly mood summary
- Mood correlations with productivity
```

### **Insights**

```typescript
// AI-powered insights
-"You're happiest on Fridays" -
  "Mood improves after exercise" -
  "Stress peaks on Mondays" -
  "Suggest activities to improve mood";
```

---

## 🎨 UI States

### **Button States**

```typescript
// When selecting mood
{!isSelectingMood && (
  <AttachButton />
  <QuotaButton />
  <SendButton />
)}

// Only mood selector visible
{isSelectingMood && (
  <MoodSelector />
)}
```

### **Click Outside to Cancel**

```typescript
// MoodSelector
useEffect(() => {
  function handleClickOutside(event) {
    if (!ref.current.contains(event.target)) {
      setMood(originalMood); // Revert
      onMoodChange(originalMood);
    }
  }
  document.addEventListener("mousedown", handleClickOutside);
}, []);
```

---

## 🚀 API Endpoints

### **POST /api/mood**

```typescript
// Update or create mood
Request:
{
  type: "happy" | "sad" | "angry" | ...
}

Response:
{
  id: "mood-123",
  type: "happy",
  userId: "user-456",
  createdOn: "2025-11-08T00:00:00Z",
  updatedOn: "2025-11-08T10:30:00Z"
}
```

### **GET /api/mood**

```typescript
// Get current mood
Response:
{
  id: "mood-123",
  type: "happy",
  userId: "user-456",
  createdOn: "2025-11-08T00:00:00Z",
  updatedOn: "2025-11-08T10:30:00Z"
}
```

---

## 🎯 Integration Points

### **Focus App**

```typescript
// Focus app has mood tracking enabled
features: {
  moodTracking: true,
  // ...
}

// Mood selector appears in chat
{app?.features?.moodTracking && <MoodSelector />}
```

### **AI Context**

```typescript
// AI receives mood in system prompt
const moodContext = mood ? `User's current mood: ${emojiMap[mood.type]} (${mood.type})` : "";

// AI adjusts responses based on mood
if (mood.type === "sad") {
  // Be empathetic and supportive
} else if (mood.type === "happy") {
  // Be enthusiastic and positive
}
```

---

## 📊 Example Mood History

```typescript
// User's mood over a week
[
  { date: "2025-11-01", mood: "happy", updatedAt: "10:30" },
  { date: "2025-11-02", mood: "thinking", updatedAt: "09:15" },
  { date: "2025-11-03", mood: "sad", updatedAt: "14:20" },
  { date: "2025-11-04", mood: "happy", updatedAt: "11:00" },
  { date: "2025-11-05", mood: "angry", updatedAt: "16:45" },
  { date: "2025-11-06", mood: "happy", updatedAt: "08:30" },
  { date: "2025-11-07", mood: "inlove", updatedAt: "19:00" },
];

// Clean, one entry per day!
```

---

## ✅ Summary

### **What We Built**

- ✅ Inline mood selector in chat
- ✅ Smart update logic (one mood per day)
- ✅ Click outside to cancel
- ✅ Mood attached to messages
- ✅ AI context integration
- ✅ Clean data structure
- ✅ Privacy-first design

### **Benefits**

- ✅ Better AI responses (mood-aware)
- ✅ Cleaner database (no bloat)
- ✅ Simpler pagination (one per day)
- ✅ Easy mood tracking (daily history)
- ✅ Great UX (inline, fast, intuitive)

### **Future Enhancements**

- 📊 Mood analytics dashboard
- 📈 Mood trends and patterns
- 💡 AI-powered mood insights
- 🎯 Mood-based recommendations
- 🔔 Mood check-in reminders

**Mood tracking makes AI conversations more human and empathetic!** 😊✨
