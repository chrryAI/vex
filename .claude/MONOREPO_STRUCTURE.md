# Monorepo Structure

## Apps (10 Applications)

### 1. flash

**Main PWA Application**

- Port: 3000
- Tech: React + Vite SSR + Express
- Server-side rendered Progressive Web App
- Dynamic manifest generation for polymorphic PWAs
- Entry point: `apps/flash/src/entry-server.jsx`

### 2. api

**Core API & Marketing Site**

- Port: 3001
- Tech: Hono + Bun runtime
- 45+ API route handlers
- WebSocket server for real-time features
- AI streaming and tool execution
- Entry point: `apps/api/index.ts`

### 3. mobile

**Native Mobile App**

- Tech: React Native + Capacitor
- iOS and Android support
- Firebase Authentication integration
- Shared UI components with web

### 4. extension

**Browser Extension**

- Chrome & Firefox support
- 12+ app variants (Atlas, Bloom, Vault, etc.)
- Manifest V3 compliant
- Built with Vite

### 5. browser

**Tauri Desktop App**

- Cross-platform desktop (macOS, Windows, Linux)
- 12+ app variants
- DMG packaging for macOS
- Native desktop experience

### 6. agent

**Autonomous AI Agents**

- Job hunting automation (Zarathustra)
- Playwright-based automation
- Agent XP and leveling system

### 7. bridge

**Native Bridge**

- Platform integrations
- Native API access

### 8. calendar

**Calendar Features**

- Calendar-specific functionality
- Event management

### 9. focus

**Focus/Productivity**

- Focus timers
- Pomodoro technique
- Productivity tracking

### 10. scripts

**Build & Deployment**

- Shared scripts across all apps
- Automation utilities

## Packages (12 Shared Packages)

### 1. @chrryai/chrry (ui)

**Universal Design System**

- 151+ React components
- Cross-platform (web, native, extensions)
- SCSS to universal styles converter
- Version: 1.11.8 (published to npm)
- Framer Motion animations
- Context providers for app state

### 2. @chrryai/pepper

**Universal Router**

- 0ms navigation with View Transitions API
- Works on web, React Native, browser extensions
- 2KB bundle size
- Native-feeling transitions
- Platform-agnostic routing

### 3. @repo/db

**Database Layer**

- Drizzle ORM with PostgreSQL
- Neon serverless database
- Redis caching (Upstash)
- Vector memory support
- Comprehensive schema (users, threads, messages, apps, etc.)

### 4. eslint-config

**Shared ESLint Configuration**

- Consistent linting rules across monorepo

### 5. typescript-config

**Shared TypeScript Configuration**

- Shared tsconfig settings

### 6. auth

**Authentication Utilities**

- Auth helpers and utilities

### 7. cache

**Caching Utilities**

- Redis cache management

### 8. calendar

**Calendar Utilities**

- Calendar helpers

### 9. focus

**Focus/Timer Utilities**

- Focus mode helpers

### 10. shared

**Shared Utilities**

- Common utilities used across apps

### 11. waffles

**Testing Utilities**

- E2E testing with Playwright
- Test fixtures and helpers

### 12. additional packages

- Various specialized packages for different features

## Directory Structure

```
vex/
├── apps/                    # Applications
│   ├── api/                # Core API (Hono + Bun)
│   ├── flash/              # Main PWA (React + Vite SSR)
│   ├── mobile/             # React Native + Capacitor
│   ├── extension/          # Browser extensions
│   ├── browser/            # Tauri desktop app
│   ├── agent/              # Autonomous agents
│   ├── bridge/             # Native bridge
│   ├── calendar/           # Calendar app
│   ├── focus/              # Focus app
│   └── scripts/            # Shared scripts
├── packages/               # Shared packages
│   ├── ui/                 # @chrryai/chrry design system
│   ├── pepper/             # @chrryai/pepper router
│   ├── db/                 # @repo/db database layer
│   ├── auth/               # Authentication utilities
│   ├── cache/              # Caching utilities
│   └── ...                 # Other packages
├── docs/                   # Documentation
├── scripts/                # Root-level scripts
└── public/                 # Static assets

## Build System

**Turbo 2.5.6:**
- Parallel builds across apps
- Incremental compilation
- Remote caching support
- Task dependencies management

**Package Manager:**
- pnpm 9.15.0
- Workspace protocol for inter-package dependencies

## Key Scripts

- `pnpm dev` - Start API + Flash in development
- `pnpm build` - Build all apps
- `pnpm generate` - Generate Drizzle types
- `pnpm migrate` - Run database migrations
- `pnpm seed` - Seed database with test data
- `pnpm s:all` - Convert all SCSS to universal styles
- `pnpm publish` - Publish npm packages
```
