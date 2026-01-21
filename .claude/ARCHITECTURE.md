# Architecture Patterns

## 1. Polymorphic PWA Architecture

The breakthrough innovation - one codebase generates infinite independent apps.

### How It Works

**Dynamic Manifest Generation:**

- Endpoint: `/api/manifest/[id]`
- Server generates unique PWA manifests on the fly
- Each manifest has unique name, icon, theme, and start URL

**Context Switching:**

- App detects which "personality" to adopt based on install context
- App ID determines which configuration to load
- Separate app state and memory per installation

**Separate Installations:**

- Each app installs separately on user device
- Unique name, icon, and theme
- Independent navigation and memory
- Shared infrastructure (auth, DB, API)

**Examples:**

- 🌍 Atlas (Travel Agent) - atlas.chrry.ai
- 🍑 Peach (Social Assistant) - peach.chrry.ai
- 🌸 Bloom (Wellness Coach) - bloom.chrry.ai
- 🏦 Vault (Finance Manager) - vault.chrry.ai
- 🎬 Popcorn (Entertainment) - popcorn.chrry.ai
- 🔍 Search (Web Search) - search.chrry.ai

## 2. Domain-Based Routing

Single server handles multiple domains automatically without environment variables.

### Routing Logic

```
chrry.ai → chrryAI mode
vex.chrry.ai → vex mode
focus.chrry.ai → chrryAI mode (focus app)
bloom.chrry.ai → chrryAI mode (bloom app)
atlas.chrry.ai → atlas app mode
```

**Implementation:**

- Automatic domain detection from request headers
- No environment variables needed
- Single deployment handles all domains
- Dynamic routing based on subdomain

**Benefits:**

- Simplified deployment
- Easy to add new apps
- Centralized infrastructure
- Cost-effective scaling

## 3. Cross-Conversation Memory System

Intelligent context management across threads.

### Memory Architecture

**Vector Embeddings:**

- Semantic search using embeddings
- Find relevant memories by meaning, not keywords
- PostgreSQL vector support (pgvector)

**Redis Caching:**

- Fast memory retrieval
- Reduced database load
- Session-based caching

**Memory Scattering:**

- Memories distributed across threads
- Context retrieval from multiple conversations
- Thread-specific and global memories

**Time-Weighted Scoring:**

- Recent memories prioritized
- Decay function for older memories
- Usage-based reinforcement

**Adaptive Memory:**

- 5-25 memories per conversation
- Dynamic based on context relevance
- Token budget management

## 4. Builder Economy Architecture

Revolutionary economic model with 70/30 revenue split.

### Components

**Stripe Connect:**

- Automated payouts to builders
- 70% revenue share
- Transparent transaction tracking

**BYOK Model:**

- Users provide own API keys
- No platform markup on AI costs
- Builders optimize margins by choosing models

**App Inheritance:**

- Apps can extend parent apps
- Inherit capabilities and tools
- Build on existing functionality

**Revenue Tracking:**

- Database: `feedbackTransactions` table
- Track subscriptions, usage, payouts
- Builder dashboard with analytics

## 5. Universal Component System

Write once, run everywhere.

### Cross-Platform Strategy

**SCSS → Universal Styles:**

- Automatic conversion from SCSS to universal styles
- Platform-specific optimizations
- Consistent design language

**Platform Detection:**

- Web, Native, Extension detection
- Conditional rendering based on platform
- Platform-specific APIs

**Shared Business Logic:**

- Business logic separate from UI
- Reusable across all platforms
- Type-safe with TypeScript

**Component Library:**

- 151+ universal components
- `@chrryai/chrry` package
- Published to npm (version 1.11.8)

## 6. Real-Time Communication

WebSocket-based real-time features.

### WebSocket Architecture

**Connection Management:**

- WebSocket server in API app
- Persistent connections per user
- Automatic reconnection logic

**Message Streaming:**

- AI responses streamed in real-time
- Token-by-token updates
- Server-Sent Events (SSE) fallback

**Collaboration:**

- Multi-user thread access
- Real-time co-editing
- Presence indicators

## 7. AI Tool System

Extensible tool architecture for AI agents.

### Available Tools (20+)

**Calendar Tools:**

- createCalendarEvent
- updateCalendarEvent
- deleteCalendarEvent

**Financial Tools:**

- createExpense, updateExpense, deleteExpense
- createBudget, updateBudget, deleteBudget
- createSharedExpense, markSplitAsPaid
- getExpenseSummary, getBudgetStatus

**Productivity Tools:**

- createTask, updateTask, deleteTask
- createTimer, updateTimer, getTimer

**Mood Tracking:**

- createMood, getMoods, getLastMood, updateMood

**Location & Weather:**

- getCurrentLocation, searchLocations
- getWeather

**Web Search:**

- Perplexity integration for real-time web search

### Tool Execution Flow

1. User sends message
2. AI determines which tools to use
3. Server executes tools with validation
4. Results returned to AI
5. AI formulates response with tool outputs
6. Stream response to client

## 8. Database Architecture

**ORM:** Drizzle ORM 0.44.4
**Database:** PostgreSQL 14+ (Neon serverless)
**Caching:** Redis (Upstash)

### Key Tables

- `users` - User accounts with credits, subscriptions
- `guests` - Anonymous users
- `threads` - Conversations
- `messages` - Chat messages with AI responses
- `apps` - Polymorphic app definitions
- `aiAgents` - AI model configurations with RPG stats
- `memories` - Vector-embedded context
- `artifacts` - Uploaded files and documents
- `calendarEvents` - Calendar entries
- `expenses` - Financial tracking
- `budgets` - Budget management
- `subscriptions` - Stripe subscriptions
- `feedbackTransactions` - Builder payouts
- `collaborations` - Team collaboration
- `characterProfiles` - Personality analysis

## 9. Security Architecture

**Rate Limiting:**

- Arcjet protection
- Upstash rate limiting
- Per-user and per-endpoint limits

**Authentication:**

- JWT tokens
- Session management
- Firebase Auth for mobile

**Input Sanitization:**

- sanitize-html for user input
- XSS prevention
- SQL injection protection via Drizzle

**File Upload Security:**

- Malware scanning
- File type validation
- Size limits
- S3/MinIO storage

**Bot Detection:**

- BotID integration
- Automated bot blocking
