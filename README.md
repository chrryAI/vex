# Vex

> A self-sustaining AI platform powered by user-provided models

[![GitHub stars](https://img.shields.io/github/stars/chrryai/vex?style=social)](https://github.com/chrryai/vex/starers)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Open Source](https://img.shields.io/badge/Open%20Source-💝-brightgreen)](SPONSORS.md)

## 💝 Support This Project

Vex is pioneering AI app composition with architecture built entirely open source by a solo developer. If you find this project valuable, please consider [becoming a sponsor](https://github.com/sponsors/chrryAI) to help sustain development.

[💎 Become a Sponsor](https://github.com/sponsors/chrryAI) | [⭐ Star on GitHub](https://github.com/chrryai/vex) | [🐦 Follow on Twitter](https://twitter.com/chrryai)

---

## 🚀 One Codebase, Unlimited Apps

Vex pioneered a breakthrough PWA architecture that enables **multiple independent apps from a single codebase**:

- **📱 Multi-app PWA**: Install unlimited apps on your home screen, each with unique icons and themes
- **🏪 App Marketplace**: Users can browse and install specialized AI apps (Atlas for travel, Bloom for wellness, Vault for finance, etc.)
- **📲 Native-like Experience**: Each app feels completely independent with its own branding and functionality
- **🔄 Dynamic Manifests**: Intelligent manifest generation creates separate PWA identities from one codebase

**Example User Home Screen:**

```
🌍 Atlas    - AI Travel Planner
🍑 Peach    - Social Life Assistant
🌸 Bloom    - Wellness Coach
🏦 Vault    - Personal Finance Manager
```

All powered by the same infrastructure, yet each app is a fully independent PWA installation.

**Coming to Native**: The same architecture extends to React Native, where users will browse and install apps from an in-app store, all preloaded in a single native app download.

## Features

- 🤖 Multi-model AI support (ChatGPT, Claude, DeepSeek, Gemini, and custom models)
- 🔌 OpenAI-compatible custom model integration
- 💾 Smart memory and context management
- 🎨 True cross-platform (Web, PWA, Extension, iOS, Android)
- 🔒 User-controlled API keys and data
- 📱 Real-time collaboration
- 🌍 Multi-language support
- 💰 70% revenue share for app creators

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL 14+

### Setup Instructions

1. **Clone the repository**

   ```bash
   git clone https://github.com/chrryai/vex.git
   cd vex
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Copy the example files and add your own values:

   ```bash
   # Database configuration
   cp packages/db/.env.example packages/db/.env

   # Main app configuration
   cp apps/web/.env.example apps/web/.env

   # Api app configuration
   cp apps/chrry-dot-dev/.env.example apps/chrry-dot-dev/.env

   # WebSocket server
   cp apps/ws/.env.example apps/ws/.env
   ```

   Edit the `.env` files and add:
   - Your PostgreSQL database URL
   - Your AI provider API keys (ChatGPT, Claude, DeepSeek, etc.) or NEXT_PUBLIC_TESTING_ENV='e2e'
   - Other required credentials (see `.env.example` files)

4. **Set up the database**

   ```bash
   # Navigate to the database package
   cd packages/db

   # Generate Drizzle schema
   pnpm run generate

   # Run migrations
   pnpm run migrate

   # Seed with example data
   pnpm run seed

   # Go back to root
   cd ../..
   ```

### Start All Services

```bash
# From root directory, start all services at once
pnpm run dev:all
```

This will start:

- Web app (localhost:3000)
- Chrry.dev (localhost:3001)
- WebSocket server (localhost:5001)

See [CONTRIBUTING.md](CONTRIBUTING.md) for more detailed setup instructions.

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `psql -h localhost -U postgres`
- Check your `DATABASE_URL` format: `postgresql://user:password@localhost:5432/dbname`
- Ensure the database exists: `createdb your_db_name`

### Build Errors

- Clear cache: `rm -rf .next node_modules && pnpm install`
- Rebuild packages: `pnpm run build`

### Missing Dependencies

- Install pnpm globally: `npm install -g pnpm@9.1.2`
- Check Node version: `node -v` (should be 18+)

## Architecture

Vex is a monorepo built with:

- **Frontend**: Next.js 15, React 19
- **Backend**: Next.js API routes, WebSocket server
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Multi-provider support with custom model integration
- **Packages**: Shared UI, routing, and testing utilities

### Multi-App PWA Architecture

Multi-app system works through:

1. **Dynamic Manifest Generation** (`/api/manifest/[id]/route.ts`)
   - Each app generates a unique PWA manifest with custom icon, name, and theme
   - Manifests are served per-app, allowing multiple PWA installations

2. **App Context Detection** (`NavigationProvider.tsx`)
   - Detects which app user is installing/running
   - Switches themes, icons, and branding dynamically
   - Handles PWA-to-browser transitions for multi-app installs

3. **Unified Codebase** (`packages/ui`)
   - Single component library serves all apps
   - App-specific configurations stored in database
   - Runtime switching between app contexts

4. **App Store Pattern**
   - Users browse available apps via the marketplace
   - Install any app as a separate PWA on home screen
   - Each installation is independent but shares infrastructure

**Coming to Native**: React Native implementation will use a similar pattern where:

- One app download contains all apps preloaded
- In-app store lets users "install" (enable) specific apps
- Each app appears as a separate section with full branding
- Seamless switching between installed apps

### Project Structure

```
vex/
├── apps/
│   ├── chrry-dot-dev/    # Api (localhost:3001)
│   ├── web/              # Alternative frontend (localhost:3000)
│   ├── ws/               # WebSocket server (localhost:5001)
│   ├── extension/        # Browser extension
│   └── native/           # React Native mobile app
├── packages/
│   ├── ui/               # Shared UI components (@chrryai/chrry)
│   ├── pepper/           # Universal router (@chrryai/pepper)
│   ├── waffles/          # Testing utilities (@chrryai/waffles)
│   └── db/               # Database layer with Drizzle ORM
└── scripts/              # Build and utility scripts
```

## Documentation

- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [API Documentation](docs/API.md)

## 🏆 Sponsors

Vex is made possible by generous sponsors who believe in open source innovation:

### Platinum Sponsors

_Be the first to support!_

### Gold Sponsors

_Your logo here - [Become a sponsor](SPONSORS.md)_

### Silver Sponsors

_Your logo here - [Become a sponsor](SPONSORS.md)_

**Interested in sponsoring?** Check out our [sponsorship tiers](SPONSORS.md) and help us build the future of AI app composition.

---

## License

AGPL-3.0 - See [LICENSE](LICENSE)

**Note on Icons**: The icons used in this project are from [Wannathis](https://wannathis.one/) under a commercial license. If you fork this project, you'll need to replace the icons with your own or purchase a license. See [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for details.

## Support

- 💝 Sponsor: [SPONSORS.md](SPONSORS.md)
- 📧 Email: iliyan@chrry.ai
- 🐛 Issues: https://github.com/chrryai/vex/issues
- 🐦 Twitter: [@chrryai](https://twitter.com/chrryai)
