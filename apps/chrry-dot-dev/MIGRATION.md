# API Migration Guide

## What We Did

Created a dedicated Next.js API app to replace the ws (WebSocket server) for HTTP API endpoints.

## Structure

```
apps/api/
├── app/
│   ├── api/              # All API routes (copied from web)
│   │   ├── session/      # Session management
│   │   ├── apps/         # App CRUD
│   │   ├── threads/      # Thread management
│   │   ├── messages/     # Message handling
│   │   ├── auth/         # Authentication
│   │   ├── ai/           # AI endpoints
│   │   └── ...           # 35+ other routes
│   ├── actions/          # Server actions
│   ├── layout.tsx
│   └── page.tsx
├── lib/                  # Shared utilities
├── utils/                # Helper functions
├── components/           # Email templates
├── tests/                # Test utilities
├── middleware.ts         # CORS & auth
├── sentry.server.config.ts
├── package.json
└── README.md
```

## Copied Routes (52 total)

All routes from `apps/web/app/api/*` have been copied:

- ✅ `/api/session` - Session management
- ✅ `/api/apps` - App management
- ✅ `/api/threads` - Thread operations
- ✅ `/api/messages` - Message handling
- ✅ `/api/auth` - NextAuth
- ✅ `/api/ai` - AI chat
- ✅ `/api/collaborations` - Collaboration
- ✅ `/api/calendar` - Calendar sync
- ✅ `/api/user` - User management
- ✅ `/api/guest` - Guest handling
- ✅ `/api/subscriptions` - Stripe
- ✅ `/api/memories` - Memory system
- ✅ And 40+ more...

## Next Steps

### 1. Install Dependencies

```bash
cd apps/api
npm install --legacy-peer-deps
```

### 2. Configure Environment

```bash
cp .env.example .env
# Add DATABASE_URL and other env vars
```

### 3. Test Locally

```bash
npm run dev
# API runs on http://localhost:3001
```

### 4. Deploy to Vercel

```bash
vercel --prod
# Set custom domain: api.chrry.dev
```

### 5. Update Frontend

```bash
# In apps/web/.env
NEXT_PUBLIC_API_URL=https://api.chrry.dev

# In apps/web (update all fetch calls)
# From: fetch('/api/session')
# To: fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/session`)
```

### 6. Update CORS

The middleware already includes:

- https://vex.chrry.ai
- https://chrry.dev
- http://localhost:3000
- http://localhost:3001

Add more domains as needed.

## Benefits

### Performance

- ✅ Faster cold starts (Next.js optimized)
- ✅ Edge runtime support
- ✅ Automatic caching
- ✅ Better TypeScript integration

### Developer Experience

- ✅ Same framework as frontend
- ✅ Shared types with @repo/db
- ✅ Hot reload
- ✅ Easy debugging

### Deployment

- ✅ Deploy to Vercel (easy)
- ✅ Automatic scaling
- ✅ Built-in monitoring
- ✅ Zero-config SSL

### Architecture

- ✅ Separate API from frontend
- ✅ Can serve multiple frontends
- ✅ Clean separation of concerns
- ✅ Easy to migrate to Hono later

## Migration Path to Hono (Future)

When ready to migrate to Hono for even better performance:

```typescript
// apps/api/app/api/[...route]/route.ts
import { Hono } from "hono"
import { handle } from "hono/vercel"

const app = new Hono().basePath("/api")

// Copy all routes here
app.get("/session", async (c) => {
  // Session logic
})

export const GET = handle(app)
export const POST = handle(app)
```

## WebSocket Server (ws)

The ws app will remain for WebSocket connections:

- Real-time notifications
- Live collaboration
- Message streaming

HTTP API → api.chrry.dev (Next.js)
WebSocket → ws.chrry.dev (ws server)

## Testing

```bash
# Health check
curl http://localhost:3001/api/health

# Get apps
curl http://localhost:3001/api/apps

# Get stores
curl http://localhost:3001/api/stores
```

## Deployment Checklist

- [ ] Install dependencies
- [ ] Configure .env
- [ ] Test locally
- [ ] Deploy to Vercel
- [ ] Set custom domain (api.chrry.dev)
- [ ] Update frontend API_URL
- [ ] Test all endpoints
- [ ] Monitor errors
- [ ] Update documentation
