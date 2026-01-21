# Vex Project Overview

## What is Vex?

Vex is a revolutionary, open-source AI platform that implements a **sovereign, self-sustaining economic model** where users provide their own AI models (BYOK - Bring Your Own Key). It's built as a **polymorphic PWA monorepo** that can spawn infinite independent AI applications from a single codebase.

**Version:** 1.11.8  
**License:** AGPL-3.0  
**Built by:** Solo developer

## Core Innovation: Polymorphic PWA Architecture

One codebase generates infinite independent apps:

- 🌍 Atlas (Travel Agent)
- 🍑 Peach (Social Assistant)
- 🌸 Bloom (Wellness Coach)
- 🏦 Vault (Finance Manager)
- 🎬 Popcorn (Entertainment)
- 🔍 Search (Web Search)
- And more...

Each app installs separately with its own name, icon, theme, and memory despite running on shared infrastructure.

## Revolutionary Economic Model

**70/30 Revenue Split:**

- 70% to builders - Creators keep majority of revenue
- 30% to platform - Covers infrastructure (DB, auth, hosting)

**BYOK Model (Bring Your Own Key):**

- Users/builders provide own API keys (OpenAI, Anthropic, DeepSeek)
- No taxation on intelligence usage
- Optimize your own margins by selecting efficient models

**Builder Benefits:**

- Stripe Connect automated payouts
- App inheritance (extend existing apps)
- No middlemen - Direct user-to-builder relationship

## Tech Stack

### Frontend

- **React 19.2.0** - Latest with Server Components
- **Vite 7.x** - Ultra-fast build tool with SSR
- **TypeScript 5.8.3** - Strict type safety
- **React Native 0.78.3** - Mobile development
- **Capacitor 7.4.5** - Native mobile bridge
- **Tauri 2.0** - Desktop applications

### Backend

- **Hono 4.7.11** - Ultra-fast web framework
- **Bun** - JavaScript runtime (for API)
- **Express 5.x** - HTTP server (flash app)
- **Drizzle ORM 0.44.4** - Type-safe database access
- **PostgreSQL 14+** - Primary database (Neon)
- **Redis** - Caching layer (Upstash)

### AI/ML

- **Vercel AI SDK 5.0** - Unified AI interface
- **OpenAI** - GPT models
- **Anthropic** - Claude models
- **DeepSeek** - Cost-effective reasoning
- **Google Gemini** - Multimodal AI
- **Perplexity** - Web search AI
- **Replicate** - Image generation (Flux Schnell)

### Infrastructure

- **Turbo 2.5.6** - Monorepo build system
- **pnpm 9.15.0** - Package manager
- **Docker** - Containerization
- **Stripe** - Payments & Connect
- **Firebase Auth** - Mobile authentication

## Platform Support

- **Web**: Progressive Web Apps (PWA)
- **Mobile**: iOS and Android via Capacitor
- **Desktop**: macOS, Windows, Linux via Tauri
- **Browser Extensions**: Chrome & Firefox

## Key Features

- Multi-model AI support (GPT, Claude, DeepSeek, Gemini, Perplexity)
- Real-time streaming responses via WebSocket
- Vector-based semantic memory
- Multimodal capabilities (text, image, PDF, video, audio)
- Productivity tools (calendar, tasks, timers, mood tracking)
- Financial tools (expenses, budgets, shared splits)
- Collaborative conversations
- Thread-based organization
- Cross-platform universal components (151+ components)
