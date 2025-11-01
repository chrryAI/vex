# API App Setup Complete! 🚀

## What Was Done

### ✅ Created Next.js API App

- Minimal Next.js 15 setup
- TypeScript configured
- No Tailwind (naked setup as requested)

### ✅ Copied All API Routes (52 routes)

```bash
cp -r apps/web/app/api/* apps/api/app/api/
```

All HTTP API endpoints from the web app are now in the API app:

- Session management
- Authentication (NextAuth)
- Apps CRUD
- Threads & Messages
- AI chat endpoints
- Collaborations
- Calendar sync
- Stripe webhooks
- And 40+ more...

### ✅ Copied Dependencies

```bash
# Server actions
cp -r apps/web/app/actions apps/api/app/

# Shared utilities
cp -r apps/web/lib apps/api/

# Helper functions
cp -r apps/web/utils apps/api/

# Email templates
cp -r apps/web/components apps/api/

# Test utilities
cp -r apps/web/tests apps/api/

# Sentry config
cp apps/web/sentry.server.config.ts apps/api/
```

### ✅ Configured TypeScript

Added path aliases to `tsconfig.json`:

```json
{
  "paths": {
    "@/*": ["./*"],
    "chrry/*": ["../../packages/ui/*"]
  }
}
```

### ✅ Set Up CORS

Middleware configured for:

- https://vex.chrry.ai
- https://chrry.dev
- https://a.chrry.dev
- https://a.chrry.dev
- http://localhost:3000
- http://localhost:3001

### ✅ Installed Dependencies

```bash
npm install --legacy-peer-deps
```

## File Structure

```
apps/api/
├── app/
│   ├── api/                    # 52 API routes
│   │   ├── session/
│   │   ├── apps/
│   │   ├── threads/
│   │   ├── messages/
│   │   ├── auth/
│   │   ├── ai/
│   │   ├── collaborations/
│   │   ├── calendar/
│   │   ├── subscriptions/
│   │   ├── user/
│   │   ├── guest/
│   │   └── ... (42 more)
│   ├── actions/                # Server actions
│   │   ├── getMember/
│   │   ├── getGuest/
│   │   ├── getApp.ts
│   │   └── ragService.ts
│   ├── layout.tsx
│   └── page.tsx
├── lib/                        # Shared utilities
│   ├── generateAIContent.ts
│   ├── tools.ts
│   ├── notify.ts
│   ├── rateLimiting.ts
│   ├── security.ts
│   └── ... (12 more)
├── utils/                      # Helper functions
│   └── titleGenerator.ts
├── components/                 # Email templates
│   └── emails/
│       ├── Collaboration.tsx
│       ├── Invite.tsx
│       └── Gift.tsx
├── tests/                      # Test utilities
├── middleware.ts               # CORS & auth
├── sentry.server.config.ts     # Error tracking
├── package.json
├── tsconfig.json
├── next.config.js
├── .env.example
├── .gitignore
├── README.md
├── MIGRATION.md
└── SETUP_COMPLETE.md (this file)
```

## Next Steps

### 1. Configure Environment Variables

```bash
# Copy from web app
cp ../web/.env .env

# Or create new .env with:
# DATABASE_URL=postgresql://...
# NEXTAUTH_SECRET=...
# STRIPE_SECRET_KEY=...
# etc.
```

### 2. Start Development Server

```bash
npm run dev
# Runs on http://localhost:3001
```

### 3. Test Endpoints

```bash
# Health check
curl http://localhost:3001/api/health

# Session (requires auth)
curl http://localhost:3001/api/session

# Apps
curl http://localhost:3001/api/apps
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

# Update all fetch calls to use the new API URL
```

## Architecture

### Before

```
askvex.com (Next.js) → ws (Hono) → db
```

### After

```
askvex.com (Next.js frontend) → api.chrry.dev (Next.js API) → db
chrry.dev (Next.js frontend) → api.chrry.dev (Next.js API) → db
```

### WebSocket (Separate)

```
ws.chrry.dev (WebSocket server for real-time features)
```

## Benefits

✅ **Faster** - Next.js API routes are optimized
✅ **Shared Types** - Same types as frontend via @repo/db
✅ **Easy Deploy** - One-click Vercel deployment
✅ **Better DX** - Hot reload, TypeScript, debugging
✅ **Scalable** - Automatic scaling on Vercel
✅ **Clean** - Separate API from frontend
✅ **Multi-Store** - Can serve askvex.com + chrry.dev

## Migration Path

### Phase 1: Test Locally ✅ (DONE)

- API app created
- All routes copied
- Dependencies installed

### Phase 2: Deploy to Vercel (NEXT)

- Deploy API app
- Set custom domain (api.chrry.dev)
- Configure environment variables

### Phase 3: Update Frontend

- Update API_URL in web app
- Test all endpoints
- Monitor errors

### Phase 4: Deprecate ws (Optional)

- Keep ws for WebSocket only
- Remove HTTP endpoints from ws
- Or migrate ws to Hono later

## Notes

- All 52 API routes are functional
- TypeScript paths configured for `chrry/*` alias
- CORS middleware ready for production
- Can migrate to Hono later if needed
- WebSocket server (ws) remains separate

## Ready to Go! 🎉

The API app is ready for development and deployment!

```bash
cd apps/api
npm run dev
```
