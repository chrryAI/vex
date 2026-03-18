[![Hetzner](https://img.shields.io/badge/Hetzner-D30428?logo=Hetzner&logoColor=white)](https://hetzner.cloud/?ref=jBud3ivK4tnH)
[![Patent Pending](https://img.shields.io/badge/Patent-Pending-gold?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik02IDlIMnY5YTIgMiAwIDAgMCAyIDJoOGEyIDIgMCAwIDAgMi0yVjlIOHoiLz48cGF0aCBkPSJNNiAzaDh2NmgtOHoiLz48L3N2Zz4=)](https://patents.google.com/)
[![Powered by Arcjet](https://img.shields.io/badge/Powered%20by-Arcjet-0A2540?style=flat&logo=shield&logoColor=white)](https://arcjet.com)

# Vex

> 🏆 **Patent Pending** - US Application #64/000,114  
> _Spatial Intelligence System with Self-Evolving App Ecosystem_

A sovereign, self-sustaining AI platform powered by user-provided models.

## The Ecosystem

```
🦄 Vex Core (Infrastructure)
├──── 🌍 Atlas (Travel Agent)
├──── 🍑 Peach (Social Assistant)
├── 🌸 Bloom (Wellness Coach)
└── 🏦 Vault (Finance Manager)
```

## 💸 The Builder Economy (70% Rev Share)

Vex is not just a tool; it is a marketplace.

70% Revenue Share: Builders keep the lion's share of subscription revenue.

BYOK (Bring Your Own Key): We operate on a sovereign model. Users/Builders provide their own API keys (OpenAI, Anthropic, DeepSeek).

Benefit: We don't tax your intelligence.

Benefit: You optimize your own margins by selecting efficient models.

Inheritance: New apps can "extend" existing apps, inheriting their capabilities and tools.

## 🧠 Philosophy: Friction as Feature

> "Does this feature cause brain damage?"
> "It should. That's how they learn."

Vex operates on a counterintuitive principle: **friction is not failure, it's feedback**.

Small errors, navigation dead-ends, and user corrections aren't bugs—they're essential signals for organic growth. Our multi-agent ecosystem (Chrry, Vex, Grape, Pear, Sushi) doesn't compete; it **specializes and cooperates**, creating a closed-loop learning economy.

**What users love most:** RAG + Knowledge Graph. Upload documents, and watch the system build connections you didn't know existed. The "brain damage" becomes neural pathways.

The future isn't a hierarchy of AIs; it's an **ecology**.

## ✨ Features

🤖 Model Agnostic: First-class support for OpenAI, Claude, DeepSeek, Gemini, and Perplexity.

🔑 API Key Support:

- **Official Providers**: Bring your own API keys for OpenAI, Anthropic, DeepSeek, Google (Gemini), and Perplexity
- **OpenRouter**: Single API key for access to all models with unified billing
- **Coming Soon**: Custom OpenAI-compatible endpoints (LocalLLM, Ollama, vLLM) and per-app API keys

🧠 Vector Memory: Smart context management that persists across sessions.

📚 RAG (Retrieval-Augmented Generation): Upload documents (PDF, images, video) and chat with your files using hybrid vector + graph search.

🕸️ Knowledge Graph: FalkorDB-powered entity extraction and relationship mapping for advanced context understanding.

🌍 Multi-App PWA: The only open-source implementation of dynamic manifest injection.

🔒 Privacy First: User-controlled keys mean user-controlled data. Burn mode for incognito conversations.

⚡ Real-Time: WebSocket-powered collaboration and streaming.

🥋 **Sato Dojo**: AI-powered mutation testing system where agents learn through code strikes

- **Students (Coder agents)**: Strike code, gain XP, level up
- **Senseis (Architect agents)**: Strategic high-value mutations
- **Organic Learning**: System learns from failures, improves mutation quality
- **Integration Ready**: BAM (bug detection), STRIKE (mutation engine), Memory (learning system)

## ⚡ Quick Start

### 🏠 Self-Hosted (Recommended)

Run Vex entirely on your local machine with Docker. **No cloud dependencies required.**

```bash
# Clone and install
git clone https://github.com/chrryai/vex.git
cd vex
pnpm install

# Start local infrastructure (PostgreSQL, Redis, MinIO, FalkorDB, Mailhog)
pnpm local:setup

# Add your API keys to .env.local
# OPENAI_API_KEY=sk-...

# Start development
pnpm dev:all
```

**That's it!** Everything runs locally. See [SELF_HOSTING.md](SELF_HOSTING.md) for full guide.

### ☁️ Cloud Setup (Alternative)

Prerequisites:
- Node.js 18+
- pnpm 9+
- PostgreSQL 14+ (with `pgvector` extension)
- FalkorDB (for Knowledge Graph RAG)

```bash
git clone https://github.com/chrryai/vex.git
cd vex
pnpm install
Environment Setup

Bash

# Generates necessary .env files from templates

pnpm run setup:env
Edit the .env files to add your DB_URL and OPENAI_API_KEY (or set VITE_TESTING_ENV='e2e' for mock mode).

Database Initialization

**PostgreSQL + pgvector:**

Bash

# Install pgvector extension

psql -d your_database -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations

cd packages/db
pnpm run generate # Generate Drizzle artifacts
pnpm run migrate # Push to Postgres
pnpm run seed # Populate default apps
cd ../..

**FalkorDB (Knowledge Graph):**

Bash

# Using Docker (recommended)

docker run -p 6379:6379 -it --rm falkordb/falkordb:latest

# Or install locally via Homebrew (macOS)

brew tap FalkorDB/falkordb
brew install falkordb

# Add to .env

FALKORDB_URL=redis://localhost:6379
FALKORDB_GRAPH_NAME=vex_knowledge_graph
Launch

Bash

pnpm run dev:all
Web App: http://localhost:3000

Marketing/API: http://localhost:3001

🏗️ Architecture
Vex is a modern monorepo built for scale and separation of concerns.

Stack:

Frontend: Vite, React 19

Backend: Bun, Hono, WebSocket Server

Data: PostgreSQL (pgvector), FalkorDB (Knowledge Graph), Drizzle ORM, Redis (Upstash)

State: React Context + Server Actions

Project Structure:

Plaintext

vex/
├── apps/
│ ├── api/ # Core API & Marketing (Hono, Port 3001)
│ ├── flash/ # Main PWA (Vite + React, Port 5173)
│ ├── mobile/ # React Native (Expo)
│ ├── extension/ # Browser Extension (Chrome/Firefox)
│ └── browser/ # Desktop App (Tauri)
├── packages/
│ ├── ui/ # Shared Design System (@chrryai/chrry)
│ ├── db/ # Drizzle Schema & Migrations
│ ├── pepper/ # Universal Routing Logic
│ ├── waffles/ # E2E Testing (Playwright)
│ ├── auth/ # Better Auth Configuration
│ ├── calendar/ # Calendar Utilities
│ ├── focus/ # Focus Mode Logic
│ ├── shared/ # Shared Utilities
│ ├── cache/ # Caching Layer
│ ├── typescript-config/ # Shared TypeScript Config
│ └── eslint-config/ # Shared ESLint Config
└── scripts/ # DevOps & Automation

## ⚖️ License & Attribution

License: AGPL-3.0. Use it, learn from it, but if you distribute it, share your changes.

Icons: This project uses premium icons from Wannathis.

Note: If you fork this project for commercial use, you must purchase your own license for these assets or replace them.

Support: Issues • Email • Twitter

## Support The Project

Vex is built entirely open source by a solo developer, pioneering a new economic model for AI. If you find value in this platform, support it directly by **buying credits** at [vex.chrry.ai](https://vex.chrry.ai).

No sponsors. No middlemen. Just users supporting the product they use.

## 🚀 One Codebase, Unlimited Apps

Vex introduces a breakthrough **Polymorphic PWA, Web, Extension, Desktop, Mobile Architecture** with **Spatial Navigation**. It enables a single codebase to spawn infinite, independent applications on a user's device.

### 🧭 Spatial Navigation System

Apps exist in a 3D coordinate system:

- **X-Axis (Apps)**: Navigate between apps (Vex → Atlas → Bloom)
- **Y-Axis (Stores)**: Navigate between domains/stores (chrry.ai → vex.chrry.ai → atlas.chrry.ai)
- **Z-Axis (Depth)**: Navigate into code structure (/ → /.sushi → /.sushi/mutations)

**Examples:**

- `chrry.ai` → Blossom store, Chrry app
- `vex.chrry.ai` → LifeOS store, Vex app
- `atlas.chrry.ai` → Compass store, Atlas app
- `chrry.ai/atlas` → Blossom store, Atlas app (different context!)
- `vex.chrry.ai/.sushi` → LifeOS store, Vex app, Sato Dojo depth

### 🏗️ Architecture Features

📱 **Dynamic Manifest Generation**: The server generates unique PWA manifests on the fly (/api/manifest/[id]).

🔄 **Context Switching**: The app detects which "personality" (Atlas, Bloom, Vault) it should adopt based on the install context.

🧬 **App Inheritance**: Apps extend parent apps (FightClub extends Popcorn extends Chrry), inheriting features and tools.

📲 **Native-Grade Experience**: Each app installs separately with its own name, icon, theme, and memory, despite running on shared infrastructure.
