# Vex

A sovereign, self-sustaining AI platform powered by user-provided models.

The Ecosystem:

Plaintext

🦄 Vex Core (Infrastructure)
├── 🌍 Atlas (Travel Agent)
├── 🍑 Peach (Social Assistant)
├── 🌸 Bloom (Wellness Coach)
└── 🏦 Vault (Finance Manager)
Coming Soon to Native: A single React Native container that allows users to "install" these apps internally, creating a localized App Store experience.

💸 The Builder Economy (70% Rev Share)
Vex is not just a tool; it is a marketplace.

70% Revenue Share: Builders keep the lion's share of subscription revenue.

BYOK (Bring Your Own Key): We operate on a sovereign model. Users/Builders provide their own API keys (OpenAI, Anthropic, DeepSeek).

Benefit: We don't tax your intelligence.

Benefit: You optimize your own margins by selecting efficient models.

Inheritance: New apps can "extend" existing apps, inheriting their capabilities and tools.

✨ Features
🤖 Model Agnostic: First-class support for OpenAI, Claude, DeepSeek, Gemini, and Perplexity.

🔌 Custom Models: Point Vex to any OpenAI-compatible endpoint (LocalLLM, Ollama, vLLM).

🧠 Vector Memory: Smart context management that persists across sessions.

📚 RAG (Retrieval-Augmented Generation): Upload documents (PDF, images, video) and chat with your files using hybrid vector + graph search.

🕸️ Knowledge Graph: FalkorDB-powered entity extraction and relationship mapping for advanced context understanding.

🌍 Multi-App PWA: The only open-source implementation of dynamic manifest injection.

🔒 Privacy First: User-controlled keys mean user-controlled data. Burn mode for incognito conversations.

⚡ Real-Time: WebSocket-powered collaboration and streaming.

⚡ Quick Start
Prerequisites
Node.js 18+

pnpm 9+

PostgreSQL 14+ (with `pgvector` extension)

FalkorDB (for Knowledge Graph RAG)

Installation
Clone the Monorepo

Bash

git clone https://github.com/chrryai/vex.git
cd vex
Install Dependencies

Bash

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

Frontend: Next.js 15 (App Router), React 19

Backend: Next.js API Routes, WebSocket Server

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
│ ├── browser/ # Desktop App (Tauri)
── packages/
│ ├── ui/ # Shared Design System (@chrryai/chrry)
│ ├── db/ # Drizzle Schema & Migrations
│ ├── pepper/ # Universal Routing Logic
│ ├── waffles/ # E2E Testing (Playwright)
│ ├── auth/ # Better Auth Configuration
│ ├── calendar/ # Calendar Utilities
│ ├── focus/ # Focus Mode Logic
│ ├── shared/ # Shared Utilities
│ ├── cache/ # Caching Layer
│ ├── typescript-config/# Shared TypeScript Config
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

🚀 One Codebase, Unlimited Apps
Vex introduces a breakthrough Polymorphic PWA Architecture. It enables a single codebase to spawn infinite, independent applications on a user's device.

📱 Dynamic Manifest Generation: The server generates unique PWA manifests on the fly (/api/manifest/[id]).

🔄 Context Switching: The app detects which "personality" (Atlas, Bloom, Vault) it should adopt based on the install context.

📲 Native-Grade Experience: Each app installs separately with its own name, icon, theme, and memory, despite running on shared infrastructure.
