# Zero Migration Vision

**Status:** Future consideration (Alpha software, long-term goal)  
**Timeline:** 6-12 months after Zero reaches stable release  
**Impact:** ~90% reduction in infrastructure code

---

## Executive Summary

Zero is a sync engine that eliminates the API layer entirely. Instead of building REST/GraphQL endpoints, you query the database directly from the client through a persistent sync layer with built-in WebSocket support.

**What we gain:**
- ❌ Delete ~5,000 lines of API routes
- ❌ Delete ~500 lines of WebSocket infrastructure  
- ❌ Delete ~300 lines of cache invalidation logic
- ✅ Built-in real-time updates
- ✅ Automatic caching
- ✅ Faster feature development

**What we trade:**
- Full HTTP control
- Custom API design
- REST/GraphQL flexibility

---

## Current Architecture (Phase 1)

```
┌─────────┐     HTTP      ┌──────────┐     SQL      ┌──────────┐
│ Client  │ ────────────> │ Next.js  │ ──────────> │ Postgres │
│ (React) │               │ API      │              │          │
└─────────┘               └──────────┘              └──────────┘
     │
     └─> SWR (caching)
     └─> Manual WebSocket
```

**Problems:**
- Need to write API route for every data operation
- Manual cache invalidation with `mutate()`
- WebSocket setup requires custom infrastructure
- Optimistic updates are manual
- API versioning and documentation overhead

**Code footprint:**
- API routes: ~5,000 lines
- WebSocket: ~500 lines
- Cache logic: ~300 lines
- **Total: ~5,800 lines**

---

## Planned Architecture (Phase 2)

```
┌─────────┐     HTTP      ┌──────────┐     SQL      ┌──────────┐
│ Client  │ ────────────> │ Hono     │ ──────────> │ Postgres │
│ (React) │               │ API      │              │          │
└─────────┘               └──────────┘              └──────────┘
     │
     └─> SWR (caching)
     └─> Manual WebSocket
```

**Improvements:**
- Faster than Next.js
- Simpler API routes with Hono
- More control over routing

**Still requires:**
- Writing all API endpoints
- Manual WebSocket setup
- Manual cache invalidation

**Code footprint:**
- API routes: ~4,000 lines (simpler with Hono)
- WebSocket: ~500 lines
- Cache logic: ~300 lines
- **Total: ~4,800 lines**

---

## Zero Architecture (Phase 3 - Future Vision)

```
┌─────────┐   WebSocket   ┌──────────┐     SQL      ┌──────────┐
│ Client  │ <══════════> │ Zero     │ ──────────> │ Postgres │
│ (React) │   (Sync)      │ Engine   │              │          │
└─────────┘               └──────────┘              └──────────┘
     │
     └─> Automatic caching
     └─> Automatic real-time
     └─> Automatic optimistic updates
```

**How it works:**
1. Client issues queries directly (no API routes)
2. Zero syncs results to client-side cache
3. Cache is persistent (IndexedDB)
4. Updates are automatic via WebSocket
5. Queries resolve instantly from cache when possible

**Code footprint:**
- Zero setup: ~100 lines
- Query definitions: ~500 lines
- **Total: ~600 lines**

**Savings: ~5,200 lines (90% reduction)**

---

## Code Comparison

### Current: Session Fetching

**File 1: `/api/session/route.ts` (~200 lines)**
```typescript
export async function GET(request: Request) {
  // Get cookies
  const fingerprint = getCookie('fingerprint')
  const token = getCookie('token')
  
  // Auth logic
  if (!fingerprint) {
    return Response.json({ error: 'No fingerprint' }, { status: 401 })
  }
  
  // Database queries
  const guest = await db.query.guests.findFirst({
    where: eq(guests.fingerprint, fingerprint),
    with: {
      app: {
        with: {
          store: {
            with: {
              apps: true
            }
          }
        }
      }
    }
  })
  
  // Error handling
  if (!guest) {
    return Response.json({ error: 'Guest not found' }, { status: 404 })
  }
  
  // Response formatting
  return Response.json({
    guest,
    app: guest.app,
    store: guest.app.store,
  })
}
```

**File 2: `AuthProvider.tsx` (~100 lines)**
```typescript
const fetchSession = async () => {
  const res = await fetch('/api/session', {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  
  return res.json()
}

const { data, error, mutate } = useSWR(
  shouldFetchSession ? sessionKey : null,
  fetchSession,
  {
    revalidateOnMount: true,
    errorRetryCount: 2,
    errorRetryInterval: 3000,
  }
)

// Manual cache invalidation
const refreshSession = () => mutate()
```

**Total: ~300 lines across 2 files**

---

### With Zero: Session Fetching

**File: `AuthProvider.tsx` (~20 lines)**
```typescript
const [session] = useQuery(
  zero.query.session
    .related('guest')
    .related('app', app => app
      .related('store', store => store
        .related('apps')))
    .one()
)

// That's it. No API route needed.
// Updates automatically when data changes.
// Cached automatically.
// Optimistic updates automatic.
```

**Total: ~20 lines in 1 file**

**Reduction: 93%**

---

## Real-Time Features Comparison

### Current: Live Message Updates (Planned)

**Server: WebSocket Setup (~200 lines)**
```typescript
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8080 })

// Connection handling
wss.on('connection', (ws, req) => {
  const userId = authenticateWebSocket(req)
  
  // Subscribe to user's threads
  const subscription = db.subscribe('messages', {
    where: { userId }
  }, (change) => {
    ws.send(JSON.stringify({
      type: 'message:new',
      data: change
    }))
  })
  
  ws.on('close', () => {
    subscription.unsubscribe()
  })
})

// Broadcast on new message
db.on('insert:messages', (message) => {
  wss.clients.forEach(client => {
    if (shouldReceive(client, message)) {
      client.send(JSON.stringify({
        type: 'message:new',
        data: message
      }))
    }
  })
})
```

**Client: WebSocket Handling (~150 lines)**
```typescript
const ws = useRef<WebSocket>()

useEffect(() => {
  ws.current = new WebSocket('ws://localhost:8080')
  
  ws.current.onopen = () => {
    console.log('Connected')
  }
  
  ws.current.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data)
    
    switch (type) {
      case 'message:new':
        // Invalidate messages cache
        mutate(`/api/messages?threadId=${data.threadId}`)
        break
      case 'message:update':
        // Update specific message in cache
        mutate(
          `/api/messages?threadId=${data.threadId}`,
          (current) => updateMessage(current, data),
          { revalidate: false }
        )
        break
    }
  }
  
  ws.current.onerror = (error) => {
    console.error('WebSocket error:', error)
  }
  
  ws.current.onclose = () => {
    // Reconnect logic
    setTimeout(connectWebSocket, 1000)
  }
  
  return () => ws.current?.close()
}, [])
```

**Total: ~350 lines**

---

### With Zero: Live Message Updates

```typescript
const [messages] = useQuery(
  zero.query.message
    .where('threadId', threadId)
    .related('sender')
    .orderBy('createdAt', 'desc')
)

// Updates automatically when anyone sends a message.
// No WebSocket setup needed.
```

**Total: ~5 lines**

**Reduction: 98.5%**

---

## Migration Path

### Phase 1: Current (Next.js + SWR)
**Timeline:** Now  
**Status:** Production

**Keep:**
- Next.js API routes
- SWR for caching
- Current database layer

**Focus:**
- Ship features
- Stabilize current architecture
- Monitor Zero's development

---

### Phase 2: Hono + SWR (Planned)
**Timeline:** Q1-Q2 2026  
**Status:** Planning

**Changes:**
- Replace Next.js with Hono for API
- Keep SWR for caching
- Add WebSocket for critical real-time features

**Benefits:**
- Faster API responses
- More control
- Simpler deployment

**Effort:** ~2-3 weeks migration

---

### Phase 3: Zero (Future Vision)
**Timeline:** Q3-Q4 2026 (when Zero reaches stable)  
**Status:** Research

**Prerequisites:**
- Zero reaches v1.0 stable
- Production case studies available
- Self-hosting documentation mature
- Migration tooling exists

**Migration Strategy:**

1. **Prototype (Week 1-2)**
   - Set up Zero in development
   - Migrate one feature (e.g., messages)
   - Validate performance and DX

2. **Parallel Run (Week 3-4)**
   - Run Zero alongside Hono API
   - Migrate non-critical features
   - Monitor stability

3. **Critical Features (Week 5-8)**
   - Migrate auth/session
   - Migrate real-time features
   - Performance testing

4. **Full Migration (Week 9-12)**
   - Migrate remaining features
   - Delete API routes
   - Production deployment

**Effort:** ~3 months full migration

---

## What Gets Deleted

### API Routes (~5,000 lines)
```
/apps/chrry-dot-dev/app/api/
├── session/route.ts          ❌ Delete
├── messages/route.ts         ❌ Delete
├── threads/route.ts          ❌ Delete
├── tasks/route.ts            ❌ Delete
├── guests/route.ts           ❌ Delete
├── subscriptions/route.ts    ❌ Delete
├── ai-agents/route.ts        ❌ Delete
├── memories/route.ts         ❌ Delete
├── character-profiles/route.ts ❌ Delete
└── ... (all other endpoints) ❌ Delete
```

### WebSocket Infrastructure (~500 lines)
```
/apps/chrry-dot-dev/lib/
├── websocket-server.ts       ❌ Delete
├── websocket-client.ts       ❌ Delete
└── realtime-handlers.ts      ❌ Delete
```

### Cache Invalidation Logic (~300 lines)
```typescript
// All manual mutate() calls throughout codebase
mutate('/api/messages')
mutate('/api/threads')
mutate('/api/session')
// etc.
```

---

## What Gets Added

### Zero Setup (~100 lines)

**`/packages/zero/setup.ts`**
```typescript
import { Zero } from '@rocicorp/zero'
import { schema } from '@repo/db/schema'

export const zero = new Zero({
  server: process.env.ZERO_SERVER_URL,
  schema: {
    version: 1,
    tables: {
      guests: schema.guests,
      members: schema.members,
      messages: schema.messages,
      threads: schema.threads,
      tasks: schema.tasks,
      // ... other tables
    }
  },
  auth: async () => {
    // Return auth token
    return getAuthToken()
  }
})
```

### Query Definitions (~500 lines)

**`/packages/zero/queries.ts`**
```typescript
// Session query
export const sessionQuery = zero.query.session
  .related('guest')
  .related('member')
  .related('app', app => app
    .related('store', store => store
      .related('apps')))
  .one()

// Messages query
export const messagesQuery = (threadId: string) =>
  zero.query.message
    .where('threadId', threadId)
    .related('sender')
    .orderBy('createdAt', 'desc')

// Threads query
export const threadsQuery = (userId: string) =>
  zero.query.thread
    .where('userId', userId)
    .related('messages', msg => msg
      .orderBy('createdAt', 'desc')
      .limit(1))
    .orderBy('updatedAt', 'desc')

// Tasks query
export const tasksQuery = (guestId: string) =>
  zero.query.task
    .where('guestId', guestId)
    .related('thread')
    .orderBy('createdAt', 'desc')

// ... other queries
```

### Updated Components (~minimal changes)

**Before:**
```typescript
const { data: messages } = useSWR(
  `/api/messages?threadId=${threadId}`,
  fetcher
)
```

**After:**
```typescript
const [messages] = useQuery(messagesQuery(threadId))
```

---

## Performance Expectations

### Current (Next.js + SWR)
- **First load:** 200-500ms (API call)
- **Cached load:** 0ms (SWR cache)
- **Real-time:** N/A (not implemented)
- **Optimistic updates:** Manual

### With Zero
- **First load:** 50-100ms (IndexedDB cache)
- **Cached load:** 0ms (instant)
- **Real-time:** Automatic (WebSocket)
- **Optimistic updates:** Automatic

**Expected improvement:**
- 2-5x faster first loads
- Instant subsequent loads
- Built-in real-time
- No manual cache management

---

## Risks & Mitigation

### Risk 1: Alpha Software
**Impact:** High  
**Probability:** High

**Mitigation:**
- Wait for v1.0 stable release
- Monitor Zero's GitHub for issues
- Test thoroughly in development
- Keep Hono API as fallback

### Risk 2: Self-Hosting Complexity
**Impact:** Medium  
**Probability:** Medium

**Mitigation:**
- Start with single Zero instance
- Use Docker for deployment
- Document deployment process
- Plan for scaling later

### Risk 3: Migration Effort
**Impact:** Medium  
**Probability:** Low

**Mitigation:**
- Migrate incrementally
- Run parallel systems
- Automated testing
- Rollback plan ready

### Risk 4: Vendor Lock-in
**Impact:** Medium  
**Probability:** Medium

**Mitigation:**
- Zero is open-source (can fork)
- Self-hosted (we control it)
- Database stays PostgreSQL
- Can revert to API layer if needed

### Risk 5: Learning Curve
**Impact:** Low  
**Probability:** Medium

**Mitigation:**
- Team training period
- Documentation
- Gradual adoption
- Pair programming

---

## Decision Criteria

**We migrate to Zero when:**

1. ✅ Zero reaches v1.0 stable
2. ✅ At least 3 production case studies exist
3. ✅ Self-hosting is well-documented
4. ✅ Migration tooling is available
5. ✅ Team is trained and ready
6. ✅ We have 3 months for migration
7. ✅ Fallback plan is tested

**We don't migrate if:**

1. ❌ Zero remains in alpha/beta
2. ❌ No production success stories
3. ❌ Self-hosting is too complex
4. ❌ Performance doesn't meet expectations
5. ❌ Team isn't comfortable with it

---

## Success Metrics

**After migration, we should see:**

1. **Code reduction:** 80-90% less infrastructure code
2. **Development speed:** 2-3x faster feature development
3. **Performance:** 2-5x faster data loading
4. **Real-time:** All features reactive by default
5. **Bugs:** Fewer cache invalidation bugs
6. **Maintenance:** Less API maintenance overhead

**If we don't see these improvements, we revert.**

---

## Resources

- **Zero Docs:** https://zerosync.dev
- **Zero GitHub:** https://github.com/rocicorp/zero
- **Zero Discord:** (join for support)
- **Case Studies:** (track as they emerge)

---

## Next Steps

1. **Monitor Zero development** (monthly check-ins)
2. **Complete Phase 2 migration** (Hono + SWR)
3. **Build prototype** when Zero hits beta
4. **Evaluate results** before committing
5. **Plan full migration** if prototype succeeds

---

## Conclusion

Zero represents a fundamental shift in web architecture - eliminating the API layer entirely. For Vex, this could mean:

- **~5,000 lines deleted**
- **Months of development time saved**
- **Built-in real-time features**
- **Faster, more reactive UX**

But it's alpha software. We wait, we watch, we prototype, and we decide based on data.

**Timeline:** Not now. Not next quarter. But when Zero is ready, we'll be ready too.

---

**Last Updated:** November 15, 2025  
**Next Review:** Q1 2026  
**Owner:** Engineering Team
